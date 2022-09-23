"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
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
    CommandLineHelper_1.positionalParameter({ description: "Name of the stack to create" })
], ShortStackNewOptions.prototype, "stackName", void 0);
__decorate([
    CommandLineHelper_1.positionalParameter({ description: "Desired root branch for this stack" })
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
    CommandLineHelper_1.positionalParameter({ description: "Name or level of the stack to go to (default is current stack)" })
], ShortStackGoOptions.prototype, "nameOrLevel", void 0);
__decorate([
    CommandLineHelper_1.positionalParameter({ description: "Level of the stack to go to" })
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
// main program options
//------------------------------------------------------------------------------
class ShortStackOptions extends CommandLineHelper_1.CommandLineOptionsClass {
    constructor() {
        super(...arguments);
        this.commandName = "shortstack";
        this.shortDescription = `(Version ${require("../package.json").version}) A tool for stacking pull requests in a git repo`;
        this.longDescription = `Great for isolating smaller changes of a much larger big change`;
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
        commands: [ShortStackNewOptions, ShortStackGoOptions, ShortStackListOptions]
    })
], ShortStackOptions.prototype, "action", void 0);
exports.ShortStackOptions = ShortStackOptions;
//# sourceMappingURL=ShortStackOptions.js.map