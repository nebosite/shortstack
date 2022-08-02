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
const chalk_1 = __importDefault(require("chalk"));
const CommandHandler_1 = require("./CommandHandler");
const INFO_TAG_NAME = "shortstack_info";
//------------------------------------------------------------------------------
// Helper to generate branch names
//------------------------------------------------------------------------------
function constructStackLevelBranchName(stackName, levelNumber) {
    return `${stackName}/${`${levelNumber}`.padStart(3, "0")}`;
}
//------------------------------------------------------------------------------
// A single level in the stack
//------------------------------------------------------------------------------
class StackItem {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(parent, levelNumber) {
        this.parent = parent;
        this.levelNumber = levelNumber;
    }
    get branchName() { return constructStackLevelBranchName(this.parent.name, this.levelNumber); }
    get previousBranchName() { return constructStackLevelBranchName(this.parent.name, this.levelNumber - 1); }
}
exports.StackItem = StackItem;
//------------------------------------------------------------------------------
// A full set of stacked changes
//------------------------------------------------------------------------------
class Stack {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(git, name, sourceBranch, remoteName) {
        this.levels = new Array();
        this._git = git;
        this.name = name;
        this.sourceBranch = sourceBranch;
        this.remoteName = remoteName;
    }
    get nextLevelNumber() {
        if (this.levels.length > 0) {
            const lastLevel = this.levels[this.levels.length - 1];
            return lastLevel.levelNumber + 1;
        }
        return 0;
    }
    //------------------------------------------------------------------------------
    // Add a level to the current stack
    //------------------------------------------------------------------------------
    AddLevel(sourceBranch) {
        return __awaiter(this, void 0, void 0, function* () {
            let newLevelNumber = this.nextLevelNumber;
            const newBranchName = constructStackLevelBranchName(this.name, newLevelNumber);
            yield this._git.checkout(["-b", newBranchName]);
            if (sourceBranch) {
                const info = { sourceBranch };
                yield this._git.commit(`${INFO_TAG_NAME} ${JSON.stringify(info)}`, ["--allow-empty"]);
            }
            yield this._git.push(["--set-upstream", this.remoteName, newBranchName]);
            const newItem = new StackItem(this, newLevelNumber);
            this.levels.push(newItem);
            this.currentLevel = newItem;
        });
    }
}
exports.Stack = Stack;
//------------------------------------------------------------------------------
// The current state of all local stacks
//------------------------------------------------------------------------------
class StackInfo {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(git) {
        this._stacks = new Map();
        this.remoteName = "origin";
        this._git = git;
    }
    get stacks() { return Array.from(this._stacks.values()); }
    //------------------------------------------------------------------------------
    // discover all the local stacks
    //------------------------------------------------------------------------------
    static Create(git, currentBranch) {
        return __awaiter(this, void 0, void 0, function* () {
            const output = new StackInfo(git);
            const branchSummary = yield git.branchLocal();
            output.remoteName = "origin";
            //TODO: maybe discover remote name like this:  await git.remote([])
            const sortedBranchNames = [];
            for (const branchKey in branchSummary.branches) {
                sortedBranchNames.push(branchKey);
            }
            sortedBranchNames.sort((a, b) => a > b ? 1 : -1);
            for (const branchName of sortedBranchNames) {
                const branchInfo = branchSummary.branches[branchName];
                const match = /(.*?)\/(\d\d\d)$/.exec(branchName);
                if (match) {
                    const stackName = match[1];
                    const levelNumber = parseInt(match[2]);
                    if (levelNumber === 0) {
                        const logDetails = yield git.log(["-n", "1", branchInfo.commit]);
                        const firstCommitMessage = logDetails.all[0].message;
                        if (!firstCommitMessage.startsWith(INFO_TAG_NAME)) {
                            console.log(chalk_1.default.yellowBright(`Warning: No ${INFO_TAG_NAME} commit on stack '${stackName}'`));
                            continue;
                        }
                        const infoObject = JSON.parse(firstCommitMessage.substring(INFO_TAG_NAME.length + 1));
                        output._stacks.set(stackName, new Stack(git, stackName, infoObject.sourceBranch, output.remoteName));
                    }
                    const myStack = output._stacks.get(stackName);
                    if (!myStack) {
                        console.log(chalk_1.default.yellowBright(`Warning: Dangling stack branch '${branchName}'`));
                        continue;
                    }
                    const newLevel = new StackItem(myStack, levelNumber);
                    newLevel.label = branchInfo.label;
                    myStack.levels[levelNumber] = newLevel;
                    if (branchName == currentBranch) {
                        output.current = newLevel;
                        myStack.currentLevel = newLevel;
                    }
                }
            }
            return output;
        });
    }
    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    getStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cachedStatus) {
                return this.cachedStatus;
            }
            if (!this.statusGetter) {
                this.statusGetter = new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                    yield this._git.fetch();
                    this.cachedStatus = yield this._git.status();
                    resolve();
                }));
            }
            yield this.statusGetter;
            return this.cachedStatus;
        });
    }
    //--------------------------------------------------------------------------------------
    // Get a human-readable list of items that are not committed
    //--------------------------------------------------------------------------------------
    getDanglingWork() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.getStatus();
            const output = [];
            result.not_added.forEach(i => output.push(`Not added:     ${i}`));
            result.conflicted.forEach(i => output.push(`Conflicted:    ${i}`));
            result.created.forEach(i => output.push(`Created:       ${i}`));
            result.deleted.forEach(i => output.push(`Deleted:       ${i}`));
            result.modified.forEach(i => output.push(`Modified:      ${i}`));
            result.renamed.forEach(i => output.push(`Renamed:       ${i}`));
            result.staged.forEach(i => output.push(`Staged:        ${i}`));
            if (result.detached)
                output.push(`The current branch is DETATCHED`);
            return output;
        });
    }
    //--------------------------------------------------------------------------------------
    // getCommitInfo
    //--------------------------------------------------------------------------------------
    getCommitInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.getStatus();
            const localCommits = [];
            if (this.current) {
                const stack = this.current.parent;
                const log = yield this._git.log([`${stack.remoteName}/${this.current.branchName}..HEAD`]);
                log.all.forEach(l => localCommits.push({ hash: l.hash, message: l.message }));
            }
            return {
                behind: result.behind,
                localCommits
            };
        });
    }
    //------------------------------------------------------------------------------
    // Create a brand new stack
    //------------------------------------------------------------------------------
    CreateStack(name, parentBranch) {
        return __awaiter(this, void 0, void 0, function* () {
            name = name.toLowerCase();
            if (!parentBranch) {
                // Get default branch
                const remoteInfo = yield this._git.remote(["show", this.remoteName]);
                if (!remoteInfo)
                    throw new CommandHandler_1.ShortStackError("Could not find remote info.  Please specify a parent branch explicitly. ");
                const match = (/HEAD branch: (\S+)/i).exec(remoteInfo);
                if (!match)
                    parentBranch = "main";
                else
                    parentBranch = match[1].valueOf();
            }
            const newStack = new Stack(this._git, name, parentBranch, this.remoteName);
            this._stacks.set(name, newStack);
            yield newStack.AddLevel(parentBranch);
            this.current = newStack.currentLevel;
            return newStack;
        });
    }
}
exports.StackInfo = StackInfo;
//# sourceMappingURL=Stack.js.map