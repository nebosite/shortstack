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
const Githelper_1 = require("../Helpers/Githelper");
const open_1 = __importDefault(require("open"));
class ShortStackError extends Error {
}
exports.ShortStackError = ShortStackError;
class CommandHandler {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(logger) {
        this.currentBranch = null;
        this._gitBaseURL = "";
        this.logger = logger;
        const options = {
            baseDir: process.cwd(),
            binary: 'git',
            maxConcurrentProcesses: 6,
            config: []
        };
        this._git = simple_git_1.default(options);
        this._initTask = this.init();
    }
    //------------------------------------------------------------------------------
    // Initialize git access
    //------------------------------------------------------------------------------
    init() {
        var _a;
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
            const remoteInfo = yield this._git.remote(["-v"]);
            const originLine = (`${remoteInfo}`).split("\n").find(l => l.startsWith("origin"));
            if (!originLine) {
                throw new ShortStackError("Could not find origin info from remote -v.  Is this directory in a repo?");
            }
            const gitMatch = originLine.match(/\w+?\s+(\w+)@([^:]+):([^\/]+)\/(.*).git/);
            if (!gitMatch) {
                throw new ShortStackError("Could not find remoteInfo for this git repo.");
            }
            const host = `${gitMatch[2]}`;
            const repoParent = `${gitMatch[3]}`;
            const repoName = `${gitMatch[4]}`;
            this._gitBaseURL = `https://${host}/${repoParent}/${repoName}`;
            this._stackInfo = yield Stack_1.StackInfo.Create(this._git, this.currentBranch);
            const envTokenName = "SHORTSTACK_GIT_TOKEN_" + host.replace(/\./g, "_");
            if (!process.env[envTokenName]) {
                throw new ShortStackError(`To use shortstack, ${envTokenName} must be set to a valid git token.`
                    + `\nTo get a token, go here: https://${host}/settings/tokens`
                    + "\nthen generate a new token with all of the 'repo' premissions checked");
            }
            const gitToken = (_a = process.env[envTokenName]) !== null && _a !== void 0 ? _a : "";
            const gitFactory = new Githelper_1.GitFactory(host, "", gitToken);
            this._remoteRepo = yield gitFactory.getRemoteRepo(repoParent, repoName);
        });
    }
    //------------------------------------------------------------------------------
    // new - create a new stack or new level in the stack
    // usage:  ss new [stackname]
    //------------------------------------------------------------------------------
    new(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            yield this.checkForDanglingWork(true);
            if (options.stackName
                && this._stackInfo.current
                && this._stackInfo.current.parent.name.toLowerCase() !== options.stackName.toLowerCase()) {
                throw new ShortStackError(`Cannot create a new stack from existing stack.  Checkout a non-stacked branch and try again.`);
            }
            if (options.stackName) {
                if (this._stackInfo.current) {
                    throw new ShortStackError("Please switch to a non-stacked branch before creating a new stack.");
                }
                this.logger.logLine("Creating a new stack...");
                const newStack = yield this._stackInfo.CreateStack(options.stackName);
                this.logger.logLine("Setting up stack level 1...");
                yield newStack.AddLevel();
                this.logger.logLine(chalk_1.default.greenBright("==================================="));
                this.logger.logLine(chalk_1.default.greenBright("---  Your new statck is ready!  ---"));
                this.logger.logLine(chalk_1.default.greenBright("==================================="));
            }
            else {
                yield this.next({});
            }
        });
    }
    //------------------------------------------------------------------------------
    // list - show existing stacks
    //------------------------------------------------------------------------------
    list(options) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            if (this._stackInfo.stacks.length == 0) {
                this.logger.logLine("There are no stacks in this repo.");
            }
            else {
                this.logger.logLine("Discovered these stacks:");
                for (const stack of this._stackInfo.stacks) {
                    const sameStack = stack.name === ((_b = (_a = this._stackInfo.current) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.name);
                    const stackHighlight = sameStack ? chalk_1.default.greenBright : (t) => t;
                    this.logger.logLine(chalk_1.default.gray(stackHighlight(`    ${stack.name}  (Tracks: ${stack.sourceBranch})`)));
                    for (const level of stack.levels) {
                        const sameLevel = sameStack && level.levelNumber === ((_c = this._stackInfo.current) === null || _c === void 0 ? void 0 : _c.levelNumber);
                        const levelHighlight = sameLevel ? chalk_1.default.greenBright : (t) => t;
                        if (level.levelNumber == 0)
                            continue;
                        this.logger.logLine(chalk_1.default.gray(`        ` + levelHighlight(`${level.levelNumber.toString().padStart(3, "0")} ${level.label}`)));
                    }
                }
            }
        });
    }
    //------------------------------------------------------------------------------
    // status - show current stack status
    //------------------------------------------------------------------------------
    status(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            yield this.checkForDanglingWork(true);
            this.assertCurrentStack();
            const stack = this._stackInfo.current.parent;
            this.logger.logLine(`Current Stack: ${chalk_1.default.cyanBright(stack.name)}  (branched from ${chalk_1.default.cyanBright(stack.sourceBranch)})`);
            for (const level of stack.levels) {
                if (level.levelNumber == 0)
                    continue;
                const levelText = `${level.levelNumber.toString().padStart(3, "0")} ${level.label}`;
                if (level.levelNumber === this._stackInfo.current.levelNumber) {
                    this.logger.logLine(chalk_1.default.whiteBright("    --> " + levelText));
                }
                else {
                    this.logger.logLine(chalk_1.default.gray("        " + levelText));
                }
            }
        });
    }
    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    checkForDanglingWork(shouldThrow = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const unsettledItems = yield this._stackInfo.getDanglingWork();
            if (unsettledItems.length > 0) {
                this.logger.logLine(chalk_1.default.yellow("There is dangling work:"));
                unsettledItems.forEach(i => this.logger.logLine(chalk_1.default.yellow(`    ${i}`)));
                this.logger.logLine();
                if (shouldThrow) {
                    throw new ShortStackError("Cannot continue until dangling items are resolved.");
                }
            }
        });
    }
    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    assertCurrentStack() {
        const currentStackLevel = this._stackInfo.current;
        if (!currentStackLevel) {
            throw new ShortStackError("You are not currently editing a stack."
                + "\n    To see a list of available stacks:                 shortstack list"
                + "\n    To resume editing an existing stack:               shortstack go [stackname]"
                + "\n    To start a new stack off the current git branch:   shortstack new [stackname]");
        }
        return currentStackLevel;
    }
    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    purge(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            yield this.checkForDanglingWork(true);
            if (this._stackInfo.current) {
                throw new ShortStackError("Please run purge from a non-stacked branch.");
            }
            const stacksToPurge = this._stackInfo.stacks.filter(s => ((options.stackName && options.stackName.toLowerCase() === s.name.toLowerCase())
                || options.all));
            if (stacksToPurge.length === 0) {
                this.logger.logLine("Could not find any stacks to purge.  Either specify a stack name or use -all parameter for all stacks.   Use 'shortstack list' to see local stacks.");
                return;
            }
            if (!options.forReal) {
                this.logger.logLine("DRY RUN ONLY.  Use -forreal parameter to actually purge");
            }
            for (const stack of stacksToPurge) {
                for (const l of stack.levels) {
                    this.logger.logLine(`    Purging: ${l.branchName}`);
                    if (options.forReal) {
                        this.logger.logLine(`         Deleting local`);
                        yield this._git.deleteLocalBranch(l.branchName, true);
                    }
                    if (options.remote) {
                        this.logger.logLine(`    Purging: ${l.parent.remoteName}/${l.branchName}`);
                        if (options.forReal) {
                            this.logger.logLine(`         Deleting remote`);
                            yield this._git.push([stack.remoteName, "--delete", l.branchName]);
                        }
                    }
                }
            }
            stacksToPurge.forEach(s => {
                s.levels.forEach(l => {
                });
            });
            if (!options.forReal) {
                this.logger.logLine("DRY RUN ONLY.  Use -forreal parameter to actually purge");
            }
        });
    }
    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    getGitInfo(currentLevel) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingPRs = yield this._remoteRepo.findPullRequests({ sourceBranch: currentLevel.branchName, targetBranch: currentLevel.previousBranchName });
            let currentPr = undefined;
            if (existingPRs) {
                if (existingPRs.length > 0) {
                    currentPr = existingPRs[0];
                }
                if (existingPRs.length > 1) {
                    this.logger.logWarning(`Warning: there is more than 1 PR for this stack level.  Using: ${existingPRs[0].id}`);
                }
            }
            const commitInfo = yield this._stackInfo.getCommitInfo();
            if (commitInfo.behind) {
                throw new ShortStackError("This stack level is missing commits that are on the remote.  Perform a git merge with the remote branch before running this command.");
            }
            return { currentPr, commitInfo };
        });
    }
    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    push(options) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            const currentLevel = yield this.assertCurrentStack();
            yield this.checkForDanglingWork(true);
            const { currentPr, commitInfo } = yield this.getGitInfo(currentLevel);
            if (!((_a = commitInfo.localCommits) === null || _a === void 0 ? void 0 : _a.length)) {
                this.logger.logLine("There are no local commits to push.");
                return;
            }
            this.logger.logLine(`Pushing up the following commits: `);
            commitInfo.localCommits.forEach(c => this.logger.logLine(`    ${c.hash} ${c.message}`));
            yield this._git.push(this._stackInfo.current.parent.remoteName, this._stackInfo.current.branchName);
            let prNumber = 0;
            if (!currentPr) {
                this.logger.logLine("Creating a new PR...");
                const description = commitInfo.localCommits.map(c => c.message).join("\n");
                const title = `SS${currentLevel.levelNumber.toString().padStart(3, "0")}: `
                    + description.split("\n")[0].substring(0, 60);
                const reviewerText = (_b = this._git.getConfig("shortstack.reviewers", "local")) !== null && _b !== void 0 ? _b : this._git.getConfig("shortstack.reviewers", "global");
                const reviewers = reviewerText ? (_c = ((yield reviewerText).value)) === null || _c === void 0 ? void 0 : _c.split(",") : undefined;
                const newPR = yield ((_d = this._remoteRepo) === null || _d === void 0 ? void 0 : _d.createPullRequest(title, description, currentLevel.branchName, currentLevel.previousBranchName, reviewers));
                if (!newPR)
                    throw new ShortStackError("Could not create a new pull request.");
                prNumber = (_e = newPR === null || newPR === void 0 ? void 0 : newPR.number) !== null && _e !== void 0 ? _e : 0;
            }
            else {
                this.logger.logLine("Updating existing PR...");
                prNumber = currentPr.number;
                const description = currentPr.body + "\n\n" + commitInfo.localCommits.map(c => c.message).join("\n");
                yield ((_f = this._remoteRepo) === null || _f === void 0 ? void 0 : _f.updatePullRequest(currentPr.number, description));
            }
            const prURL = `${this._gitBaseURL}/pull/${prNumber}`;
            this.logger.logLine(`Opening PR: ${prURL}`);
            yield open_1.default(prURL);
        });
    }
    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    next(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            const currentLevel = yield this.assertCurrentStack();
            yield this.checkForDanglingWork(true);
            const { currentPr, commitInfo } = yield this.getGitInfo(currentLevel);
            if (!currentPr && commitInfo.localCommits.length === 0) {
                throw new ShortStackError("No work found on the current level.  Commit some code before running this command.");
            }
            yield this.push({});
            this.logger.logLine(`Creating new stack level: ${currentLevel.parent.nextLevelNumber}`);
            yield currentLevel.parent.AddLevel();
            this.logger.logLine(chalk_1.default.greenBright("Success.  New stack level is ready."));
        });
    }
    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    go(options) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            yield this.checkForDanglingWork(true);
            let targetLevel = Number.parseInt((_a = options.level) !== null && _a !== void 0 ? _a : "0");
            let targetStackName = (_e = (_b = options.nameOrLevel) !== null && _b !== void 0 ? _b : ((_d = (_c = this._stackInfo) === null || _c === void 0 ? void 0 : _c.current) === null || _d === void 0 ? void 0 : _d.parent.name)) !== null && _e !== void 0 ? _e : "";
            if (targetStackName === "") {
                throw new ShortStackError("Not on a current stack.  Run 'shortstack list' to see available stacks");
            }
            if ((_f = options.nameOrLevel) === null || _f === void 0 ? void 0 : _f.match(/^\d+$/)) {
                const currentLevel = yield this.assertCurrentStack();
                targetStackName = currentLevel.parent.name;
                targetLevel = Number.parseInt(options.nameOrLevel);
            }
            // Don't move off this stack level if there is uncommitted work
            if (this._stackInfo.current) {
                const { commitInfo } = yield this.getGitInfo(this._stackInfo.current);
                if (commitInfo.localCommits.length > 0) {
                    throw new ShortStackError("There is unpushed work at the current level.  Run 'shortstack push' before switching off this stack.");
                }
            }
            const targetStack = this._stackInfo.stacks.find(s => s.name.toLowerCase() === (targetStackName === null || targetStackName === void 0 ? void 0 : targetStackName.toLowerCase()));
            if (!targetStack) {
                throw new ShortStackError(`Could not find a stack called '${targetStackName}'.  Run 'shortstack list' to see available stacks`);
            }
            if (targetLevel === 0)
                targetLevel = targetStack.nextLevelNumber - 1;
            const level = targetStack.levels.find(l => l.levelNumber === targetLevel);
            if (!level) {
                throw new ShortStackError(`The target stack '${targetStackName}' does not have level ${targetLevel}.  Run 'shortstack list' to see available stacks and levels.`);
            }
            this.logger.logLine(`Changing to stack '${targetStackName}', level ${targetLevel}`);
            yield this._git.checkout([level.branchName]);
        });
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=CommandHandler.js.map