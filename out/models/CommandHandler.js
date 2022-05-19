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
const simple_git_1 = __importDefault(require("simple-git"));
const Stack_1 = require("./Stack");
const chalk_1 = __importDefault(require("chalk"));
class ShortStackError extends Error {
}
exports.ShortStackError = ShortStackError;
class CommandHandler {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(logLine) {
        this._logLine = (text) => { };
        this.currentBranch = null;
        this._logLine = logLine;
        const options = {
            baseDir: process.cwd(),
            binary: 'git',
            maxConcurrentProcesses: 6,
            config: []
        };
        this._git = simple_git_1.default(options);
    }
    //------------------------------------------------------------------------------
    // Initialize git access
    //------------------------------------------------------------------------------
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const status = yield this._git.status();
                this.currentBranch = status.current;
            }
            catch (error) {
                throw new ShortStackError(`Git error: ${error.message}`);
            }
            if (!this.currentBranch)
                throw new ShortStackError("ShortStack must be run in a git repo directory.");
        });
    }
    //------------------------------------------------------------------------------
    // Find any uncommitted work
    //------------------------------------------------------------------------------
    checkForDanglingWork() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._git.fetch();
            const status = yield this._git.status();
            if (status.not_added.length > 0
                || status.conflicted.length > 0
                || status.created.length > 0
                || status.deleted.length > 0
                || status.modified.length > 0
                || status.renamed.length > 0
                || status.files.length > 0
                || status.staged.length > 0) {
                throw new ShortStackError(`The current branch (${status.current}) has uncommitted changes.`);
            }
        });
    }
    //------------------------------------------------------------------------------
    // new - create a new stack or new level in the stack
    // usage:  ss new [stackname]
    //------------------------------------------------------------------------------
    new(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.checkForDanglingWork();
            const stackInfo = yield Stack_1.StackInfo.Create(this._git, this.currentBranch);
            if (!options.stackName && !stackInfo.current) {
                throw new ShortStackError("The current branch is not a stacked branch."
                    + "\nUse 'ss list' to see available stacks"
                    + "\nUse 'ss new (stackName)` to create a new stack");
            }
            if (options.stackName) {
                if (stackInfo.current) {
                    throw new ShortStackError("Please switch to a non-stacked branch before creating a new stack.");
                }
                this._logLine("Creating a new stack...");
                const newStack = yield stackInfo.CreateStack(options.stackName);
                this._logLine("Setting up stack level 1...");
                yield newStack.AddLevel();
            }
            this._logLine(chalk_1.default.greenBright("==================================="));
            this._logLine(chalk_1.default.greenBright("---  Your new branch is ready!  ---"));
            this._logLine(chalk_1.default.greenBright("==================================="));
            // write-host "Next steps:"
            // write-host "    1) Keep to a 'single-thesis' change for this branch"
            // write-host "    2) make as many commits as you want"
            // write-host "    3) When your change is finished:"
            // write-host "       ss push   <== pushes your changes up and creates a pull request."
            // write-host "       ss new    <== creates the next branch for a new change.`n`n"
        });
    }
    //------------------------------------------------------------------------------
    // list - show existing stacks
    //------------------------------------------------------------------------------
    list(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const stackInfo = yield Stack_1.StackInfo.Create(this._git, this.currentBranch);
            if (stackInfo.stacks.length == 0) {
                this._logLine("There are no stacks in this repo.");
            }
            else {
                this._logLine("Discovered these stacks:");
                for (const stack of stackInfo.stacks) {
                    this._logLine(`    ${chalk_1.default.whiteBright(stack.name)}  (Tracks: ${stack.parentBranch})`);
                    for (const level of stack.levels) {
                        if (level.levelNumber == 0)
                            continue;
                        this._logLine(chalk_1.default.gray(`        ${level.levelNumber.toString().padStart(3, "0")} ${level.label}`));
                    }
                }
            }
        });
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=CommandHandler.js.map