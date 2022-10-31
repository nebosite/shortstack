import { CommandLineOptionsClass, flagParameter, positionalParameter, subCommand } from "./Helpers/CommandLineHelper";

abstract class SubOptions extends CommandLineOptionsClass
{
    longDescription= ``
    validate(reportError: (paramaterName: string, message: string) => void){}
}
//------------------------------------------------------------------------------
// New command options
//------------------------------------------------------------------------------
export class ShortStackNewOptions extends SubOptions { 
    commandName= "new"
    shortDescription= `Create a new stack or new level on an existing stack`

    @positionalParameter({description: "Name of the stack to create.", required: true})
    stackName: string | null = null;

    @positionalParameter({description: "Desired root branch for this stack. (Default is current branch)"})
    root: string | null = null;
}

//------------------------------------------------------------------------------
// go command options
//------------------------------------------------------------------------------
export class ShortStackGoOptions extends SubOptions { 
    commandName= "go"
    shortDescription= `Go to a particular stack and/or stack level`

    @positionalParameter({description: "Name of stack or level of the current stack to go to", required: true})
    nameOrLevel: string | null = null;

    @positionalParameter({description: "Level of the named stack to go to"})
    level: string | null = null;
}

//------------------------------------------------------------------------------
// finish command options
//------------------------------------------------------------------------------
export class ShortStackFinishOptions extends SubOptions { 
    commandName= "finish"
    shortDescription= `Take the full stack as a single PR back to the source branch`

    @flagParameter({description: "Finish the stack even if some of the PRs are not approved", alternateNames: ["f"]})
    force: string | null = null;

}

//------------------------------------------------------------------------------
// fetch command options
//------------------------------------------------------------------------------
export class ShortStackFetchOptions extends SubOptions { 
    commandName= "fetch"
    shortDescription= `Bring in a stack from the remote repo`

    @positionalParameter({description: "Name of the stack to fetch."})
    stackName: string | null = null;
}

//------------------------------------------------------------------------------
// merge command options
//------------------------------------------------------------------------------
export class ShortStackMergeOptions extends SubOptions { 
    commandName= "merge"
    shortDescription= `merge changes from the top of the stack to the bottom so it is consistent`

    @positionalParameter({description: "level of the stack to start from."})
    startFrom: string | null = null;

    @flagParameter({description: "Pull in external changes from the source branch (ie: merge from main)", alternateNames: ["f"]})
    full: string | null = null;
}

//------------------------------------------------------------------------------
// list command options
//------------------------------------------------------------------------------
export class ShortStackListOptions extends SubOptions { 
    commandName= "list"
    shortDescription= `List available stacks`
}
//------------------------------------------------------------------------------
// status command options
//------------------------------------------------------------------------------
export class ShortStackStatusOptions extends SubOptions { 
    commandName= "status"
    shortDescription= "Show the status of the current stack"
}

//------------------------------------------------------------------------------
// purge command options
//------------------------------------------------------------------------------
export class ShortStackPurgeOptions extends SubOptions { 
    commandName= "purge"
    shortDescription= "Purge stacks from the repository"

    @positionalParameter({description: "Name of stack (default = all locally found stacks)", required: false})
    stackName: string | null = null;

    @flagParameter({description: "Also delete stacks from remote"})
    remote = false;

    @flagParameter({description: "Find all local stacks"})
    all = false;

    @flagParameter({description: "Really purge.  Otherwise just shows what stacks will die."})
    forReal = false;
}

//------------------------------------------------------------------------------
// push command options
//------------------------------------------------------------------------------
export class ShortStackPushOptions extends SubOptions { 
    commandName= "push"
    shortDescription= "Push up commits and create PR if one doesn't exist"

    // @nameValueParameter({description: "Comma-separated list of aliases"})
    // reviewers = "";
}

//------------------------------------------------------------------------------
// push command options
//------------------------------------------------------------------------------
export class ShortStackNextOptions extends SubOptions { 
    commandName= "next"
    shortDescription= "Push up current commits and move to next level in the stack"
}


//------------------------------------------------------------------------------
// main program options
//------------------------------------------------------------------------------
export class ShortStackOptions extends CommandLineOptionsClass { 
    commandName= "shortstack"
    shortDescription= `(Version ${require("../package.json").version}) A tool for stacking pull requests in a git repo`
    longDescription= `Shortstack is a tool for isolating large changes into a series of small pull requests.

    The general flow goes like this:
        1. checkout main (or any other branch) and pull current code from the repo
        2. 'shortstack new (mystackName)' to create a new stack.   
           This will create a branch: mystackName/001
        3. Make some code changes and do one or more git commits.  
           (DO NOT git push - shortstack should handle that)
        4. 'shortstack next' to push up your changes and move to the next level
        5. Use shortstack's go command to go back to older levels and 
           make additional changes (e.g. respond to code reviews) and 
           then the merge command to auto move changes down through the stack
        6. Use shortstack's merge command to align the full stack with main 
           (or whatever source branch you started from)
        7. When all the PRs are approved, run 'shortstack finish' to wrap
           all the changeds into a single PR back to the source branch
        8. When everything is done, use 'shortstack purge' command to clean up
           the stacked branches. 

    TIPS
        * You can automatically assign reviewers by adding this to your local or global .git/config file: 
            [shortstack]
                reviewers = alias1,alias2,alias3,...
    `

    @subCommand({
        description: "A Shortstack action.  Use 'shortstack help actions' to see available actions.",
        commands: [
            ShortStackNewOptions, 
            ShortStackGoOptions, 
            ShortStackListOptions, 
            ShortStackMergeOptions, 
            ShortStackStatusOptions, 
            ShortStackPurgeOptions,
            ShortStackPushOptions,
            ShortStackNextOptions,
            ShortStackFetchOptions,
            ShortStackFinishOptions
        ]
    })
    action?: CommandLineOptionsClass;

    @flagParameter({description: "Pause so you can attach a debugger", required: false})
    debug = false;

    //------------------------------------------------------------------------------
    // validate
    //------------------------------------------------------------------------------
    validate(reportError: (paramaterName: string, message: string) => void)
    {
        // TODO: add code here to validate the full parameter set.
        // if there are any problems, call reportError() so that they will
        // all be reported to the user. 
    }
}