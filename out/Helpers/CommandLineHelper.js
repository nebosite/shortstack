"use strict";
/* -----------------------------------------------------------------------------
A decorator approach to command-line parsing.
E.g.:
    export class MyCommandLineOptions extends CommandLineOptionsClass {
        commandName= "jenkit"
        shortDescription= `(Version ${require("../package.json").version}) A tool for mincing rectified bean sprouts`
        longDescription= `Yadda yadda yadda`
        // EXAMPLES OF PARAMETERS

        // positional parameter - can be a string or number
        // positional parameter order is controlled by the order in the code.
        // Positional parameters and named parameters can be intermixed
        // parameters are not required by default
        @positionalParameter({description: "My ID description", required: true})
        myId: number = -1;  // Could also be a string

        // Flag parameters - these are True/False
        // Normally a parameter follow property name, but you can specify any number of alternate names
        @flagParameter({description: "blah blah"}, alternateNames: [ "c", "choc", "fudge"]})
        addChocolate = false;

        // Environment Parameters - these are pulled from the environment
        @environmentParameter({description: "Buzz buzz", required: true})
        USERNAME: string | undefined = undefined;

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

    // Example of how to use in a script:
    const options = CreateOptions(MyCommandLineOptions);
    if(options.showHelp) options.showUsage();
    if(options.validationErrors) {
        console.log("Validation errors: ");
        for(const error of options.validationErrors){
            console.log(`    ${error.paramaterName}:  ${error.message}`);
        }
    }
----------------------------------------------------------------------------- */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelpRightMargin = 120;
//------------------------------------------------------------------------------
// Types of parameters
//------------------------------------------------------------------------------
var ParameterType;
(function (ParameterType) {
    ParameterType["Positional"] = "Positional";
    ParameterType["NameValue"] = "NameValue";
    ParameterType["Flag"] = "Flag";
    ParameterType["Environment"] = "PositiEnvironmentonal";
    ParameterType["Remaining"] = "Remaining";
    ParameterType["SubCommand"] = "SubCommand"; // A string subcommand with separate parameters
})(ParameterType || (ParameterType = {}));
//------------------------------------------------------------------------------
// details for a particular argument
//------------------------------------------------------------------------------
class ArgumentDetails {
    constructor(propertyName, type, classTarget) {
        this.required = false;
        this.orderValue = 0;
        this.propertyName = propertyName;
        this.type = type;
        this.contentClassName = classTarget.constructor.name;
        this.contentConstructor = classTarget.constructor;
    }
    clone() {
        var cloneObj = new ArgumentDetails("", ParameterType.Environment, "");
        var me = this;
        for (var attribut in this) {
            cloneObj[attribut] = me[attribut];
        }
        return cloneObj;
    }
}
const objectParameterMap = new Map();
//------------------------------------------------------------------------------
// helper to safely get the parameter map from an object
//------------------------------------------------------------------------------
function getParameterMap(className, constructIfMissing = false) {
    if (!objectParameterMap.get(className) && constructIfMissing) {
        objectParameterMap.set(className, new Map());
    }
    const properties = objectParameterMap.get(className);
    if (!properties)
        throw Error("Could not find properties definitions for " + className);
    return properties;
}
//------------------------------------------------------------------------------
// general decorator for parameters
//------------------------------------------------------------------------------
function genericParameter(type, args) {
    return function decorator(target, key) {
        const properties = getParameterMap(target.constructor.name, true);
        if (properties.get(key))
            return;
        const details = new ArgumentDetails(key, type, target);
        details.decoratorConfig = args;
        details.alternateNames = args.alternateNames;
        details.description = args.description;
        if (args.required)
            details.required = args.required;
        details.orderValue = properties.size; // order is just the index in the array
        properties.set(key, details);
    };
}
//------------------------------------------------------------------------------
// positionalParameter decorator
//------------------------------------------------------------------------------
function positionalParameter(args) {
    return genericParameter(ParameterType.Positional, args);
}
exports.positionalParameter = positionalParameter;
//------------------------------------------------------------------------------
// flagParameter decorator
//------------------------------------------------------------------------------
function flagParameter(args) {
    return genericParameter(ParameterType.Flag, args);
}
exports.flagParameter = flagParameter;
//------------------------------------------------------------------------------
// evironmentParameter decorator
//------------------------------------------------------------------------------
function environmentParameter(args) {
    return genericParameter(ParameterType.Environment, args);
}
exports.environmentParameter = environmentParameter;
//------------------------------------------------------------------------------
// remainingParameters decorator
//------------------------------------------------------------------------------
function remainingParameters(args) {
    return genericParameter(ParameterType.Remaining, args);
}
exports.remainingParameters = remainingParameters;
//------------------------------------------------------------------------------
// parameterSet decorator
//------------------------------------------------------------------------------
function subCommand(args) {
    if (!args.commands)
        throw Error("@subCOmmand decorators must set the commands property");
    return genericParameter(ParameterType.SubCommand, args);
}
exports.subCommand = subCommand;
//------------------------------------------------------------------------------
// CreateOptions - use this to instantiate your options class
//------------------------------------------------------------------------------
function CreateOptions(classType, args) {
    const newOptions = new classType();
    newOptions.processCommandLine(args);
    return newOptions;
}
exports.CreateOptions = CreateOptions;
//------------------------------------------------------------------------------
// Abstract base class for command line options
//------------------------------------------------------------------------------
class CommandLineOptionsClass {
    constructor() {
        this.showHelp = false;
        this.validationErrors = undefined;
        this.positionIndex = -1;
        //------------------------------------------------------------------------------
        // Add an error to the validation errors
        //------------------------------------------------------------------------------
        this.addError = (paramaterName, message) => {
            if (!this.validationErrors)
                this.validationErrors = new Array();
            this.validationErrors.push({ paramaterName, message });
        };
    }
    //------------------------------------------------------------------------------
    // Process command line
    //------------------------------------------------------------------------------
    processCommandLine(argv = null) {
        if (this.positionIndex > -1)
            throw Error("Called processCommandLine Twice");
        this.positionIndex = 0;
        if (!argv)
            argv = process.argv.slice(2);
        try {
            this.prepareHandlers(this.addError);
            argv.forEach(arg => this.processNextParameter(arg, true, this.addError));
            if (argv.length == 0)
                this.showHelp = true;
            if (this.showHelp)
                return;
            this.validate(this.addError);
        }
        catch (err) {
            this.addError("GENERAL ERROR", err.message);
        }
    }
    //------------------------------------------------------------------------------
    // Process an options object with decorated members using the argument list
    //------------------------------------------------------------------------------
    prepareHandlers(reportError) {
        if (this.positionalHandlers)
            return;
        const parameters = getParameters(this);
        this.positionalHandlers = new Array();
        this.positionalNames = new Array();
        this.flagHandlers = new Map();
        const options = this;
        for (const parameter of parameters.values()) {
            switch (parameter.type) {
                case ParameterType.Positional:
                    this.positionalHandlers.push((v) => {
                        options[parameter.propertyName] = v;
                        return false;
                    });
                    this.positionalNames.push(parameter.propertyName);
                    break;
                case ParameterType.Flag:
                    if (parameter.alternateNames) {
                        for (const name of parameter.alternateNames) {
                            this.flagHandlers.set(name.toLowerCase(), () => { options[parameter.propertyName] = true; });
                        }
                    }
                    else {
                        this.flagHandlers.set(parameter.propertyName.toLowerCase(), () => { options[parameter.propertyName] = true; });
                    }
                    break;
                case ParameterType.Environment:
                    let envNames = [parameter.propertyName];
                    if (parameter.alternateNames && parameter.alternateNames.length > 0) {
                        envNames = parameter.alternateNames;
                    }
                    // Try to get this value now from the environment
                    for (const name of envNames) {
                        const foundValue = process.env[name];
                        if (foundValue) {
                            options[parameter.propertyName] = foundValue;
                            break;
                        }
                    }
                    if (parameter.required && !options[parameter.propertyName]) {
                        reportError(envNames.join("|"), "Could not find value from environment. " + parameter.description);
                    }
                    break;
                case ParameterType.Remaining:
                    // Since we are getting a set, the return on the handler is "true" to signal that we eat the rest of the parameters
                    options[parameter.propertyName] = new Array();
                    this.positionalHandlers.push((v) => { options[parameter.propertyName].push(v); return true; });
                    this.positionalNames.push(parameter.propertyName);
                    break;
                case ParameterType.SubCommand:
                    // A sub command functions like a special positional parameter.  The first
                    // word is the name of the sub command, then the command "eats" the next few parameters 
                    // that belong to the sub command before releasing parameters back to the main command
                    // First, track empty versions of the subcommand options classes so that we know the subcommand
                    // Names.  
                    const subCommands = parameter.decoratorConfig.commands
                        .map((commandType) => CreateOptions(commandType, []));
                    let chosenSubCommand;
                    // The handler will feed arguments to the subcommand
                    this.positionalHandlers.push((arg) => {
                        if (!chosenSubCommand) {
                            chosenSubCommand = subCommands.find(c => c.commandName.toLowerCase() == arg.toLowerCase());
                            if (!chosenSubCommand) {
                                reportError(parameter.propertyName, `Unknown option: ${arg}`);
                                return false;
                            }
                            options[parameter.propertyName] = chosenSubCommand;
                            return true; // We could process this, so keep parsing options
                        }
                        return chosenSubCommand.processNextParameter(arg, false, reportError);
                    });
                    this.positionalNames.push(parameter.propertyName);
                    break;
                default:
                    throw Error(`Bad parameter type: ${parameter.type}`);
            }
        }
    }
    //------------------------------------------------------------------------------
    // Process an options object with decorated members using the argument list
    // Returns true if there was a known way to process the argument
    //------------------------------------------------------------------------------
    processNextParameter(arg, reportUnknownParameter, reportError) {
        const trimmed = arg.replace(/^([-/]*)/, "");
        const hasPrefix = trimmed.length < arg.length;
        const parts = trimmed.split('=');
        // Maybe this is a flag
        const parameterName = parts[0].toLowerCase();
        const flagHandler = this.flagHandlers.get(parameterName);
        if (flagHandler && hasPrefix) {
            flagHandler();
            return true;
        }
        else {
            // if it looks like a plain argument, try to process it
            // as a positional paraments
            if (this.positionIndex < this.positionalHandlers.length) {
                try {
                    if (!this.positionalHandlers[this.positionIndex](arg)) {
                        this.positionIndex++;
                    }
                    ;
                }
                catch (err) {
                    reportError(this.positionalNames[this.positionIndex], err.message);
                    this.positionIndex++;
                }
                return true;
            }
            else {
                if (reportUnknownParameter)
                    reportError(parameterName, "Unknown parameter");
                return false;
            }
        }
    }
    //------------------------------------------------------------------------------
    // Show Usage
    //------------------------------------------------------------------------------
    showUsage(printLine = console.log) {
        showUsage(this, printLine);
    }
}
__decorate([
    flagParameter({ description: "Show Help", alternateNames: ["?", "h", "help"] })
], CommandLineOptionsClass.prototype, "showHelp", void 0);
exports.CommandLineOptionsClass = CommandLineOptionsClass;
//------------------------------------------------------------------------------
// Class communicating problems with the command line
//------------------------------------------------------------------------------
class OptionsError {
    constructor() {
        this.message = "No Error";
        this.badArgs = new Array();
    }
}
exports.OptionsError = OptionsError;
//------------------------------------------------------------------------------
// Helper to build a parameter list from the base class and derived class
//------------------------------------------------------------------------------
function getParameters(options) {
    var _a;
    const baseParameters = (_a = objectParameterMap.get(CommandLineOptionsClass.name)) === null || _a === void 0 ? void 0 : _a.values();
    let parameters = new Map();
    for (let parameter of baseParameters) {
        const parameterCopy = parameter.clone();
        parameterCopy.orderValue += 10000; // Help parameters should show up last
        parameters.set(parameter.propertyName, parameterCopy);
    }
    const localParameters = objectParameterMap.get(options.constructor.name);
    if (localParameters) {
        for (const parameter of localParameters.values()) {
            parameters === null || parameters === void 0 ? void 0 : parameters.set(parameter.propertyName, parameter.clone());
        }
    }
    return parameters;
}
//------------------------------------------------------------------------------
// Break up a string so that it overflows cleanly
//------------------------------------------------------------------------------
function formatOverflow(leftMargin, rightMargin, text) {
    text += " ";
    const output = new Array();
    let currentLine = "";
    let currentWord = "";
    let currentLineHasText = true;
    const flushLine = () => {
        output.push(currentLine);
        currentLine = " ".repeat(leftMargin) + currentWord;
        currentLineHasText = currentWord != "";
        currentWord = "";
    };
    for (let i = 0; i < text.length; i++) {
        // skip space at the start of the line
        if (text[i] == ' ' && !currentLineHasText)
            continue;
        if (text[i].match(/\s/)) {
            if (currentWord !== "") {
                if ((currentLine.length + currentWord.length) >= rightMargin) {
                    flushLine();
                }
                else {
                    currentLine += currentWord;
                    currentLineHasText = true;
                    currentWord = "";
                }
            }
            if (text[i] == '\n')
                flushLine();
            else
                currentLine += text[i];
        }
        else {
            currentWord += text[i];
        }
    }
    if (currentLine != "")
        flushLine();
    return output.join("\n");
}
//------------------------------------------------------------------------------
// Show usage text for the options object
//------------------------------------------------------------------------------
function showUsage(options, printLine) {
    let usageLine = "";
    usageLine += `USAGE: ${options.commandName} `;
    const details = new Array();
    const environmentDetails = new Array();
    const parameters = getParameters(options);
    if (parameters) {
        const quickLine = (name, description) => {
            let output = name;
            output += " ".repeat(40 - output.length);
            if (description)
                output += description;
            return output;
        };
        const braceIfRequired = (required, text) => required ? text : `(${text})`;
        const sortedParameters = Array.from(parameters.values()).sort((v1, v2) => {
            if (v1.propertyName === "showHelp")
                return 1;
            if (v2.propertyName === "showHelp")
                return -1;
            if (v1.type != v2.type) {
                if (v1.type == ParameterType.Positional)
                    return -1;
                if (v2.type == ParameterType.Positional)
                    return 1;
            }
            if (v1.required != v2.required) {
                if (v1.required)
                    return -1;
                if (v2.required)
                    return 1;
            }
            return v1.orderValue - v2.orderValue;
        });
        for (const parameter of sortedParameters) {
            switch (parameter.type) {
                case ParameterType.Positional:
                    usageLine += " " + braceIfRequired(parameter.required, `[${parameter.propertyName}]`);
                    details.push(quickLine(parameter.propertyName, parameter.description));
                    break;
                case ParameterType.Flag:
                    let flags = "-" + parameter.propertyName;
                    if (parameter.alternateNames) {
                        flags = "-" + parameter.alternateNames.join("|-");
                    }
                    usageLine += " " + braceIfRequired(parameter.required, flags);
                    details.push(quickLine(flags, parameter.description));
                    break;
                case ParameterType.Environment:
                    let envNames = [parameter.propertyName];
                    if (parameter.alternateNames && parameter.alternateNames.length > 0) {
                        envNames = parameter.alternateNames;
                    }
                    environmentDetails.push(quickLine(envNames.join("|"), parameter.description));
                    break;
                case ParameterType.Remaining:
                    usageLine += " " + braceIfRequired(parameter.required, `[${parameter.propertyName}...]`);
                    details.push(quickLine(parameter.propertyName, parameter.description));
                    break;
                case ParameterType.SubCommand:
                    const subCommandNames = new Array();
                    for (const commandType of parameter.decoratorConfig.commands) {
                        const subCommandOptions = CreateOptions(commandType, []);
                        details.push(quickLine(subCommandOptions.commandName, subCommandOptions.shortDescription));
                        subCommandNames.push(subCommandOptions.commandName);
                    }
                    usageLine += " " + braceIfRequired(parameter.required, `(${subCommandNames.join("|")}) (options)`);
                    break;
                default:
                    console.log(`ERROR: unknown parameter type: ${parameter.type}`);
                    break;
            }
        }
    }
    printLine(`${options.commandName}:  ${formatOverflow(options.commandName.length + 3, exports.HelpRightMargin, options.shortDescription)}`);
    printLine("");
    printLine(formatOverflow(options.commandName.length + 9, exports.HelpRightMargin, usageLine));
    details.forEach(d => printLine("   " + formatOverflow(43, exports.HelpRightMargin, d)));
    if (environmentDetails.length > 0) {
        printLine("");
        printLine("Values from environment:");
        environmentDetails.forEach(d => printLine("   " + formatOverflow(43, exports.HelpRightMargin, d)));
    }
    if (options.longDescription) {
        printLine("");
        printLine("DETAILED INFORMATION");
        printLine("   " + formatOverflow(3, exports.HelpRightMargin, options.longDescription));
    }
}
//# sourceMappingURL=CommandLineHelper.js.map