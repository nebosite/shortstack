import { ShortStackOptions, ShortStackNewOptions, ShortStackListOptions, ShortStackFinishOptions, ShortStackStatusOptions, ShortStackPurgeOptions, ShortStackPushOptions, ShortStackNextOptions, ShortStackGoOptions, ShortStackMergeOptions } from "./ShortStackOptions";
import chalk from "chalk"
import { CommandHandler, ShortStackError } from "./models/CommandHandler";
import { CreateOptions } from "./Helpers/CommandLineHelper";
import { UserInput } from "./UserInput";
import { ConsoleLogger } from "./Helpers/logger";

//------------------------------------------------------------------------------
// main
//------------------------------------------------------------------------------
async function main() {

    process.on("SIGINT", async () => {
        console.log("*** Process was interrupted! ***")
        process.exit(1);
    });

    try {
        let debug = false;
        process.argv.slice(2).forEach(a => {
            if(a.match(/debug$/i)) {
                debug = true;
            }
        })

        if(debug) {
            const input = new UserInput();
            await input.getUserInput(`Pausing so you can attach a debugger. Press [Enter] when ready...`)
        }

        const options = CreateOptions(ShortStackOptions);
      
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

        const handler = new CommandHandler(new ConsoleLogger());
        switch(options.action.commandName)
        {
            case "new":     await handler.new(options.action! as ShortStackNewOptions); break;
            case "go":      await handler.go(options.action! as ShortStackGoOptions); break;
            case "merge":   await handler.merge(options.action! as ShortStackMergeOptions); break;
            case "list":    await handler.list(options.action! as ShortStackListOptions); break;
            case "status":  await handler.status(options.action! as ShortStackStatusOptions); break;
            case "purge":   await handler.purge(options.action! as ShortStackPurgeOptions); break;
            case "push":    await handler.push(options.action! as ShortStackPushOptions); break;
            case "next":    await handler.next(options.action! as ShortStackNextOptions); break;
            case "finish":  await handler.finish(options.action! as ShortStackFinishOptions); break;
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
