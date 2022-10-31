import { ShortStackFetchOptions, ShortStackFinishOptions, ShortStackGoOptions, ShortStackListOptions, ShortStackMergeOptions, ShortStackNewOptions, ShortStackNextOptions, ShortStackPurgeOptions, ShortStackPushOptions, ShortStackStatusOptions } from "../ShortStackOptions";
import simpleGit, {SimpleGit, SimpleGitOptions} from 'simple-git';
import {StackInfo, StackItem} from "./Stack"
import chalk from "chalk";
import { GitFactory, GitPullRequest, GitRemoteRepo } from "../Helpers/Githelper";
import { ILogger } from "../Helpers/logger"
import open from 'open';
import * as ping from "ping"

export class ShortStackError extends Error{ }
export class CommandHandler 
{
    currentBranch: String | null = null;
    private logger:ILogger;
    private _stackInfo?:StackInfo;
    private _git: SimpleGit; 
    private _initTask: Promise<void>
    private _remoteRepo?:GitRemoteRepo;
    private _gitBaseURL = "";

    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(logger: ILogger)
    {
        this.logger = logger;

        const options: SimpleGitOptions = {
            baseDir: process.cwd(),
            binary: 'git',
            maxConcurrentProcesses: 6,    
            config: []
        };
        this._git = simpleGit(options);
        this._initTask = this.init()
    }

    //------------------------------------------------------------------------------
    // Initialize git access
    //------------------------------------------------------------------------------
    async init()
    {
        try {
            const status = await this._git.status();
            this.currentBranch = status.current;
        }
        catch(error) {
            throw new ShortStackError(`Git error: ${(error as any).message}`)    
        }

        if(!this.currentBranch) throw new ShortStackError("ShortStack must be run in a git repo directory.")

        const remoteInfo = await this._git.remote(["-v"])
        const originLine = (`${remoteInfo}`).split("\n").find(l => l.startsWith("origin"))
        if(!originLine) {
            throw new ShortStackError("Could not find origin info from remote -v.  Is this directory in a repo?")
        }

        let gitMatch = originLine.match(/\w+?\s+(\w+)@([^:]+):([^\/]+)\/(.*).git/i)
        let host = "unknown"
        let repoParent = "unknown"
        let repoName = "unknown"

        if(gitMatch) {
            host = `${gitMatch[2]}`;
            repoParent =  `${gitMatch[3]}`;
            repoName =  `${gitMatch[4]}`;
        }
        if(!gitMatch) {
            gitMatch = originLine.match(/https.*\/\/(.+?)\/(.+)\/(.*)\.git/i)
            if(gitMatch) {
                host = `${gitMatch[1]}`;
                repoParent =  `${gitMatch[2]}`;
                repoName =  `${gitMatch[3]}`;
                }
        }

        if(!gitMatch) {
            throw new ShortStackError(`Could not find remoteInfo for this git repo. (${originLine})`)
        }

        this._gitBaseURL =  `https://${host}/${repoParent}/${repoName}`

        try {
            await new Promise<void>((resolve, reject) => {
                ping.sys.probe(host, function(isAlive, err){
                        if(!isAlive) reject()
                        resolve();
                    },  { timeout: 3 });
            })            
        }
        catch(err) {
            throw new ShortStackError(`Could not reach github server: ${host}`)
        }

        
        
        this._stackInfo = await StackInfo.Create(this._git, this.currentBranch as string);

        const envTokenName = "SHORTSTACK_GIT_TOKEN_" + host.replace(/\./g, "_")

        if(!process.env[envTokenName]) {
            throw new ShortStackError(`To use shortstack, ${envTokenName} must be set to a valid git token.`
            + `\nTo get a token, go here: https://${host}/settings/tokens`
            + "\nthen generate a new token with all of the 'repo' premissions checked"
            )
        }
        const gitToken = process.env[envTokenName] ?? ""

        const gitFactory = new GitFactory(host, "", gitToken);
        this._remoteRepo = await gitFactory.getRemoteRepo(repoParent, repoName);
    }



