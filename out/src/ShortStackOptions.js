"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const CommandLineHelper_1 = require("./Helpers/CommandLineHelper");
class SubOptions extends CommandLineHelper_1.CommandLineOptionsClass {
    constructor() {
        super(...arguments);
        this.longDescription = ``;
    }
    validate(reportError) { }
}
//------------------------------------------------------------------------------
// New command options
//------------------------------------------------------------------------------
class ShortStackNewOptions extends SubOptions {
    constructor() {
        super(...arguments);
        this.commandName = "new";
        this.shortDescription = `Create a new stack or new level on an existing stack`;
        this.stackName = null;
        this.root = null;
    }
}
__decorate([
    CommandLineHelper_1.positionalParameter({ description: "Name of the stack to create.", required: true })
], ShortStackNewOptions.prototype, "stackName", void 0);
__decorate([
    CommandLineHelper_1.positionalParameter({ description: "Desired root branch for this stack. (Default is current branch)" })
], ShortStackNewOptions.prototype, "root", void 0);
exports.ShortStackNewOptions = ShortStackNewOptions;
//------------------------------------------------------------------------------
// go command options
//------------------------------------------------------------------------------
class ShortStackGoOptions extends SubOptions {
    constructor() {
        super(...arguments);
        this.commandName = "go";
        this.shortDescription = `Go to a particular stack and/or stack level`;
        this.nameOrLevel = null;
        this.level = null;
    }
}
__decorate([
    CommandLineHelper_1.positionalParameter({ description: "Name of stack or level of the current stack to go to", required: true })
], ShortStackGoOptions.prototype, "nameOrLevel", void 0);
__decorate([
    CommandLineHelper_1.positionalParameter({ description: "Level of the named stack to go to" })
], ShortStackGoOptions.prototype, "level", void 0);
exports.ShortStackGoOptions = ShortStackGoOptions;
//------------------------------------------------------------------------------
// list command options
//------------------------------------------------------------------------------
class ShortStackListOptions extends SubOptions {
    constructor() {
        super(...arguments);
        this.commandName = "list";
        this.shortDescription = `List available stacks`;
    }
}
exports.ShortStackListOptions = ShortStackListOptions;
//------------------------------------------------------------------------------
// status command options
//------------------------------------------------------------------------------
class ShortStackStatusOptions extends SubOptions {
    constructor() {
        super(...arguments);
        this.commandName = "status";
        this.shortDescription = "Show the status of the current stack";
    }
}
exports.ShortStackStatusOptions = ShortStackStatusOptions;
//------------------------------------------------------------------------------
// purge command options
//------------------------------------------------------------------------------
class ShortStackPurgeOptions extends SubOptions {
    constructor() {
        super(...arguments);
        this.commandName = "purge";
        this.shortDescription = "Purge stacks from the repository";
        this.stackName = null;
        this.remote = false;
        this.all = false;
        this.forReal = false;
    }
}
__decorate([
    CommandLineHelper_1.positionalParameter({ description: "Name of stack (default = all locally found stacks)", required: false })
], ShortStackPurgeOptions.prototype, "stackName", void 0);
__decorate([
    CommandLineHelper_1.flagParameter({ description: "Also delete stacks from remote" })
], ShortStackPurgeOptions.prototype, "remote", void 0);
__decorate([
    CommandLineHelper_1.flagParameter({ description: "Find all local stacks" })
], ShortStackPurgeOptions.prototype, "all", void 0);
__decorate([
    CommandLineHelper_1.flagParameter({ description: "Really purge.  Otherwise just shows what stacks will die." })
], ShortStackPurgeOptions.prototype, "forReal", void 0);
exports.ShortStackPurgeOptions = ShortStackPurgeOptions;
//------------------------------------------------------------------------------
// push command options
//------------------------------------------------------------------------------
class ShortStackPushOptions extends SubOptions {
    constructor() {
        super(...arguments);
        this.commandName = "push";
        this.shortDescription = "Push up commits and create PR if one doesn't exist";
        // @nameValueParameter({description: "Comma-separated list of aliases"})
        // reviewers = "";
    }
}
exports.ShortStackPushOptions = ShortStackPushOptions;
//------------------------------------------------------------------------------
// push command options
//------------------------------------------------------------------------------
class ShortStackNextOptions extends SubOptions {
    constructor() {
        super(...arguments);
        this.commandName = "next";
        this.shortDescription = "Push up current commits and move to next level in the stack";
    }
}
exports.ShortStackNextOptions = ShortStackNextOptions;
//------------------------------------------------------------------------------
// main program options
//------------------------------------------------------------------------------
class ShortStackOptions extends CommandLineHelper_1.CommandLineOptionsClass {
    constructor() {
        super(...arguments);
        this.commandName = "shortstack";
        this.shortDescription = `(Version ${require("../package.json").version}) A tool for stacking pull requests in a git repo`;
        this.longDescription = `Shortstack is a tool for isolating large changes into a series of small pull requests.

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
    `;
        this.debug = false;
    }
    //------------------------------------------------------------------------------
    // validate
    //------------------------------------------------------------------------------
    validate(reportError) {
        // TODO: add code here to validate the full parameter set.
        // if there are any problems, call reportError() so that they will
        // all be reported to the user. 
    }
}
__decorate([
    CommandLineHelper_1.subCommand({
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
], ShortStackOptions.prototype, "action", void 0);
__decorate([
    CommandLineHelper_1.flagParameter({ description: "Pause so you can attach a debugger", required: false })
], ShortStackOptions.prototype, "debug", void 0);
exports.ShortStackOptions = ShortStackOptions;
//# sourceMappingURL=ShortStackOptions.js.map