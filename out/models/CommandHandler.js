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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const simple_git_1 = __importDefault(require("simple-git"));
const Stack_1 = require("./Stack");
const chalk_1 = __importDefault(require("chalk"));
const Githelper_1 = require("../Helpers/Githelper");
const open_1 = __importDefault(require("open"));
const ping = __importStar(require("ping"));
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
            let gitMatch = originLine.match(/\w+?\s+(\w+)@([^:]+):([^\/]+)\/(.*).git/i);
            let host = "unknown";
            let repoParent = "unknown";
            let repoName = "unknown";
            if (gitMatch) {
                host = `${gitMatch[2]}`;
                repoParent = `${gitMatch[3]}`;
                repoName = `${gitMatch[4]}`;
            }
            if (!gitMatch) {
                gitMatch = originLine.match(/https.*\/\/(.+?)\/(.+)\/(.*)\.git/i);
                if (gitMatch) {
                    host = `${gitMatch[1]}`;
                    repoParent = `${gitMatch[2]}`;
                    repoName = `${gitMatch[3]}`;
                }
            }
            if (!gitMatch) {
                throw new ShortStackError(`Could not find remoteInfo for this git repo. (${originLine})`);
            }
            this._gitBaseURL = `https://${host}/${repoParent}/${repoName}`;
            try {
                yield new Promise((resolve, reject) => {
                    ping.sys.probe(host, function (isAlive, err) {
                        if (!isAlive)
                            reject();
                        resolve();
                    }, { timeout: 3 });
                });
            }
            catch (err) {
                throw new ShortStackError(`Could not reach github server: ${host}`);
            }
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
    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    getLevelLabelDetails(level) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = yield this.getGitInfo(level);
            const id = level.levelNumber.toString().padStart(3, "0");
            const label = info.currentPr
                ? `${info.currentPr.title} (${info.currentPr.state})`
                : "** Active **";
            return {
                pr: info.currentPr,
                commits: info.commitInfo,
                id,
                label,
            };
        });
    }
    //------------------------------------------------------------------------------
    // finish - Merge the whole stack as a single PR back to source branch
    //------------------------------------------------------------------------------
    finish(options) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            yield this.checkForDanglingWork(true);
            this.assertCurrentStack();
            const stack = this._stackInfo.current.parent;
            this.logger.logLine(`FINISHING ${stack.name}`);
            this.logger.logLine("    Checking the stack for readiness...");
            let totalErrorCount = 0;
            let syncErrors = 0;
            let approvalErrors = 0;
            const reviewerList = new Map();
            const prInfo = [];
            yield this._git.checkout([stack.sourceBranch]);
            let statusResponse = yield this._git.status();
            for (let stackLevel = 1; stackLevel < stack.levels.length; stackLevel++) {
                let errorCount = 0;
                const err = (message) => {
                    errorCount++;
                    totalErrorCount++;
                    this.logger.logLine("        " + chalk_1.default.redBright(message));
                };
                if (stackLevel === 1) {
                    if (statusResponse.ahead || statusResponse.behind) {
                        err(`Source branch ${stack.sourceBranch} is not in sync with origin. (+${statusResponse.ahead},-${statusResponse.behind})`);
                        syncErrors++;
                    }
                }
                const level = stack.levels[stackLevel];
                this.logger.logLine(`    LEVEL ${level.levelNumber}`);
                this._git.checkout([level.branchName]);
                statusResponse = yield this._git.status();
                if (statusResponse.ahead || statusResponse.behind) {
                    err(`branch ${level.branchName} is not in sync with origin. (+${statusResponse.ahead},-${statusResponse.behind})`);
                    syncErrors++;
                }
                const { currentPr } = yield this.getGitInfo(level);
                if (!currentPr) {
                    err("No PR found for this level (Delete this branch or use 'shortstack push' to create a PR)");
                }
                else {
                    const url = `${this._gitBaseURL}/pull/${currentPr.number}`;
                    prInfo.push({ level: stackLevel, id: currentPr.number, title: currentPr.title, url });
                    const reviews = yield ((_a = this._remoteRepo) === null || _a === void 0 ? void 0 : _a.getReviews(currentPr));
                    let approvers = [];
                    let otherStates = [];
                    reviews === null || reviews === void 0 ? void 0 : reviews.forEach(r => {
                        reviewerList.set(r.user.login, "");
                        switch (r.state) {
                            case "APPROVED":
                                approvers.push(r.user.login);
                                break;
                            case "COMMENTED": break;
                            default: otherStates.push(`${r.state} by ${r.user.login}`);
                        }
                    });
                    if (approvers.length === 0) {
                        err(`The PR has not been approved. (${url})`);
                        approvalErrors++;
                    }
                    else {
                        this.logger.logLine(`        ` + `Approved by ${approvers.join(", ")}` + "  " + chalk_1.default.yellowBright(`${otherStates.join(",")}`));
                    }
                }
                if (!errorCount) {
                    this.logger.logLine("        " + chalk_1.default.greenBright("READY"));
                }
            }
            if (totalErrorCount) {
                const message = ["This stack is not ready for finishing."];
                if (syncErrors)
                    message.push("To fix sync issues, run 'shortstack merge -full`");
                if (approvalErrors)
                    message.push("Make sure all PRs are approved.");
                this.logger.logLine(chalk_1.default.redBright(message.join("\n")));
                return;
            }
            this.logger.logLine("    Preparing final PR...");
            // create a new stack level
            stack.AddLevel();
            let description = `Finished Stack: ${stack.name}\n\n`
                + "This is a stacked pull request built from the list of smaller, approved pull requests listed below. "
                + "This PR does not need an extensive code review because the smaller parts have already been reviewed.  "
                + "Please click on the individual pull requests to see reviewer notes.\n\n ";
            prInfo.forEach(pr => {
                description += `* [${pr.title}](${pr.url})\n`;
            });
            const title = `Finished Stack: ${stack.name}`;
            const reviewerText = (_b = this._git.getConfig("shortstack.reviewers", "local")) !== null && _b !== void 0 ? _b : this._git.getConfig("shortstack.reviewers", "global");
            if (reviewerText) {
                (_c = ((yield reviewerText).value)) === null || _c === void 0 ? void 0 : _c.split(",").forEach(r => reviewerList.set(r, ""));
            }
            const reviewers = Array.from(reviewerList.keys());
            const newPR = yield ((_d = this._remoteRepo) === null || _d === void 0 ? void 0 : _d.createPullRequest(title, description, stack.currentLevel.branchName, stack.sourceBranch, reviewers));
            if (!newPR)
                throw new ShortStackError("Could not create a new pull request.");
            const prNumber = (_e = newPR === null || newPR === void 0 ? void 0 : newPR.number) !== null && _e !== void 0 ? _e : 0;
            const prURL = `${this._gitBaseURL}/pull/${prNumber}`;
            this.logger.logLine(`Opening PR: ${prURL}`);
        });
    }
    //------------------------------------------------------------------------------
    // merge - make the stack consistent
    //------------------------------------------------------------------------------
    merge(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            yield this.checkForDanglingWork(true);
            this.assertCurrentStack();
            const stack = this._stackInfo.current.parent;
            this.logger.logLine(`MERGING ${stack.name}`);
            for (let stackLevel = 1; stackLevel < stack.levels.length; stackLevel++) {
                const level = stack.levels[stackLevel];
                let previousBranch = stackLevel === 1
                    ? level.parent.sourceBranch
                    : level.previousBranchName;
                try {
                    // only pull from the source branch if the full flag is given
                    if (stackLevel > 1 || options.full) {
                        this.logger.logLine(`    LEVEL ${level.levelNumber}`);
                        this.logger.logLine(`        Checkout ${previousBranch}`);
                        const checkoutResponse = yield this._git.checkout([previousBranch]);
                        this.logger.logLine(`            ${checkoutResponse.split("\n")[0]}`);
                        this.logger.logLine(`        pull`);
                        const pullResponse = yield this._git.pull();
                        this.logger.logLine(`            Pulled ${pullResponse.summary.changes} changes, ${pullResponse.summary.deletions} deletions, ${pullResponse.summary.insertions} insertions`);
                        this.logger.logLine(`        Checkout ${level.branchName}`);
                        const checkoutResponse2 = yield this._git.checkout([level.branchName]);
                        this.logger.logLine(`            ${checkoutResponse2.split("\n")[0]}`);
                        this.logger.logLine(`        merge  ${previousBranch}`);
                        const mergeResponse = yield this._git.merge([previousBranch]);
                        this.logger.logLine(`            ${mergeResponse.result}`);
                        if (mergeResponse.result !== "success")
                            throw Error("Cannot auto-merge");
                    }
                    else {
                        this.logger.logLine(`        Checkout ${level.branchName}`);
                        const checkoutResponse2 = yield this._git.checkout([level.branchName]);
                        this.logger.logLine(`            ${checkoutResponse2.split("\n")[0]}`);
                    }
                    this.logger.logLine(`        push origin ${level.branchName}`);
                    const pushResponse = yield this._git.push(["origin", level.branchName]);
                    if (pushResponse.remoteMessages.all.length === 0) {
                        this.logger.logLine(`            success`);
                    }
                    else {
                        throw Error(pushResponse.remoteMessages.all.join("\n"));
                    }
                }
                catch (err) {
                    this.logger.logLine(chalk_1.default.yellowBright(`${err}.\nPlease fix by hand and rerun the command.`));
                    return;
                }
            }
        });
    }
    //------------------------------------------------------------------------------
    // list - show existing stacks
    //------------------------------------------------------------------------------
    list(options) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            if (this._stackInfo.stacks.length == 0) {
                this.logger.logLine("There are no stacks in this repo.");
            }
            else {
                this.logger.logLine("Discovered these stacks:");
                for (const stack of this._stackInfo.stacks) {
                    const sameStack = stack.name === ((_b = (_a = this._stackInfo.current) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.name);
                    let stackHighlight = sameStack
                        ? (t) => chalk_1.default.whiteBright(chalk_1.default.bgGreen(t))
                        : (t) => chalk_1.default.white(t);
                    this.logger.logLine("    " + stackHighlight(`${stack.name}  (Tracks: ${stack.sourceBranch})`));
                    for (const level of stack.levels) {
                        if (level.levelNumber == 0)
                            continue;
                        const sameLevel = sameStack && level.levelNumber === ((_c = this._stackInfo.current) === null || _c === void 0 ? void 0 : _c.levelNumber);
                        const details = yield this.getLevelLabelDetails(level);
                        let levelHighlight = (t) => chalk_1.default.green(t);
                        if (((_d = details.pr) === null || _d === void 0 ? void 0 : _d.state) !== "open")
                            levelHighlight = chalk_1.default.blackBright;
                        if (sameLevel)
                            levelHighlight = (t) => chalk_1.default.whiteBright(chalk_1.default.bgGreen(t));
                        this.logger.logLine(`        ` + levelHighlight(`${details.id} ${details.label}`));
                    }
                }
            }
        });
    }
    //------------------------------------------------------------------------------
    // fetch - get stacks from origin
    //------------------------------------------------------------------------------
    fetch(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._initTask;
            yield this.checkForDanglingWork(true);
            const remoteStacks = new Map();
            const result = yield this._git.branch(["-l", "-a"]);
            for (let branchName of result.all) {
                const match = branchName.match(/remotes\/origin\/(.+)\/\d\d\d/i);
                if (match) {
                    const name = match[1];
                    if (!remoteStacks.has(name)) {
                        remoteStacks.set(name, []);
                    }
                    remoteStacks.get(name).push(branchName.replace("remotes/origin/", ""));
                }
            }
            if (!options.stackName) {
                this.logger.logLine("Finding stacks available...");
                Array.from(remoteStacks.keys()).forEach(s => this.logger.logLine(`    ${s} (${remoteStacks.get(s).length - 1} levels)`));
                if (remoteStacks.size === 0) {
                    this.logger.logLine(chalk_1.default.yellowBright("    No stacks were found on the remote repo."));
                }
                this.logger.logLine("Run 'shortstack fetch [stackname]' to retrieve remote stack.");
            }
            else {
                this.logger.logLine(`Fetching remote stack ${options.stackName}`);
                const levels = remoteStacks.get(options.stackName);
                if (!levels) {
                    throw new ShortStackError(`'${options.stackName}' is not a known stack name.  Run 'shortstack fetch' to see a list of available stacks.`);
                }
                for (let level of levels) {
                    this.logger.logLine(`    ${level}`);
                    const checkoutResponse = yield this._git.checkout([level]);
                    if (checkoutResponse != "" && !checkoutResponse.match(/(up to date|branch is behind|set up to track)/ig)) {
                        this.logger.logError(`        Checkout error: ${checkoutResponse}`);
                    }
                    else {
                        const pullResponse = yield this._git.pull();
                        const remoteMessages = pullResponse.remoteMessages.all.join("\n        ");
                        if (remoteMessages != "") {
                            this.logger.logError(`        Pull error: ${remoteMessages}`);
                        }
                    }
                }
                this.logger.logLine("It might be a good idea to run 'shortstack merge' to make sure stack is consistent.");
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
                const details = yield this.getLevelLabelDetails(level);
                const levelText = `${details.id} ${details.label}`;
                let highlight = (t) => chalk_1.default.gray(t);
                let prefix = "        ";
                if (level.levelNumber === this._stackInfo.current.levelNumber) {
                    highlight = (t) => chalk_1.default.whiteBright(t);
                    prefix = "    --> ";
                }
                this.logger.logLine(highlight(prefix + levelText));
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
                    this.logger.logWarning(`Warning: there is more than 1 PR for this stack level.  Using: ${existingPRs[0].number}`);
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
            let targetStack = this._stackInfo.stacks.find(s => s.name.toLowerCase() === (targetStackName === null || targetStackName === void 0 ? void 0 : targetStackName.toLowerCase()));
            if (!targetStack) {
                const matcher = new RegExp(targetStackName, "i");
                const otherStacks = this._stackInfo.stacks.filter(s => matcher.exec(s.name) ? true : false);
                if (otherStacks.length === 1) {
                    targetStack = otherStacks[0];
                }
            }
            if (!targetStack) {
                const stackNames = this._stackInfo.stacks.map(s => s.name);
                throw new ShortStackError(`Could not find a stack called '${targetStackName}'.\nAvailable stacks:\n    ${stackNames.join('\n    ')}\nRun 'shortstack list' to see more info on stacks`);
            }
            if (targetLevel === 0)
                targetLevel = targetStack.nextLevelNumber - 1;
            const level = targetStack.levels.find(l => l.levelNumber === targetLevel);
            if (!level) {
                throw new ShortStackError(`The target stack '${targetStackName}' does not have level ${targetLevel}.  Run 'shortstack list' to see available stacks and levels.`);
            }
            this.logger.logLine(`Changing to branch '${level.branchName}'`);
            yield this._git.checkout([level.branchName]);
        });
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=CommandHandler.js.map