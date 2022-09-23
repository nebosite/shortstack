"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try {
            step(generator.next(value));
        }
        catch (e) {
            reject(e);
        } }
        function rejected(value) { try {
            step(generator["throw"](value));
        }
        catch (e) {
            reject(e);
        } }
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
            const handler = new CommandHandler_1.CommandHandler(console.log);
            yield handler.init();
            switch (options.action.commandName) {
                case "new":
                    yield handler.new(options.action);
                    break;
                case "go":
                    console.log("GO");
                    break;
                case "list":
                    yield handler.list(options.action);
                    break;
                default: throw Error(`Unknown action: ${options.action}`);
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