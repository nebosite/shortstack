import { RestHelper } from "./RestHelper";


const doNothing  = (delay_ms: number) =>
{
    return new Promise<void>(resolve => {setTimeout(()=> resolve(),delay_ms)})
}

export interface GitCommit
{
    sha: string;
    node_id: string;
    commit: {
       author: { name: string; email: string; date: string; },
       committer: { name: string; email: string; date: string; },
       message: string;
       tree: { sha: string; url: string; },
       url: string;
       comment_count: number;
       verification: { verified: boolean; reason: string; signature: string; payload: string; }
    };
    url: string;
    html_url: string;
    comments_url: string;
    author: GitUser;
    committer: GitUser;
    parents: {sha: string; url: string; html_url: string;}[]
}

export interface GitReview
{
    id: number;
    node_id: string;
    user: GitUser;
    body: string;
    state: string;
    html_url: string;
    pull_request_url: string;
    author_association: string;
    _links: any;
    //  {
    //     "html": {
    //         "href": "https://git.corp.adobe.com/WebPA/sparkler-shell/pull/53561#pullrequestreview-3230325"
    //     },
    //     "pull_request": {
    //         "href": "https://git.corp.adobe.com/api/v3/repos/WebPA/sparkler-shell/pulls/53561"
    //     }
    // },
    submitted_at: string;
    commit_id: string;
}
export interface GitComment
{
    url: string;
    pull_request_review_id: number;
    id: number;
    node_id: string;
    diff_hunk: string;
    path: string;
    position: number;
    original_position: number;
    commit_id: string;
    original_commit_id: string;
    user: GitUser;
    body: string;
    created_at: string;
    updated_at: string;
    html_url: string;
    issue_url: string;
    pull_request_url: string;
    author_association: string;
    in_reply_to_id: number;
    _links: any;
    //  {
    //     "self": {
    //         "href": "https://git.corp.adobe.com/api/v3/repos/ejorgens/learning/pulls/comments/3218873"
    //     },
    //     "html": {
    //         "href": "https://git.corp.adobe.com/ejorgens/learning/pull/11#discussion_r3218873"
    //     },
    //     "pull_request": {
    //         "href": "https://git.corp.adobe.com/api/v3/repos/ejorgens/learning/pulls/11"
    //     }
    // }
}
export interface GitTag
{
    name: string;
    zipball_url: string;
    tarball_url: string;
    commit: { sha: string; url: string; };
    node_id: string;
}

export interface GitNodeData
{
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string | null;
    type: string;
    submodule_git_url: string;
    _links: {
      self: string;
      git: string;
      html: string;
  }
}

export interface GitUser {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    html_url: string;
    type: string;
    site_admin: boolean;
}

export interface GitRepo {
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
    owner: GitUser;
    html_url: string;
    description: string;
    fork: boolean;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    git_url: string;
    ssh_url: string;
    clone_url: string;
    svn_url: string;
    homepage: string;
    size: number;
    stargazers_count: number;
    watchers_count: number;
    language: string;
    has_issues: boolean;
    has_projects: boolean;
    has_downloads: boolean;
    has_wiki: boolean;
    has_pages: boolean;
    forks_count: number;
    mirror_url: string;
    archived: boolean;
    disabled: boolean;
    open_issues_count: number;
    license: string;
    forks: number;
    open_issues: number;
    watchers: number;
    default_branch: string;
}

export interface GitPosition {
    label: string;
    ref: string;
    sha: string;
    user: GitUser;
    repo: GitRepo;
}

export interface GitPullRequest {
    id: number;
    node_id: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
    issue_url: string;
    repository_url: string,
    number: number;
    state: string;
    locked: boolean;
    title: string;
    user: GitUser;
    
    body: string;
    created_at: string;
    updated_at: string;
    closed_at: string;
    merged_at: string;
    merge_commit_sha: string;
    assignee: GitUser;
    assignees: GitUser[];
    requested_reviewers: GitUser[];

    requested_teams: any[];
    labels: any[];
        // {
        //     "id": 1294108,
        //     "node_id": "MDU6TGFiZWwxMjk0MTA4",
        //     "url": "https://git.corp.adobe.com/api/v3/repos/WebPA/sparkler-shell/labels/Team:Foundation-US",
        //     "name": "Team:Foundation-US",
        //     "color": "c2e0c6",
        //     "default": false
        // }
    
    milestone: string;
    head: GitPosition;
    base: GitPosition;
    _links: any;
    author_association: string;
    merged: boolean;
    mergeable: boolean;
    rebaseable: boolean;
    mergeable_state: string;
    merged_by: GitUser;
    comments: number;
    review_comments: number;
    maintainer_can_modify: boolean;
    commits: number;
    additions: number;
    deletions: number;
    changed_files: number; 

    // Added later from another query
    all_comments: GitComment[] | null;
    all_commits: GitCommit[] | null;
    reviews: GitReview[] | null;
}

interface GitSearchResponse
{
    total_count: number;
    incomplete_results: boolean;
    items: any[];
}



