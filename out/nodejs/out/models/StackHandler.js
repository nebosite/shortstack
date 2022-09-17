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
const simple_git_1 = __importDefault(require("simple-git"));
class ShortStackError extends Error {
}
exports.ShortStackError = ShortStackError;
class CommandHandler {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(logLine) {
        this._logLine = (text) => { };
        this._logLine = logLine;
        const options = {
            baseDir: process.cwd(),
            binary: 'git',
            maxConcurrentProcesses: 6,
        };
        this._git = simple_git_1.default(options);
    }
    //------------------------------------------------------------------------------
    // Initialize git access
    //------------------------------------------------------------------------------
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this._git.remote;
            try {
                this._status = yield this._git.status();
            }
            catch (error) {
                throw new ShortStackError(`Git error: ${error.message}`);
            }
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
            // Get a list of all the stacks
            // if options.name is null, then figure out the current stack and level
            // if not stacked: Error "Current branch is not a stacked branch.  To start a stack:  ss new (name) (origin branch to track)"
            // if there is a name
            // Error if the stack exists
            // Create level 0 to track the origin (default to main or master) and push to origin/0  
            // Branch name is name/__stack/0
            // tracking branch is origin/main(or other)
            // Push 0 to server
            // Set current stack object to 0
            //     git branch $newBranch --track $origin *> $null
            //     git checkout $newBranch   *> $null
            //     $pullResult = git_pull $origin
            //     [void](check_for_good_git_result $pullResult)
            //     $pushResult = git_push origin $newBranch
            //     [void](check_for_good_git_result $pushResult)
            // Create next stack level
            // Create branch n+1 to track n and push to origin n+1
            // write-host -ForegroundColor Green "==================================="
            // write-host -ForegroundColor Green "---  Your new branch is ready!  ---"
            // write-host -ForegroundColor Green "==================================="
            // write-host "Next steps:"
            // write-host "    1) Keep to a 'single-thesis' change for this branch"
            // write-host "    2) make as many commits as you want"
            // write-host "    3) When your change is finished:"
            // write-host "       ss push   <== pushes your changes up and creates a pull request."
            // write-host "       ss new    <== creates the next branch for a new change.`n`n"
            this._logLine(`NEW: ${options.stackName}, ${options.root}`);
        });
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=StackHandler.js.map