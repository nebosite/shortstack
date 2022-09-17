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
const RestHelper_1 = require("./RestHelper");
//------------------------------------------------------------------------------
// Convenient Factory for getting git objects
//------------------------------------------------------------------------------
class GitFactory {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(server, apiToken) {
        this.server = server;
        this.apiToken = apiToken;
    }
    //------------------------------------------------------------------------------
    // get a repo object for a specific repo
    //------------------------------------------------------------------------------
    getRemoteRepo(repoOwner, repoName) {
        return new GitRemoteRepo(this.server, repoOwner, repoName, this.apiToken);
    }
}
exports.GitFactory = GitFactory;
//------------------------------------------------------------------------------
// Access git repository
// see https://developer.github.com/v3/
//------------------------------------------------------------------------------
class GitRemoteRepo {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(server, repoOwner, repoName, apiToken) {
        this.cloneUrl = `git@${server}:${repoOwner}/${repoName}.git`;
        this.name = repoName;
        this.owner = repoOwner;
        this.apiToken = apiToken;
        this._graphQLApi = new RestHelper_1.RestHelper(`https://${server}/api/graphql`);
        this._graphQLApi.addHeader("Authorization", "token " + this.apiToken);
        this._gitApiHelper = new RestHelper_1.RestHelper(`https://${server}/api/v3/repos/${repoOwner}/${repoName}`);
        this._gitApiHelper.addHeader("Authorization", "token " + this.apiToken);
    }
    //------------------------------------------------------------------------------
    // Get tags on this reqpo
    //------------------------------------------------------------------------------
    findTag(regex) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let page = 0; page < 1000; page++) {
                const result = yield this._gitApiHelper.restGet("/tags?per_page=100&page=" + page);
                if (!result)
                    break;
                for (const tag of result) {
                    if (regex.exec(tag.name))
                        return tag;
                }
                if (result.length < 100)
                    break;
            }
            return undefined;
        });
    }
    //------------------------------------------------------------------------------
    // Return git content details for a file
    //------------------------------------------------------------------------------
    getFile(branchOrSha, path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!path.startsWith("/"))
                path = "/" + path;
            return yield this._gitApiHelper.restGet(`/contents${path}?ref=${branchOrSha}&per_page=1`);
        });
    }
    //------------------------------------------------------------------------------
    // Return git content details for a directory
    //------------------------------------------------------------------------------
    getNodeChildren(branchOrSha, path) {
        return __awaiter(this, void 0, void 0, function* () {
            const output = new Array();
            if (!path.startsWith("/"))
                path = "/" + path;
            for (let page = 0; page < 1000; page++) {
                const result = yield this._gitApiHelper.restGet(`/contents${path}?ref=${branchOrSha}&per_page=100&page=` + page);
                if (!result)
                    break;
                for (const item of result) {
                    output.push(item);
                }
                if (result.length < 100)
                    break;
            }
            return output;
        });
    }
    //------------------------------------------------------------------------------
    // Get text contents
    //------------------------------------------------------------------------------
    getTextContents(branchOrSha, relativePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `query {
            repository(name: ${JSON.stringify(this.name)}, owner: ${JSON.stringify(this.owner)}) {
              object(expression: ${JSON.stringify(branchOrSha + ":" + relativePath)}) {
                    ... on Blob {
                      text
                    }
                  }
            }
          }
        `;
            //console.log(query);
            const result = yield this._graphQLApi.restPost("", JSON.stringify({ query }));
            //console.log(JSON.stringify(result));
            return result.data.repository.object.text;
        });
    }
    //------------------------------------------------------------------------------
    // Return the first commit with a message that matches the regex
    // path: specify this to limit the commit search to a certain file
    //------------------------------------------------------------------------------
    processCommitHistory(startPath, processCommit) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryTemplate = `query {
            repository(name: ${JSON.stringify(this.name)}, owner: ${JSON.stringify(this.owner)}) {
                defaultBranchRef {
                    target {
                      ... on Commit {
                        history(##HISTORY_PARAMS##) {
                          edges {
                            node {
                              committedDate
                              message
                              oid
                            }
                          }
                        }
                      }
                    }
                  }
                }
            }
        `;
            let lastCommitTimestamp;
            const pageSize = 50;
            // Search through commit history 
            while (true) {
                let historyPart = `first: ${pageSize}`;
                if (startPath && startPath !== "")
                    historyPart += `, path: ${JSON.stringify(startPath)}`;
                if (lastCommitTimestamp)
                    historyPart += `, until: ${JSON.stringify(lastCommitTimestamp)}`;
                const query = queryTemplate.replace("##HISTORY_PARAMS##", historyPart);
                const result = yield this._graphQLApi.restPost("", JSON.stringify({ query }));
                let count = 0;
                for (const edge of result.data.repository.defaultBranchRef.target.history.edges) {
                    if (edge.node.committedDate === lastCommitTimestamp)
                        continue;
                    count++;
                    if (!processCommit(edge.node))
                        return;
                    lastCommitTimestamp = edge.node.committedDate;
                }
                if (!count)
                    break;
            }
        });
    }
}
exports.GitRemoteRepo = GitRemoteRepo;
//# sourceMappingURL=Githelper.js.map