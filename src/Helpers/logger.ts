import chalk from "chalk";

export interface ILogger 
{
    logLine(text?: string | undefined): void;
    logWarning(text: string): void;
    logError(text: string): void;
}
export class ConsoleLogger implements ILogger
{
    logLine(text: string | undefined = undefined) { console.log(text); }
    logWarning(text: string) { console.error(chalk.yellowBright(text)); }
    logError(text: string) { console.error(chalk.redBright(text)); }
}
