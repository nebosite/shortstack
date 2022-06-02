import { ShortStackOptions, ShortStackNewOptions, ShortStackListOptions, ShortStackStatusOptions, ShortStackPurgeOptions, ShortStackPushOptions } from "./ShortStackOptions";
import chalk from "chalk"
import { CommandHandler, ShortStackError } from "./models/CommandHandler";
import { CreateOptions } from "./Helpers/CommandLineHelper";
import { UserInput } from "./UserInput";

//------------------------------------------------------------------------------
// main
//------------------------------------------------------------------------------
async function main() {

    process.on("SIGINT", async () => {
        console.log("*** Process was interrupted! ***")
        process.exit(1);
    });

    try {
        const options = CreateOptions(ShortStackOptions);
        if(options.debug) {
            const input = new UserInput();
            await input.getUserInput(`Pausing so you can attach a debugger. Press [Enter] when ready...`)
        }
      
        if(options.showHelp)
        {
            options.showUsage();
            return 0;
        }

        if(options.validationErrors) {
            console.log("Validation errors: ");
            for(const error of options.validationErrors){
                console.log(`    ${error.paramaterName}:  ${error.message}`);
            }
            return 1;
        }

        if(!options.action)  throw Error("No action specified."); 

        const handler = new CommandHandler(console.log);
        switch(options.action.commandName)
        {
            case "new":  await handler.new(options.action! as ShortStackNewOptions); break;
            case "go":  console.log("GO"); break;
            case "list":  await handler.list(options.action! as ShortStackListOptions); break;
            case "status": await handler.status(options.action! as ShortStackStatusOptions); break;
            case "purge": await handler.purge(options.action! as ShortStackPurgeOptions); break;
            case "push": await handler.push(options.action! as ShortStackPushOptions); break;
            default: throw new ShortStackError(`Unknown action: ${options.action.commandName}`) 
        }
        return 0;
    } catch (error) {
        if(error instanceof ShortStackError) {
            console.error(chalk.redBright(error.message));
        }
        else {
            console.error(chalk.redBright((error as any).stack));
        }
        return 1;
    } 
}

// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------

console.log(chalk.whiteBright(`SHORTSTACK v${require("../package.json").version} -------------------------------------------------------`))

main()
    .then(status => {
        //console.log(`Exiting with status: ${status}`)
        process.exit(status);
    });
