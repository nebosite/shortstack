import { ShortStackListOptions, ShortStackNewOptions, ShortStackStatusOptions } from "../ShortStackOptions";
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
    // Find any uncommitted work
    //------------------------------------------------------------------------------
    private async checkForDanglingWork()
    {
        await this._git.fetch();
        const status = await this._git.status();
        if(status.not_added.length > 0
            || status.conflicted.length > 0
            || status.created.length > 0
            || status.deleted.length > 0
            || status.modified.length > 0
            || status.renamed.length > 0
            || status.files.length > 0
            || status.staged.length > 0) {
                throw new ShortStackError(`The current branch (${status.current}) has uncommitted changes.`)
            }
    }

    //------------------------------------------------------------------------------
    // new - create a new stack or new level in the stack
    // usage:  ss new [stackname]
    //------------------------------------------------------------------------------
    async new(options: ShortStackNewOptions) 
    {
        await this.checkForDanglingWork();
        const stackInfo = await StackInfo.Create(this._git, this.currentBranch as string);
        console.log(`CURRENT ${stackInfo.current?.branchName ?? "NOT CURRENT"}`)
        if(options.stackName 
            && stackInfo.current
            && stackInfo.current.parent.name.toLowerCase() !== options.stackName.toLowerCase()) {
            throw new ShortStackError(`Cannot create a new stack from existing stack.  Checkout a non-stacked branch and try again.`)
        }

        if(!options.stackName && !stackInfo.current)
        {
            throw new ShortStackError("The current branch is not a stacked branch."
                +"\nUse 'shortstack list' to see available stacks"
                +"\nUse 'shortstack go (stackName)` to edit an existing stack"
                +"\nUse 'shortstack new (stackName)` to create a new stack");
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
        // write-host "Next steps:"
        // write-host "    1) Keep to a 'single-thesis' change for this branch"
        // write-host "    2) make as many commits as you want"
        // write-host "    3) When your change is finished:"
        // write-host "       ss push   <== pushes your changes up and creates a pull request."
        // write-host "       ss new    <== creates the next branch for a new change.`n`n"
    }

    
    //------------------------------------------------------------------------------
    // list - show existing stacks
    //------------------------------------------------------------------------------
    async list(options: ShortStackListOptions) 
    {
        const stackInfo = await StackInfo.Create(this._git, this.currentBranch as string);
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
        const stackInfo = await StackInfo.Create(this._git, this.currentBranch as string);

        const unsettledItems = await stackInfo.getUnsettledItems();
        if(unsettledItems.length > 0) {
            this._logLine(chalk.yellow("There are unsettled items:"))
            unsettledItems.forEach(i => this._logLine(chalk.yellow(`    ${i}`)))
            this._logLine();
        }
        
        if(!stackInfo.current) {
            this._logLine("You are not currently editing a stack.");
            this._logLine("    To see a list of available stacks:                 shortstack list");
            this._logLine("    To resume editing an existing stack:               shortstack go [stackname]");
            this._logLine("    To start a new stack off the current git branch:   shortstack new [stackname]");
        }
        else {
            const stack = stackInfo.current.parent;
            this._logLine(`Current Stack: ${chalk.cyanBright(stack.name)}  (branched from ${chalk.cyanBright(stack.sourceBranch)})`)
            for(const level of stack.levels)
            {
                if(level.levelNumber == 0) continue;
                const levelText = `${level.levelNumber.toString().padStart(3,"0")} ${level.label}`
                if(level.levelNumber === stackInfo.current.levelNumber) {
                    this._logLine(chalk.whiteBright("    --> " + levelText))
                }
                else {
                    this._logLine(chalk.gray       ("        " + levelText))
                }
            }
        }
    }

}