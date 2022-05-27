import chalk from "chalk";
import { SimpleGit } from "simple-git";
import { ShortStackError } from "./CommandHandler";


interface ShortStackInfo {
    sourceBranch: string;
}

const INFO_TAG_NAME = "shortstack_info"

//------------------------------------------------------------------------------
// Helper to generate branch names
//------------------------------------------------------------------------------
function constructStackLevelBranchName(stackName: string, levelNumber: number) 
{
    return `${stackName}/${`${levelNumber}`.padStart(3,"0")}`
}

//------------------------------------------------------------------------------
// A single level in the stack
//------------------------------------------------------------------------------
export class StackItem {
    parent: Stack;
    levelNumber: number;
    get branchName() { return constructStackLevelBranchName(this.parent.name, this.levelNumber)}
    label?: string;

    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(parent: Stack, levelNumber: number) {
        this.parent = parent;
        this.levelNumber = levelNumber;
    }
}

//------------------------------------------------------------------------------
// A full set of stacked changes
//------------------------------------------------------------------------------
export class Stack {
    name: string;
    sourceBranch: string;
    remoteName: string;
    levels = new Array<StackItem>();
    currentLevel?: StackItem;
    private _git: SimpleGit;

    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(git: SimpleGit, name: string, sourceBranch: string, remoteName: string) {
        this._git = git;
        this.name = name;
        this.sourceBranch = sourceBranch;
        this.remoteName = remoteName;
    }

    //------------------------------------------------------------------------------
    // Add a level to the current stack
    //------------------------------------------------------------------------------
    async AddLevel(sourceBranch?: string | undefined)
    {
        let newLevelNumber = 0;

        if(this.levels.length > 0)
        {
            const lastLevel = this.levels[this.levels.length-1];
            newLevelNumber = lastLevel.levelNumber+1;
        }
        const newBranchName = constructStackLevelBranchName(this.name, newLevelNumber); 

        await this._git.checkout(["-b", newBranchName]);
        if(sourceBranch) {
            const info = {sourceBranch}
            await this._git.commit(`${INFO_TAG_NAME} ${ JSON.stringify(info)}`, ["--allow-empty"])
        }
        await this._git.push(["--set-upstream", this.remoteName,newBranchName]);

        const newItem = new StackItem(this, newLevelNumber);
        this.levels.push(newItem);
        this.currentLevel = newItem;
    }
}

//------------------------------------------------------------------------------
// The current state of all local stacks
//------------------------------------------------------------------------------
export class StackInfo {
    current?: StackItem;

    get stacks() {return Array.from(this._stacks.values()) }

    private _git: SimpleGit;
    private _stacks = new Map<string, Stack>()
    private remoteName = "origin";

    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(git: SimpleGit) {
        this._git = git;
    }

    //------------------------------------------------------------------------------
    // discover all the local stacks
    //------------------------------------------------------------------------------
    static async Create(git: SimpleGit, currentBranch: string)
    {
        const output = new StackInfo(git);
        const branchSummary = await git.branchLocal();
        output.remoteName = "origin";
        //TODO: maybe discover remote name like this:  await git.remote([])

        const sortedBranchNames:string[] = []
        for(const branchKey in branchSummary.branches)
        {
            sortedBranchNames.push(branchKey);
        }
        sortedBranchNames.sort((a,b) => a > b ? 1 : -1)
        

        for(const branchName of sortedBranchNames)
        {
            const branchInfo = branchSummary.branches[branchName];
            const match = /(.*?)\/(\d\d\d)$/.exec(branchName);
            if(match) {
                const stackName = match[1];
                const levelNumber = parseInt(match[2]);
                if(levelNumber === 0) {
                    const logDetails = await git.log(["-n", "1", branchInfo.commit])
                    const firstCommitMessage = logDetails.all[0].message
                    if(!firstCommitMessage.startsWith(INFO_TAG_NAME)){
                        console.log(chalk.yellowBright(`Warning: No ${INFO_TAG_NAME} commit on stack '${stackName}'`))    
                        continue;
                    }
                    const infoObject = JSON.parse(firstCommitMessage.substring(INFO_TAG_NAME.length+1)) as ShortStackInfo
                    output._stacks.set(stackName, new Stack(git, stackName, infoObject.sourceBranch, output.remoteName ))
                }

                const myStack = output._stacks.get(stackName);
                if(!myStack) {
                    console.log(chalk.yellowBright(`Warning: Dangling stack branch '${branchName}'`))  ;
                    continue; 
                }
                const newLevel = new StackItem(myStack, levelNumber);
                newLevel.label = branchInfo.label;
                myStack.levels[levelNumber] = newLevel;

                if(branchName == currentBranch) {
                    output.current = newLevel;
                    myStack.currentLevel = newLevel;
                }
            }
        }

        return output;
    }

    //--------------------------------------------------------------------------------------
    // Get a human-readable list of items that might cause trouble if we want to 
    // advance the stack.
    //--------------------------------------------------------------------------------------
    async getUnsettledItems(){
        await this._git.fetch();
        const output: string[] = []
        const result = await this._git.status()
        result.not_added.forEach(i =>       output.push(`Not added:     ${i}`))
        result.conflicted.forEach(i =>      output.push(`Conflicted:    ${i}`))
        result.created.forEach(i =>         output.push(`Created:       ${i}`))
        result.deleted.forEach(i =>         output.push(`Deleted:       ${i}`))
        result.modified.forEach(i =>        output.push(`Modified:      ${i}`))
        result.renamed.forEach(i =>         output.push(`Renamed:       ${i}`))
        result.staged.forEach(i =>          output.push(`Staged:        ${i}`))

        if(result.ahead > 0) output.push(`Ahead of remote branch by ${result.ahead} commits`)
        if(result.behind > 0) output.push(`Behind remote branch by ${result.behind} commits`)
        if(result.detached) output.push(`The current branch is DETATCHED`)
        return output;
    }

    //------------------------------------------------------------------------------
    // Create a brand new stack
    //------------------------------------------------------------------------------
    async CreateStack(name: string, parentBranch?: string )
    {
        name = name.toLowerCase();
        if(!parentBranch)
        {
            // Get default branch
            const remoteInfo = await this._git.remote(["show", this.remoteName]);
            if(!remoteInfo) throw new ShortStackError("Could not find remote info.  Please specify a parent branch explicitly. ");
            const match = (/HEAD branch: (\S+)/i).exec(remoteInfo);
            if(!match) parentBranch = "main";
            else parentBranch = match[1].valueOf();
        }
        const newStack = new Stack(this._git, name, parentBranch, this.remoteName );

        this._stacks.set(name, newStack)
        await newStack.AddLevel(parentBranch);

        this.current = newStack.currentLevel;
        return newStack;
    }
}