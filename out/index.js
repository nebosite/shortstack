"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ShortStackOptions_1 = require("./ShortStackOptions");
const chalk_1 = __importDefault(require("chalk"));
const CommandHandler_1 = require("./models/CommandHandler");
const CommandLineHelper_1 = require("./Helpers/CommandLineHelper");
const UserInput_1 = require("./UserInput");
const logger_1 = require("./Helpers/logger");
//------------------------------------------------------------------------------
// main
//------------------------------------------------------------------------------
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        process.on("SIGINT", () => __awaiter(this, void 0, void 0, function* () {
            console.log("*** Process was interrupted! ***");
            process.exit(1);
        }));
        try {
            let debug = false;
            process.argv.slice(2).forEach(a => {
                if (a.match(/debug$/i)) {
                    debug = true;
                }
            });
            if (debug) {
                const input = new UserInput_1.UserInput();
                yield input.getUserInput(`Pausing so you can attach a debugger. Press [Enter] when ready...`);
            }
            const options = CommandLineHelper_1.CreateOptions(ShortStackOptions_1.ShortStackOptions);
            if (options.showHelp) {
                options.showUsage();
                return 0;
            }
            if (options.validationErrors) {
                console.log("Validation errors: ");
                for (const error of options.validationErrors) {
                    console.log(`    ${error.paramaterName}:  ${error.message}`);
                }
                return 1;
            }
            if (!options.action)
                throw Error("No action specified.");
            const handler = new CommandHandler_1.CommandHandler(new logger_1.ConsoleLogger());
            switch (options.action.commandName) {
                case "new":
                    yield handler.new(options.action);
                    break;
                case "go":
                    yield handler.go(options.action);
                    break;
                case "merge":
                    yield handler.merge(options.action);
                    break;
                case "list":
                    yield handler.list(options.action);
                    break;
                case "status":
                    yield handler.status(options.action);
                    break;
                case "purge":
                    yield handler.purge(options.action);
                    break;
                case "push":
                    yield handler.push(options.action);
                    break;
                case "next":
                    yield handler.next(options.action);
                    break;
                default: throw new CommandHandler_1.ShortStackError(`Unknown action: ${options.action.commandName}`);
            }
            return 0;
        }
        catch (error) {
            if (error instanceof CommandHandler_1.ShortStackError) {
                console.error(chalk_1.default.redBright(error.message));
            }
            else {
                console.error(chalk_1.default.redBright(error.stack));
            }
            return 1;
        }
    });
}
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
console.log(chalk_1.default.whiteBright(`SHORTSTACK v${require("../package.json").version} -------------------------------------------------------`));
main()
    .then(status => {
    //console.log(`Exiting with status: ${status}`)
    process.exit(status);
});
//# sourceMappingURL=index.js.map