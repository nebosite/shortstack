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
Object.defineProperty(exports, "__esModule", { value: true });
const RestHelper_1 = require("./RestHelper");
const doNothing = (delay_ms) => {
    return new Promise(resolve => { setTimeout(() => resolve(), delay_ms); });
};
//------------------------------------------------------------------------------
// Convenient Factory for getting git objects
//------------------------------------------------------------------------------
class GitFactory {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(server, apiPrefix, apiToken) {
        this.server = server;
        this.apiToken = apiToken;
        this.apiPrefix = apiPrefix;
    }
    //------------------------------------------------------------------------------
    // get a repo object for a specific repo
    //------------------------------------------------------------------------------
    getRemoteRepo(repoOwner, repoName) {
        return new GitRemoteRepo(this.server, this.apiPrefix, repoOwner, repoName, this.apiToken);
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
    constructor(server, apiPrefix, repoOwner, repoName, apiToken) {
        this.cloneUrl = `git@${server}:${repoOwner}/${repoName}.git`;
        this.name = repoName;
        this.owner = repoOwner;
        this.apiToken = apiToken;
        this._graphQLApi = new RestHelper_1.RestHelper(`https://${server}/api/graphql`, undefined, apiPrefix);
        this._graphQLApi.addHeader("Authorization", "token " + this.apiToken);
        const endPoint = server.toLowerCase() === "github.com"
            ? `https://api.github.com/`
            : `https://${server}/api/v3/`;
        this._gitApiHelper = new RestHelper_1.RestHelper(endPoint, undefined, apiPrefix);
        this._gitApiHelper.addHeader("Authorization", "token " + this.apiToken);
    }
    get repoApi() { return `repos/${this.owner}/${this.name}`; }
    get contentsApi() { return `${this.repoApi}/contents`; }
    get tagsApi() { return `${this.repoApi}/tags`; }
    get searchApi() { return `search/issues`; }
    //------------------------------------------------------------------------------
    // Get tags on this reqpo
    //------------------------------------------------------------------------------
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this._gitApiHelper.restGet(`repos/${this.owner}/${this.name}`);
            if (result.name !== this.name)
                throw new Error(`Unexpected repo name: ${result.name}`);
        });
    }
    //------------------------------------------------------------------------------
    // Get tags on this reqpo
    //------------------------------------------------------------------------------
    findTag(regex) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let page = 0; page < 1000; page++) {
                const result = yield this._gitApiHelper.restGet(`${this.tagsApi}?per_page=100&page=` + page);
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
            return yield this._gitApiHelper.restGet(`${this.contentsApi}${path}?ref=${branchOrSha}&per_page=1`);
        });
    }
    //------------------------------------------------------------------------------
    // Return git content details for a file
    //------------------------------------------------------------------------------
    getPullRequest(prNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const returnMe = yield this._gitApiHelper.restGet(`${this.repoApi}/pulls/${prNumber}`);
            if (!returnMe)
                return null;
            const codeComments = yield this._gitApiHelper.restGet(`${this.repoApi}/pulls/${prNumber}/comments`);
            const prComments = yield this._gitApiHelper.restGet(`${this.repoApi}/issues/${prNumber}/comments`);
            returnMe.all_commits = yield this._gitApiHelper.restGet(`${this.repoApi}/pulls/${prNumber}/commits`);
            returnMe.reviews = yield this._gitApiHelper.restGet(`${this.repoApi}/pulls/${prNumber}/reviews`);
            if (returnMe.reviews) {
                const meaningfulReviews = returnMe.reviews.filter(r => r.body !== "" || r.state !== "COMMENTED");
                returnMe.reviews = meaningfulReviews ? meaningfulReviews : null;
            }
            let allComments = new Array();
            if (codeComments)
                allComments = allComments.concat(codeComments);
            if (prComments)
                allComments = allComments.concat(prComments);
            returnMe.all_comments = allComments;
            return returnMe;
        });
    }
    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    createPullRequest(title, description, sourceBranch, targetBranch, reviewers = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = {
                title,
                body: description,
                head: sourceBranch,
                base: targetBranch
            };
            const resp = yield this._gitApiHelper.restPost(`${this.repoApi}/pulls`, JSON.stringify(body));
            if (reviewers) {
                try {
                    console.log(`Adding default reviewers: ${reviewers.join(", ")}`);
                    let tries = 0;
                    while (true) {
                        try {
                            yield this._gitApiHelper.restPost(
                            // `${this.repoApi}/issues/${resp.number}/assignees`, 
                            `${this.repoApi}/pulls/${resp.number}/requested_reviewers`, JSON.stringify({ reviewers }));
                            break;
                        }
                        catch (err) {
                            tries++;
                            if (tries > 3) {
                                throw Error(`Ran out of retires on error: ${err.message}`);
                            }
                            yield doNothing(tries * 1000);
                        }
                    }
                }
                catch (err) {
                    console.log(`ERROR adding reviewers: ${err.message}`);
                }
            }
            return resp;
        });
    }
    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    updatePullRequest(number, description) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = {
                body: description,
            };
            const resp = yield this._gitApiHelper.restPatch(`${this.repoApi}/pulls/${number}`, JSON.stringify(body));
            return resp;
        });
    }
    //------------------------------------------------------------------------------
    // Return all the pull requests
    // Filter options:
    //      involvesUser:  return all prs that involve the specified user
    //------------------------------------------------------------------------------
    findPullRequests(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = "?per_page=50&q=type:pr+sort:updated-desc";
            if (filter.involvesUser)
                query += `+involves:${filter.involvesUser}`;
            if (filter.sourceBranch)
                query += `+head:${filter.sourceBranch}`;
            if (filter.targetBranch)
                query += `+base:${filter.targetBranch}`;
            const response = yield this._gitApiHelper.restGet(`${this.searchApi}${query}`);
            if (!response)
                return null;
            return response.items;
        });
    }
    //------------------------------------------------------------------------------
    // Get PR Reviews
    //------------------------------------------------------------------------------
    getReviews(pr) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = `${this.repoApi}/pulls/${pr.number}/reviews`;
            const response = yield this._gitApiHelper.restGet(query);
            if (!response)
                return [];
            return response;
        });
    }
    //------------------------------------------------------------------------------
    // Return the children of a specifice node path
    //------------------------------------------------------------------------------
    getNodeChildren(branchOrSha, path) {
        return __awaiter(this, void 0, void 0, function* () {
            const output = new Array();
            if (!path.startsWith("/"))
                path = "/" + path;
            for (let page = 0; page < 1000; page++) {
                const result = yield this._gitApiHelper.restGet(`${this.contentsApi}${path}?ref=${branchOrSha}&per_page=100&page=` + page);
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
            if (!result)
                return null;
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