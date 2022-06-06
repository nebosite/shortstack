import { ShortStackListOptions, ShortStackNewOptions, ShortStackPurgeOptions, ShortStackPushOptions, ShortStackStatusOptions } from "../ShortStackOptions";
import simpleGit, {SimpleGit, SimpleGitOptions} from 'simple-git';
import {StackInfo} from "./Stack"
import chalk from "chalk";
import { GitFactory, GitRemoteRepo } from "../Helpers/Githelper";
import { ILogger } from "../Helpers/logger"
import open from 'open';

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

        const gitMatch = originLine.match(/\w+?\s+(\w+)@([^:]+):([^\/]+)\/(.*).git/)
        if(!gitMatch) {
            throw new ShortStackError("Could not find remoteInfo for this git repo.")
        }

        const host = `${gitMatch[2]}`;
        const repoParent =  `${gitMatch[3]}`;
        const repoName =  `${gitMatch[4]}`;
        this._gitBaseURL =  `https://${host}/${repoParent}/${repoName}`

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

        if(!options.stackName && !this._stackInfo!.current)
        {
            throw new ShortStackError("The current branch is not a stacked branch."
                +"\n    Use 'shortstack list' to see available stacks"
                +"\n    Use 'shortstack go (stackName)` to edit an existing stack"
                +"\n    Use 'shortstack new (stackName)` to create a new stack");
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
        }

        this.logger.logLine(chalk.greenBright("==================================="))
        this.logger.logLine(chalk.greenBright("---  Your new branch is ready!  ---"))
        this.logger.logLine(chalk.greenBright("==================================="))
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
                const stackHighlight = sameStack ? chalk.bgGreen : (t: string) => t
                
                this.logger.logLine(stackHighlight(`    ${chalk.whiteBright(stack.name)}  (Tracks: ${stack.sourceBranch})`));
                for(const level of stack.levels)
                {
                    const sameLevel = sameStack && level.levelNumber === this._stackInfo!.current?.levelNumber
                    const levelHighlight = sameLevel ? chalk.bgGreen : (t: string) => t
    
                    if(level.levelNumber == 0) continue;
                    this.logger.logLine(chalk.gray(`        ` + levelHighlight(`${level.levelNumber.toString().padStart(3,"0")} ${level.label}`)))
                }
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
            const levelText = `${level.levelNumber.toString().padStart(3,"0")} ${level.label}`
            if(level.levelNumber === this._stackInfo!.current!.levelNumber) {
                this.logger.logLine(chalk.whiteBright("    --> " + levelText))
            }
            else {
                this.logger.logLine(chalk.gray       ("        " + levelText))
            }
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
        if(!this._stackInfo!.current) {
            throw new ShortStackError("You are not currently editing a stack."
                + "\n    To see a list of available stacks:                 shortstack list"
                + "\n    To resume editing an existing stack:               shortstack go [stackname]"
                + "\n    To start a new stack off the current git branch:   shortstack new [stackname]"
            );
        }
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

    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    async push(options: ShortStackPushOptions) 
    {
        await this._initTask;
        await this.assertCurrentStack();
        const currentBranch = this._stackInfo?.current!;
        await this.checkForDanglingWork(true);

        const existingPRs = await this._remoteRepo!.findPullRequests({sourceBranch: currentBranch.branchName, targetBranch: currentBranch.previousBranchName})
        if(existingPRs && existingPRs.length > 1) {
            this.logger.logWarning(`Warning: there is more than 1 PR for this stack level.  Using: ${existingPRs[0].id}`)
        }

        const commitInfo = await this._stackInfo!.getCommitInfo();
        if(commitInfo.behind) {
            throw new ShortStackError("This stack level is missing commits that are on the remote.  Perform a git merge with the remote branch before running this command.")
        }
        if(!commitInfo.localCommits?.length) {
            this.logger.logLine("There are no local commits to push.")
            return;
        }

        this.logger.logLine(`Pushing up the following commits: `);
        commitInfo.localCommits.forEach(c => this.logger.logLine(`    ${c.hash} ${c.message}`))
        await this._git.push(this._stackInfo!.current!.parent.remoteName, this._stackInfo!.current!.branchName);

        let prNumber = 0;
        if(!existingPRs || existingPRs.length === 0) {
            this.logger.logLine("Creating a new PR...")
            const description = commitInfo.localCommits.map(c => c.message).join("\n")
            const title = description.split("\n")[0].substring(0,60);
            await this._remoteRepo?.createPullRequest(title, description, currentBranch.branchName, currentBranch.previousBranchName)
        }
        else {
            this.logger.logLine("Updating existing PR...")
            const existingPR = existingPRs[0];
            prNumber = existingPR.number;
            const description = existingPR.body + "\n\n" +  commitInfo.localCommits.map(c => c.message).join("\n")
            await this._remoteRepo?.updatePullRequest(existingPR.number, description)
        }

        const prURL = `${this._gitBaseURL}/pull/${prNumber}`
        this.logger.logLine(`Opening PR: ${prURL}`)
        await open(prURL);
    }
}