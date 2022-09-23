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
Object.defineProperty(exports, "__esModule", { value: true });
const CommandHandler_1 = require("./CommandHandler");
//------------------------------------------------------------------------------
// Helper to generate branch names
//------------------------------------------------------------------------------
function constructStackLevelBranchName(stackName, levelNumber) {
    return `${stackName}/_ss/${`${levelNumber}`.padStart(3, "0")}`;
}
//------------------------------------------------------------------------------
// A single level in the stack
//------------------------------------------------------------------------------
class StackItem {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(parent, levelNumber, trackingBranch) {
        this.parent = parent;
        this.levelNumber = levelNumber;
        this.trackingBranch = trackingBranch;
    }
    get branchName() { return constructStackLevelBranchName(this.parent.name, this.levelNumber); }
}
exports.StackItem = StackItem;
//------------------------------------------------------------------------------
// A full set of stacked changes
//------------------------------------------------------------------------------
class Stack {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(git, name, parentBranch, remoteName) {
        this.levels = new Array();
        this._git = git;
        this.name = name;
        this.parentBranch = parentBranch;
        this.remoteName = remoteName;
    }
    //------------------------------------------------------------------------------
    // Add a level to the current stack
    //------------------------------------------------------------------------------
    AddLevel() {
        return __awaiter(this, void 0, void 0, function* () {
            let trackingBranch = this.parentBranch;
            let newLevelNumber = 0;
            if (this.levels.length > 0) {
                const lastLevel = this.levels[this.levels.length - 1];
                newLevelNumber = lastLevel.levelNumber + 1;
                trackingBranch = lastLevel.branchName;
            }
            const newBranchName = constructStackLevelBranchName(this.name, newLevelNumber);
            yield this._git.branch([newBranchName, "--track", trackingBranch]);
            yield this._git.checkout(newBranchName);
            yield this._git.pull();
            yield this._git.push(this.remoteName, newBranchName);
            const newItem = new StackItem(this, newLevelNumber, trackingBranch);
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
            for (const branchKey in branchSummary.branches) {
                const branchInfo = branchSummary.branches[branchKey];
                const match = /(.*?)\/_ss\/(\d\d\d)$/.exec(branchKey);
                if (match) {
                    const stackName = match[1];
                    const levelNumber = parseInt(match[2]);
                    const config = yield git.listConfig();
                    let trackingBranch = config.values[".git/config"][`branch.${branchKey}.merge`];
                    trackingBranch = trackingBranch.replace("refs/heads/", "");
                    let remoteName = yield output.remoteName;
                    if (!output._stacks.get(stackName)) {
                        output._stacks.set(stackName, new Stack(git, stackName, trackingBranch, remoteName));
                    }
                    const myStack = output._stacks.get(stackName);
                    const newLevel = new StackItem(myStack, levelNumber, trackingBranch);
                    newLevel.label = branchInfo.label;
                    myStack.levels[levelNumber] = newLevel;
                    if (branchKey == currentBranch) {
                        output.current = newLevel;
                        myStack.currentLevel = newLevel;
                    }
                }
            }
            return output;
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
                    throw new CommandHandler_1.ShortStackError("Could not find remote info.  Please specify a tracking branch explicitly. ");
                const match = (/HEAD branch: (\S+)/i).exec(remoteInfo);
                if (!match)
                    parentBranch = "master";
                else
                    parentBranch = match[1].valueOf();
            }
            const newStack = new Stack(this._git, name, parentBranch, this.remoteName);
            this._stacks.set(name, newStack);
            yield newStack.AddLevel();
            this.current = newStack.currentLevel;
            return newStack;
        });
    }
}
exports.StackInfo = StackInfo;
//# sourceMappingURL=Stack.js.map