//------------------------------------------------------------------------------
// Convenient Factory for getting git objects
//------------------------------------------------------------------------------
export class GitFactory
{
    server: string;
    apiToken: string;
    apiPrefix: string;

    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor (server: string, apiPrefix: string, apiToken: string)
    {
        this.server = server;
        this.apiToken = apiToken;
        this.apiPrefix = apiPrefix;
    }

    //------------------------------------------------------------------------------
    // get a repo object for a specific repo
    //------------------------------------------------------------------------------
    getRemoteRepo(repoOwner: string, repoName: string)
    {
        return new GitRemoteRepo(this.server, this.apiPrefix, repoOwner, repoName, this.apiToken);
    }
}

export interface PRSearchFilter {
    involvesUser?: string
    sourceBranch?: string
    targetBranch?: string
}

//------------------------------------------------------------------------------
// Access git repository
// see https://developer.github.com/v3/
//------------------------------------------------------------------------------
export class GitRemoteRepo
{
    owner: string;
    name: string;
    apiToken: string;
    cloneUrl: string;
    _graphQLApi: RestHelper;
    _gitApiHelper: RestHelper;

    get repoApi() {return `repos/${this.owner}/${this.name}`}
    get contentsApi() {return `${this.repoApi}/contents`}
    get tagsApi() {return `${this.repoApi}/tags`}
    get searchApi() {return `search/issues`}

    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor (server: string, apiPrefix: string, repoOwner: string, repoName: string, apiToken: string)
    {
        this.cloneUrl = `git@${server}:${repoOwner}/${repoName}.git`
        this.name = repoName;
        this.owner = repoOwner;
        this.apiToken = apiToken;

        this._graphQLApi = new RestHelper(`https://${server}/api/graphql`, undefined, apiPrefix)
        this._graphQLApi.addHeader("Authorization", "token " + this.apiToken);

        const endPoint = server.toLowerCase() === "github.com"  
            ? `https://api.github.com/`
            : `https://${server}/api/v3/`

        this._gitApiHelper = new RestHelper(endPoint, undefined, apiPrefix);
        this._gitApiHelper.addHeader("Authorization", "token " + this.apiToken);
    }

    //------------------------------------------------------------------------------
    // Get tags on this reqpo
    //------------------------------------------------------------------------------
    async testConnection() {
        const result = await this._gitApiHelper.restGet<any>(`repos/${this.owner}/${this.name}`)
        if(result.name !== this.name) throw new Error(`Unexpected repo name: ${result.name}`)
    }

    //------------------------------------------------------------------------------
    // Get tags on this reqpo
    //------------------------------------------------------------------------------
    async findTag(regex: RegExp): Promise<GitTag | undefined>
    {
        for(let page = 0; page < 1000; page++)
        {
            const result = await this._gitApiHelper.restGet<GitTag[]>(`${this.tagsApi}?per_page=100&page=` + page);
            if(!result) break;
            for(const tag of result)
            {
                if(regex.exec(tag.name)) return tag;
            }
            if(result.length < 100) break;
        }
        return undefined;
    }

    //------------------------------------------------------------------------------
    // Return git content details for a file
    //------------------------------------------------------------------------------
    async getFile(branchOrSha: string, path: string): Promise<GitNodeData | null>
    {
        if(!path.startsWith("/")) path = "/" + path;

        return await this._gitApiHelper.restGet<GitNodeData>(`${this.contentsApi}${path}?ref=${branchOrSha}&per_page=1`);
    }

