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
    longDescription= `Great for isolating smaller changes of a much larger big change`

    @subCommand({
        description: "A Shortstack action.  Use 'shortstack help actions' to see available actions.",
        commands: [
            ShortStackNewOptions, 
            ShortStackGoOptions, 
            ShortStackListOptions, 
            ShortStackStatusOptions, 
            ShortStackPurgeOptions,
            ShortStackPushOptions,
            ShortStackNextOptions
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