    //------------------------------------------------------------------------------
    // new - create a new stack or new level in the stack
    // usage:  ss new [stackname]
    //------------------------------------------------------------------------------
    async new(options: ShortStackNewOptions) 
    {
        await this._initTask;
        await this.checkForDanglingWork(true);

        if(options.stackName 
            && this._stackInfo!.current
            && this._stackInfo!.current.parent.name.toLowerCase() !== options.stackName.toLowerCase()) {
            throw new ShortStackError(`Cannot create a new stack from existing stack.  Checkout a non-stacked branch and try again.`)
        }

        if(options.stackName)
        {
            if(this._stackInfo!.current)
            {
                throw new ShortStackError("Please switch to a non-stacked branch before creating a new stack.")
            }

            this.logger.logLine("Creating a new stack...")
            const newStack = await this._stackInfo!.CreateStack(options.stackName);
            this.logger.logLine("Setting up stack level 1...")
            await newStack.AddLevel();
            this.logger.logLine(chalk.greenBright("==================================="))
            this.logger.logLine(chalk.greenBright("---  Your new stack is ready!   ---"))
            this.logger.logLine(chalk.greenBright("==================================="))
        }
        else {
            await this.next({} as unknown as ShortStackNextOptions)
        }

    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    async getLevelLabelDetails(level: StackItem) {
        const info = await this.getGitInfo(level)
        const id = level.levelNumber.toString().padStart(3,"0")
        const label = info.currentPr 
                ? `${info.currentPr.title} (${info.currentPr.state})` 
                : "** Active **"
  
        return {
            pr: info.currentPr,
            commits: info.commitInfo,
            id,
            label,
        }
    }

        
    //------------------------------------------------------------------------------
    // finish - Merge the whole stack as a single PR back to source branch
    //------------------------------------------------------------------------------
    async finish(options: ShortStackFinishOptions) 
    {
        await this._initTask;
        await this.checkForDanglingWork(true);
        this.assertCurrentStack();
    
        const stack = this._stackInfo!.current!.parent;
        this.logger.logLine(`FINISHING ${stack.name}`)

        this.logger.logLine("    Checking the stack for readiness...")
        let totalErrorCount = 0;
        let syncErrors = 0;
        let approvalErrors = 0;
        const reviewerList = new Map<string, string>()
        const prInfo: {level: number, id: number, title: string, url: string}[] = []


        await this._git.checkout([stack.sourceBranch])
        let statusResponse = await this._git.status()


        for(let stackLevel = 1; stackLevel < stack.levels.length; stackLevel++) {
            let errorCount = 0;
            const err = (message: string) => {
                errorCount++;
                totalErrorCount++;
                this.logger.logLine("        " + chalk.redBright(message));
            }

            if(stackLevel === 1) {
                if(statusResponse.ahead || statusResponse.behind) {
                    err(`Source branch ${stack.sourceBranch} is not in sync with origin. (+${statusResponse.ahead},-${statusResponse.behind})`)
                    syncErrors++;
                }
            }

            const level = stack.levels[stackLevel]

            this.logger.logLine(`    LEVEL ${level.levelNumber}`)
            this._git.checkout([level.branchName])
            statusResponse = await this._git.status()
            if(statusResponse.ahead || statusResponse.behind) {
                err(`branch ${level.branchName} is not in sync with origin. (+${statusResponse.ahead},-${statusResponse.behind})`)
                syncErrors++;
            }

            const {currentPr} = await this.getGitInfo(level);
            if(!currentPr) {
                err("No PR found for this level (Delete this branch or use 'shortstack push' to create a PR)")
            }
            else {
                const url = `${this._gitBaseURL}/pull/${currentPr.number}`
                prInfo.push({level: stackLevel, id: currentPr.number, title: currentPr.title, url})
                const reviews = await this._remoteRepo?.getReviews(currentPr);
                let approvers: string[] = []
                let otherStates: string[] = []
                reviews?.forEach(r => {
                    reviewerList.set(r.user.login, "")
                    switch(r.state) {
                        case "APPROVED": approvers.push(r.user.login); break;
                        case "COMMENTED": break;
                        default: otherStates.push(`${r.state} by ${r.user.login}`)
                    }
                })

                if(approvers.length === 0) {
                    if(options.force) {
                        this.logger.logLine(`        ` + chalk.yellowBright(`WARNING: this PR was not approved.  Skipping because of -force`))
                    }
                    else {
                        err(`The PR has not been approved. (${url})`)
                        approvalErrors++;
                    }
                }
                else {
                    this.logger.logLine(`        ` + `Approved by ${approvers.join(", ")}` + "  " + chalk.yellowBright(`${otherStates.join(",")}`))
                }
            }

            if(!errorCount) {
                this.logger.logLine("        " + chalk.greenBright("READY"))
            }
        }
       
        if(totalErrorCount) {
            const message = [ "This stack is not ready for finishing."]
            if(syncErrors) message.push("To fix sync issues, run 'shortstack merge -full`")
            if(approvalErrors) message.push("Make sure all PRs are approved.")

            this.logger.logLine(chalk.redBright(message.join("\n")))
            return;
        }

        this.logger.logLine("    Preparing final PR...")

        // create a new stack level
        stack.AddLevel()

        let description = `Finished Stack: ${stack.name}\n\n`
            + "This is a stacked pull request built from the list of smaller, approved pull requests listed below. "
            + "This PR does not need an extensive code review because the smaller parts have already been reviewed.  "
            + "Please click on the individual pull requests to see reviewer notes.\n\n "
            
        prInfo.forEach(pr => {
            description += `* [${pr.title}](${pr.url})\n`
        })
        const title = `Finished Stack: ${stack.name}` 

        const reviewerText = this._git.getConfig("shortstack.reviewers", "local")
                            ?? this._git.getConfig("shortstack.reviewers", "global")
        if(reviewerText) {
            ((await reviewerText).value)?.split(",").forEach(r => reviewerList.set(r,""))
        }

        const reviewers = Array.from(reviewerList.keys())

        const newPR = await this._remoteRepo?.createPullRequest(
            title, 
            description, 
            stack.currentLevel!.branchName, 
            stack.sourceBranch,
            reviewers
        )
        if(!newPR) throw new ShortStackError("Could not create a new pull request.")
        const prNumber = newPR?.number ?? 0;


        const prURL = `${this._gitBaseURL}/pull/${prNumber}`
        this.logger.logLine(`Opening PR: ${prURL}`)

    }

    //------------------------------------------------------------------------------
    // merge - make the stack consistent
    //------------------------------------------------------------------------------
    async merge(options: ShortStackMergeOptions) 
    {
        await this._initTask;
        await this.checkForDanglingWork(true);
        this.assertCurrentStack();
    
        const stack = this._stackInfo!.current!.parent;
        this.logger.logLine(`MERGING ${stack.name}`)

        let startLevel = options.startFrom ? Number.parseInt(options.startFrom) : 1
        if(startLevel < 1) startLevel = 1;


        for(let stackLevel = startLevel; stackLevel < stack.levels.length; stackLevel++) {
            const level = stack.levels[stackLevel]
            let previousBranch = stackLevel === 1
                ? level.parent.sourceBranch
                : level.previousBranchName;

            try {
                // only pull from the source branch if the full flag is given
                if(stackLevel > 1 || options.full) {
                    this.logger.logLine(`    LEVEL ${level.levelNumber}`)
                    this.logger.logLine(`        Checkout ${previousBranch}`)
                    const checkoutResponse = await this._git.checkout([previousBranch])
                    this.logger.logLine(`            ${checkoutResponse.split("\n")[0]}`)
                    
                    this.logger.logLine(`        pull`)
                    const pullResponse = await this._git.pull()
                    this.logger.logLine(`            Pulled ${pullResponse.summary.changes} changes, ${pullResponse.summary.deletions} deletions, ${pullResponse.summary.insertions} insertions`)

                    this.logger.logLine(`        Checkout ${level.branchName}`)
                    const checkoutResponse2 = await this._git.checkout([level.branchName])
                    this.logger.logLine(`            ${checkoutResponse2.split("\n")[0]}`)
                    
                    this.logger.logLine(`        merge  ${previousBranch}`)
                    const mergeResponse = await this._git.merge([previousBranch])
                    this.logger.logLine(`            ${mergeResponse.result}`)
                    if(mergeResponse.result !== "success")  throw Error("Cannot auto-merge")
                }
                else {
                    this.logger.logLine(`        Checkout ${level.branchName}`)
                    const checkoutResponse2 = await this._git.checkout([level.branchName])
                    this.logger.logLine(`            ${checkoutResponse2.split("\n")[0]}`)                 
                }
                this.logger.logLine(`        push origin ${level.branchName}`)
                const pushResponse = await this._git.push(["origin", level.branchName])
                if(pushResponse.remoteMessages.all.length === 0) {
                    this.logger.logLine(`            success`)
                }
                else {
                    throw Error(pushResponse.remoteMessages.all.join("\n"))
                }
            }
            catch(err) {
                if(`${err}`.indexOf("This repository moved") === -1) {
                    this.logger.logLine(chalk.yellowBright(`${err}.\nPlease fix by hand and rerun the command.`))
                    return;
                }
            }
        }
    }

    //------------------------------------------------------------------------------
    // list - show existing stacks
    //------------------------------------------------------------------------------
    async list(options: ShortStackListOptions) 
    {
        await this._initTask;
        if(this._stackInfo!.stacks.length == 0) {
            this.logger.logLine("There are no stacks in this repo.");
        }
        else {
            this.logger.logLine("Discovered these stacks:")
            for(const stack of this._stackInfo!.stacks) {

                const sameStack = stack.name === this._stackInfo!.current?.parent?.name
                let stackHighlight = sameStack 
                    ? (t:string) => chalk.whiteBright(chalk.bgGreen(t)) 
                    : (t: string) => chalk.white(t) 
                
                this.logger.logLine("    " + stackHighlight(`${stack.name}  (Tracks: ${stack.sourceBranch})`));
                for(const level of stack.levels)
                {
                    if(level.levelNumber == 0) continue;
                    const sameLevel = sameStack && level.levelNumber === this._stackInfo!.current?.levelNumber
                    const details = await this.getLevelLabelDetails(level);
                    let levelHighlight = (t:string) => chalk.green(t)

                    if(details.pr?.state !== "open") levelHighlight = chalk.blackBright;
                    if(sameLevel) levelHighlight =  (t: string) => chalk.whiteBright(chalk.bgGreen(t)) 
                    
                    this.logger.logLine(`        ` + levelHighlight(`${details.id} ${details.label}`))
                }
            }
        }
    }

    //------------------------------------------------------------------------------
    // fetch - get stacks from origin
    //------------------------------------------------------------------------------
    async fetch(options: ShortStackFetchOptions) 
    {
        await this._initTask;
        await this.checkForDanglingWork(true);

        const remoteStacks = new Map<string, string[]>()
        const result = await this._git.branch(["-l","-a"])
        for(let branchName of result.all) {
            const match = branchName.match(/remotes\/origin\/(.+)\/\d\d\d/i)
            if(match) {
                const name = match[1]
                if(!remoteStacks.has(name)) {
                    remoteStacks.set(name, [])
                }
                remoteStacks.get(name)!.push(branchName.replace("remotes/origin/", ""))
            }
        }

        if(!options.stackName) {
            this.logger.logLine("Finding stacks available...")
            Array.from(remoteStacks.keys()).forEach(s => this.logger.logLine(`    ${s} (${remoteStacks.get(s)!.length-1} levels)`))
            if(remoteStacks.size === 0) {
                this.logger.logLine(chalk.yellowBright("    No stacks were found on the remote repo."))
            }

            this.logger.logLine("Run 'shortstack fetch [stackname]' to retrieve remote stack.")
        }
        else {
            this.logger.logLine(`Fetching remote stack ${options.stackName}`)
            const levels = remoteStacks.get(options.stackName)
            if(!levels) {
                throw new ShortStackError(`'${options.stackName}' is not a known stack name.  Run 'shortstack fetch' to see a list of available stacks.`)
            }
            for(let level of levels) {
                this.logger.logLine(`    ${level}`)
                const checkoutResponse = await this._git.checkout([level])
                if(checkoutResponse != "" && !checkoutResponse.match(/(up to date|branch is behind|set up to track)/ig)) {
                    this.logger.logError(`        Checkout error: ${checkoutResponse}`)
                }
                else {
                    const pullResponse = await this._git.pull()
                    const remoteMessages = pullResponse.remoteMessages.all.join("\n        ")
                    if(remoteMessages != "") {
                        this.logger.logError(`        Pull error: ${remoteMessages}`)
                    }
                }

                this.logger.logLine("It might be a good idea to run 'shortstack merge' to make sure stack is consistent.")
            }
        }
    }

    //------------------------------------------------------------------------------
    // status - show current stack status
    //------------------------------------------------------------------------------
    async status(options: ShortStackStatusOptions) 
    {
        await this._initTask;
        await this.checkForDanglingWork(true);
        this.assertCurrentStack();
    
        const stack = this._stackInfo!.current!.parent;
        this.logger.logLine(`Current Stack: ${chalk.cyanBright(stack.name)}  (branched from ${chalk.cyanBright(stack.sourceBranch)})`)
        for(const level of stack.levels)
        {
            if(level.levelNumber == 0) continue;
            const details = await this.getLevelLabelDetails(level);
            const levelText = `${details.id} ${details.label}`

            let highlight = (t: string) => chalk.gray(t);
            let prefix = "        "

            if(level.levelNumber === this._stackInfo!.current!.levelNumber) {
                highlight =  (t: string) => chalk.whiteBright(t);
                prefix = "    --> " 
            }

            this.logger.logLine(highlight( prefix + levelText))
        }
    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    async checkForDanglingWork(shouldThrow: boolean = false) {
        const unsettledItems = await this._stackInfo!.getDanglingWork();
        if(unsettledItems.length > 0) {
            this.logger.logLine(chalk.yellow("There is dangling work:"))
            unsettledItems.forEach(i => this.logger.logLine(chalk.yellow(`    ${i}`)))
            this.logger.logLine();
            if(shouldThrow) {
                throw new ShortStackError("Cannot continue until dangling items are resolved.");
            }
        }            
    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    assertCurrentStack() {
        const currentStackLevel = this._stackInfo!.current
        if(!currentStackLevel) {
            throw new ShortStackError("You are not currently editing a stack."
                + "\n    To see a list of available stacks:                 shortstack list"
                + "\n    To resume editing an existing stack:               shortstack go [stackname]"
                + "\n    To start a new stack off the current git branch:   shortstack new [stackname]"
            );
        }

        return currentStackLevel;
    }

    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    async purge(options: ShortStackPurgeOptions) 
    {
        await this._initTask;
        await this.checkForDanglingWork(true);
        if(this._stackInfo!.current) {
            throw new ShortStackError("Please run purge from a non-stacked branch.")
        }

        const stacksToPurge = this._stackInfo!.stacks.filter(s => ((options.stackName && options.stackName.toLowerCase() === s.name.toLowerCase())
                || options.all))

        if(stacksToPurge.length === 0) {
            this.logger.logLine("Could not find any stacks to purge.  Either specify a stack name or use -all parameter for all stacks.   Use 'shortstack list' to see local stacks.")
            return;
        }

        if(!options.forReal) {
            this.logger.logLine("DRY RUN ONLY.  Use -forreal parameter to actually purge")
        }
        
        for(const stack of stacksToPurge) {
            for(const l of stack.levels) {
                this.logger.logLine(`    Purging: ${l.branchName}`)
                if(options.forReal) {
                    this.logger.logLine(`         Deleting local`)
                    await this._git.deleteLocalBranch(l.branchName, true);
                }
                if(options.remote) {
                    this.logger.logLine(`    Purging: ${l.parent.remoteName}/${l.branchName}`)
                    if(options.forReal) {
                        this.logger.logLine(`         Deleting remote`)
                        await this._git.push([stack.remoteName,"--delete",l.branchName])
                    }
                }

            }
        }
        stacksToPurge.forEach(s => {
            s.levels.forEach(l => {
            })
        })

        if(!options.forReal) {
            this.logger.logLine("DRY RUN ONLY.  Use -forreal parameter to actually purge")
        }
    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    async getGitInfo(currentLevel: StackItem) {
        const existingPRs = await this._remoteRepo!.findPullRequests({sourceBranch: currentLevel.branchName, targetBranch: currentLevel.previousBranchName})
        let currentPr: GitPullRequest | undefined = undefined;
        if(existingPRs) {
            if(existingPRs.length > 0) {
                currentPr = existingPRs[0]
            }
            if(existingPRs.length > 1) {
                this.logger.logWarning(`Warning: there is more than 1 PR for this stack level.  Using: ${existingPRs[0].number}`)
            }
        }

        const commitInfo = await this._stackInfo!.getCommitInfo();
        if(commitInfo.behind) {
            throw new ShortStackError("This stack level is missing commits that are on the remote.  Perform a git merge with the remote branch before running this command.")
        }

        return {currentPr, commitInfo}
    }

    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    async push(options: ShortStackPushOptions) 
    {
        await this._initTask;
        const currentLevel = await this.assertCurrentStack();
        await this.checkForDanglingWork(true);

        const {currentPr, commitInfo} = await this.getGitInfo(currentLevel);
        if(!commitInfo.localCommits?.length) {
            this.logger.logLine("There are no local commits to push.")
            return;
        }

        this.logger.logLine(`Pushing up the following commits: `);
        commitInfo.localCommits.forEach(c => this.logger.logLine(`    ${c.hash} ${c.message}`))
        await this._git.push(this._stackInfo!.current!.parent.remoteName, this._stackInfo!.current!.branchName);

        let prNumber = 0;
        if(!currentPr) {
            this.logger.logLine("Creating a new PR...")
            const description = commitInfo.localCommits.map(c => c.message).join("\n")
            const title = `SS${currentLevel.levelNumber.toString().padStart(3,"0")}: ` 
                            + description.split("\n")[0].substring(0,60);

            const reviewerText = this._git.getConfig("shortstack.reviewers", "local")
                                ?? this._git.getConfig("shortstack.reviewers", "global")

            const reviewers = reviewerText ? ((await reviewerText).value)?.split(",") : undefined;

            const newPR = await this._remoteRepo?.createPullRequest(
                title, 
                description, 
                currentLevel.branchName, 
                currentLevel.previousBranchName,
                reviewers
            )
            if(!newPR) throw new ShortStackError("Could not create a new pull request.")
            prNumber = newPR?.number ?? 0;
        }
        else {
            this.logger.logLine("Updating existing PR...")
            prNumber = currentPr.number;
            const description = currentPr.body + "\n\n" +  commitInfo.localCommits.map(c => c.message).join("\n")
            await this._remoteRepo?.updatePullRequest(currentPr.number, description)
        }

        const prURL = `${this._gitBaseURL}/pull/${prNumber}`
        this.logger.logLine(`Opening PR: ${prURL}`)
        await open(prURL);
    }

    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    async next(options: ShortStackPushOptions) 
    {
        await this._initTask;
        const currentLevel = await this.assertCurrentStack();
        await this.checkForDanglingWork(true);

        const {currentPr, commitInfo} = await this.getGitInfo(currentLevel);

        if(!currentPr && commitInfo.localCommits.length === 0) {
            throw new ShortStackError("No work found on the current level.  Commit some code before running this command.")
        }

        await this.push({} as unknown as ShortStackPushOptions);

        this.logger.logLine(`Creating new stack level: ${currentLevel.parent.nextLevelNumber}`)
        await currentLevel.parent.AddLevel();
        this.logger.logLine(chalk.greenBright("Success.  New stack level is ready."))
    }

    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    async go(options: ShortStackGoOptions) 
    {
        await this._initTask;
        await this.checkForDanglingWork(true);
        let targetLevel = Number.parseInt(options.level ?? "0");
        let targetStackName = options.nameOrLevel ?? (this._stackInfo?.current?.parent.name) ?? "";
        if(targetStackName === "") {
            throw new ShortStackError("Not on a current stack.  Run 'shortstack list' to see available stacks")
        }
        if(options.nameOrLevel?.match(/^\d+$/)) {
            const currentLevel = await this.assertCurrentStack();
            targetStackName = currentLevel.parent.name;
            targetLevel = Number.parseInt(options.nameOrLevel!);
        }

        // Don't move off this stack level if there is uncommitted work
        if(this._stackInfo!.current) {
            const {commitInfo} = await this.getGitInfo(this._stackInfo!.current!);
            if(commitInfo.localCommits.length > 0) {
                throw new ShortStackError("There is unpushed work at the current level.  Run 'shortstack push' before switching off this stack.")
            }
        }

        let targetStack = this._stackInfo!.stacks.find(s => s.name.toLowerCase() === targetStackName?.toLowerCase())
        if(!targetStack) {
            const matcher = new RegExp(targetStackName, "i")
            const otherStacks = this._stackInfo!.stacks.filter(s => matcher.exec(s.name) ? true : false)
            if(otherStacks.length === 1) {
                targetStack = otherStacks[0];
            }
        }
        if(!targetStack) {
            const stackNames = this._stackInfo!.stacks.map(s => s.name)
            throw new ShortStackError(`Could not find a stack called '${targetStackName}'.\nAvailable stacks:\n    ${stackNames.join('\n    ')}\nRun 'shortstack list' to see more info on stacks`)
        }

        if(targetLevel === 0) targetLevel = targetStack.nextLevelNumber - 1;
        const level = targetStack.levels.find(l => l.levelNumber === targetLevel);
        if(!level) {
            throw new ShortStackError(`The target stack '${targetStackName}' does not have level ${targetLevel}.  Run 'shortstack list' to see available stacks and levels.` )
        }

        this.logger.logLine(`Changing to branch '${level.branchName}'`)
        await this._git.checkout([level.branchName])
    }

}