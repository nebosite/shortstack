import { ShortStackListOptions, ShortStackNewOptions, ShortStackPurgeOptions, ShortStackStatusOptions } from "../ShortStackOptions";
import simpleGit, {SimpleGit, SimpleGitOptions} from 'simple-git';
import {StackInfo} from "./Stack"
import chalk from "chalk";

export class ShortStackError extends Error{ }
export class CommandHandler 
{
    private _logLine = (text?:string|undefined) => {};
    private _git: SimpleGit; 
    currentBranch: String | null = null;

    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(logLine: (text: string | undefined) => void)
    {
        this._logLine = logLine;

        const options: SimpleGitOptions = {
            baseDir: process.cwd(),
            binary: 'git',
            maxConcurrentProcesses: 6,    
            config: []
        };
        this._git = simpleGit(options);

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
    }

    //------------------------------------------------------------------------------
    // new - create a new stack or new level in the stack
    // usage:  ss new [stackname]
    //------------------------------------------------------------------------------
    async new(options: ShortStackNewOptions) 
    {
        const stackInfo = await this.getStackInfo(true);
        if((await stackInfo.getUnsettledItems()).length > 0) {
            throw new ShortStackError("Can't create a new stack if there are unsettled items")
        }

        if(options.stackName 
            && stackInfo.current
            && stackInfo.current.parent.name.toLowerCase() !== options.stackName.toLowerCase()) {
            throw new ShortStackError(`Cannot create a new stack from existing stack.  Checkout a non-stacked branch and try again.`)
        }

        if(!options.stackName && !stackInfo.current)
        {
            throw new ShortStackError("The current branch is not a stacked branch."
                +"\n    Use 'shortstack list' to see available stacks"
                +"\n    Use 'shortstack go (stackName)` to edit an existing stack"
                +"\n    Use 'shortstack new (stackName)` to create a new stack");
        }

        if(options.stackName)
        {
            if(stackInfo.current)
            {
                throw new ShortStackError("Please switch to a non-stacked branch before creating a new stack.")
            }

            this._logLine("Creating a new stack...")
            const newStack = await stackInfo.CreateStack(options.stackName);
            this._logLine("Setting up stack level 1...")
            await newStack.AddLevel();
        }

        this._logLine(chalk.greenBright("==================================="))
        this._logLine(chalk.greenBright("---  Your new branch is ready!  ---"))
        this._logLine(chalk.greenBright("==================================="))
    }

    
    //------------------------------------------------------------------------------
    // list - show existing stacks
    //------------------------------------------------------------------------------
    async list(options: ShortStackListOptions) 
    {
        const stackInfo = await this.getStackInfo();
        if(stackInfo.stacks.length == 0) {
            this._logLine("There are no stacks in this repo.");
        }
        else {
            this._logLine("Discovered these stacks:")
            for(const stack of stackInfo.stacks) {
                
                this._logLine(`    ${chalk.whiteBright(stack.name)}  (Tracks: ${stack.sourceBranch})`);
                for(const level of stack.levels)
                {
                    if(level.levelNumber == 0) continue;
                    this._logLine(chalk.gray(`        ${level.levelNumber.toString().padStart(3,"0")} ${level.label}`))
                }
            }
        }
    }

    //------------------------------------------------------------------------------
    // status - show current stack status
    //------------------------------------------------------------------------------
    async status(options: ShortStackStatusOptions) 
    {
        const stackInfo = await this.getStackInfo(true);
        this.assertCurrentStack(stackInfo);
    
        const stack = stackInfo.current!.parent;
        this._logLine(`Current Stack: ${chalk.cyanBright(stack.name)}  (branched from ${chalk.cyanBright(stack.sourceBranch)})`)
        for(const level of stack.levels)
        {
            if(level.levelNumber == 0) continue;
            const levelText = `${level.levelNumber.toString().padStart(3,"0")} ${level.label}`
            if(level.levelNumber === stackInfo.current!.levelNumber) {
                this._logLine(chalk.whiteBright("    --> " + levelText))
            }
            else {
                this._logLine(chalk.gray       ("        " + levelText))
            }
        }
    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    async getStackInfo(checkForUnsettledItems: boolean = false) {
        const stackInfo = await StackInfo.Create(this._git, this.currentBranch as string);

        if(checkForUnsettledItems) {
            const unsettledItems = await stackInfo.getUnsettledItems();
            if(unsettledItems.length > 0) {
                this._logLine(chalk.yellow("There are unsettled items:"))
                unsettledItems.forEach(i => this._logLine(chalk.yellow(`    ${i}`)))
                this._logLine();
            }            
        }

        return stackInfo;
    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    assertCurrentStack(stackInfo: StackInfo) {
        if(!stackInfo.current) {
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
        const stackInfo = await this.getStackInfo(true);
        if(stackInfo.current) {
            throw new ShortStackError("Please run purge from a non-stacked branch.")
        }

        const stacksToPurge = stackInfo.stacks.filter(s => ((options.stackName && options.stackName.toLowerCase() === s.name.toLowerCase())
                || options.all))

        if(stacksToPurge.length === 0) {
            this._logLine("Could not find any stacks to purge.  Either specify a stack name or use -all parameter for all stacks.   Use 'shortstack list' to see local stacks.")
            return;
        }

        if(!options.forReal) {
            this._logLine("DRY RUN ONLY.  Use -forreal parameter to actually purge")
        }
        
        for(const stack of stacksToPurge) {
            for(const l of stack.levels) {
                this._logLine(`    Purging: ${l.branchName}`)
                if(options.forReal) {
                    console.log(`         Deleting local`)
                    await this._git.deleteLocalBranch(l.branchName, true);
                }
                if(options.remote) {
                    this._logLine(`    Purging: ${l.parent.remoteName}/${l.branchName}`)
                    if(options.forReal) {
                        console.log(`         Deleting remote`)
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
            this._logLine("DRY RUN ONLY.  Use -forreal parameter to actually purge")
        }
    
        
    }

}