    //------------------------------------------------------------------------------
    // Return git content details for a file
    //------------------------------------------------------------------------------
    async getPullRequest(prNumber: number | string): Promise<GitPullRequest | null>
    {
        const returnMe = await this._gitApiHelper.restGet<GitPullRequest>(`${this.repoApi}/pulls/${prNumber}`);
        if(!returnMe) return null;
        const codeComments = await this._gitApiHelper.restGet<GitComment[]>(`${this.repoApi}/pulls/${prNumber}/comments`)
        const prComments = await this._gitApiHelper.restGet<GitComment[]>(`${this.repoApi}/issues/${prNumber}/comments`)
        returnMe.all_commits = await this._gitApiHelper.restGet<GitCommit[]>(`${this.repoApi}/pulls/${prNumber}/commits`)
        returnMe.reviews = await this._gitApiHelper.restGet<GitReview[]>(`${this.repoApi}/pulls/${prNumber}/reviews`);
        if(returnMe.reviews)
        {
            const meaningfulReviews = returnMe.reviews.filter(r => r.body !== "" || r.state !== "COMMENTED");
            returnMe.reviews = meaningfulReviews ? meaningfulReviews : null;
        }
        let allComments = new Array<GitComment>();
        if(codeComments) allComments = allComments.concat(codeComments);
        if(prComments) allComments = allComments.concat(prComments);
        returnMe.all_comments = allComments;
        return returnMe;
    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    async createPullRequest(title: string, description: string, sourceBranch: string, targetBranch: string, reviewers: string[] | undefined = undefined) {
        const body = {
            title,
            body: description,
            head: sourceBranch,
            base: targetBranch
        }

        const resp = await this._gitApiHelper.restPost<GitPullRequest>(
            `${this.repoApi}/pulls`, 
            JSON.stringify(body)
        )

        if(reviewers) {
            try {
                console.log(`Adding default reviewers: ${reviewers.join(", ")}`)
                let tries = 0;
                while(true) {
                    try {
                        await this._gitApiHelper.restPost<GitPullRequest>(
                            // `${this.repoApi}/issues/${resp.number}/assignees`, 
                            `${this.repoApi}/pulls/${resp.number}/requested_reviewers`, 
                            JSON.stringify({reviewers})
                        )      
                        break;            
                    }
                    catch(err) {
                        tries++;
                        if(tries > 3) {
                            throw Error(`Ran out of retires on error: ${(err as any).message}`)
                        }

                        await doNothing(tries * 1000)
                    }
                }
            }
            catch(err) {
                console.log(`ERROR adding reviewers: ${(err as any).message}`)
            }
        }
       
        return resp  as GitPullRequest;
    }

    //--------------------------------------------------------------------------------------
    // 
    //--------------------------------------------------------------------------------------
    async updatePullRequest(number: number, description: string) {
        const body = {
            body: description,
        }

        const resp = await this._gitApiHelper.restPatch<GitPullRequest>(`${this.repoApi}/pulls/${number}`, JSON.stringify(body))
        return resp;
    }

    //------------------------------------------------------------------------------
    // Return all the pull requests
    // Filter options:
    //      involvesUser:  return all prs that involve the specified user
    //------------------------------------------------------------------------------
    async findPullRequests(filter: PRSearchFilter): Promise<GitPullRequest[] | null>
    {
        let query = "?per_page=50&q=type:pr+sort:updated-desc";
        if(filter.involvesUser) query += `+involves:${filter.involvesUser}`;
        if(filter.sourceBranch) query += `+head:${filter.sourceBranch}`
        if(filter.targetBranch) query += `+base:${filter.targetBranch}`
        const response = await this._gitApiHelper.restGet<GitSearchResponse>(`${this.searchApi}${query}`);
        if(!response) return null;
        return response.items as GitPullRequest[];
    }

    //------------------------------------------------------------------------------
    // Get PR Reviews
    //------------------------------------------------------------------------------
    async getReviews(pr: GitPullRequest) : Promise<GitReview[]>
    {
        let query = `${this.repoApi}/pulls/${pr.number}/reviews`;

        const response = await this._gitApiHelper.restGet<GitReview[]>(query);
        if(!response) return [];
        return response;
    }

    //------------------------------------------------------------------------------
    // Return the children of a specifice node path
    //------------------------------------------------------------------------------
    async getNodeChildren(branchOrSha: string, path: string): Promise<GitNodeData[]>
    {
        const output = new Array<GitNodeData>();
        if(!path.startsWith("/")) path = "/" + path;

        for(let page = 0; page < 1000; page++)
        {
            const result = await this._gitApiHelper.restGet<GitNodeData[]>(`${this.contentsApi}${path}?ref=${branchOrSha}&per_page=100&page=` + page);
            if(!result) break;
            for(const item of result)
            {
                output.push(item);
            }
            if(result.length < 100) break;
        }
        return output;
    }

    //------------------------------------------------------------------------------
    // Get text contents
    //------------------------------------------------------------------------------
    async getTextContents(branchOrSha: string, relativePath: string)
    {
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
        const result = await this._graphQLApi.restPost<{data: {repository: {object: {text: string}}}}>("", JSON.stringify({query}))
        //console.log(JSON.stringify(result));
        if(!result) return null;
        return result.data.repository.object.text;
    }

    //------------------------------------------------------------------------------
    // Return the first commit with a message that matches the regex
    // path: specify this to limit the commit search to a certain file
    //------------------------------------------------------------------------------
    async processCommitHistory( 
        startPath: string | undefined, 
        processCommit: (commit: {committedDate: string, message: string, oid: string}) => boolean)
    {
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

        let lastCommitTimestamp: string | undefined; 
        const pageSize = 50;

        // Search through commit history 
        while(true)
        {
            let historyPart = `first: ${pageSize}`;
            if(startPath && startPath !== "") historyPart += `, path: ${JSON.stringify(startPath)}`;
            if(lastCommitTimestamp) historyPart += `, until: ${JSON.stringify(lastCommitTimestamp)}`
            const query = queryTemplate.replace("##HISTORY_PARAMS##", historyPart)
            const result = await this._graphQLApi.restPost<any>("", JSON.stringify({query}))
            let count = 0;

            for(const edge of result.data.repository.defaultBranchRef.target.history.edges)
            {
                if(edge.node.committedDate === lastCommitTimestamp) continue;
                count++;
                if(!processCommit(edge.node)) return;
                lastCommitTimestamp = edge.node.committedDate;
            }

            if(!count) break;
        }
    }
}