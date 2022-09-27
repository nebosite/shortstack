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
const cross_fetch_1 = __importDefault(require("cross-fetch"));
;
//------------------------------------------------------------------------------
// Class to assist with REST calling
//------------------------------------------------------------------------------
class RestHelper {
    //------------------------------------------------------------------------------
    // helper for rest calls
    //
    // callPrefix is used to append special text to the beginning of all request urls.
    // this is helpful for servers that use prefix text to reroute calls
    //------------------------------------------------------------------------------
    constructor(apiRoot, cache, callPrefix = "") {
        this._headers = {};
        this._cache = cache;
        this.apiRoot = apiRoot;
        this._callPrefix = callPrefix;
    }
    //------------------------------------------------------------------------------
    // Add a header to use on all of the calls
    //------------------------------------------------------------------------------
    addHeader(name, value) {
        this._headers[name] = value;
    }
    //------------------------------------------------------------------------------
    // Attempt a json conversions and throw useful text if there is an error
    //------------------------------------------------------------------------------
    jsonConvert(query, jsonBody) {
        try {
            return JSON.parse(jsonBody);
        }
        catch (err) {
            if (this._cache) {
                this._cache.removeObject(query);
            }
            throw new Error(`Non-Json body returned on ${this.apiRoot}${query}\nResponse: ${jsonBody}`);
        }
    }
    //------------------------------------------------------------------------------
    // Get an object
    //------------------------------------------------------------------------------
    restGet(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.jsonConvert(query, yield this.restCall("GET", query, undefined));
        });
    }
    //------------------------------------------------------------------------------
    // get a string
    //------------------------------------------------------------------------------
    restGetText(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.restCall("GET", query, undefined);
        });
    }
    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    restPost(query, jsonBody) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.jsonConvert(query, yield this.restCall("POST", query, jsonBody));
        });
    }
    //------------------------------------------------------------------------------
    // 
    //------------------------------------------------------------------------------
    restPatch(query, jsonBody) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.jsonConvert(query, yield this.restCall("PATCH", query, jsonBody));
        });
    }
    //------------------------------------------------------------------------------
    // base method for making any rest call
    //------------------------------------------------------------------------------
    restCall(method, query, jsonBody) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this._callPrefix}${this.apiRoot}${query}`;
            //console.log("URL: " + url);
            if (this._cache) {
                const cachedString = yield this._cache.loadObject(query);
                if (cachedString)
                    return cachedString.data;
            }
            const config = { method: method, body: jsonBody, headers: this._headers };
            //console.log("REQUEST: " + JSON.stringify(request));
            return cross_fetch_1.default(url, config)
                .then((response) => __awaiter(this, void 0, void 0, function* () {
                if (response.status === 301) {
                    throw new Error(`Got a 301 error.  The requesting URL (${url}) is wrong.  it should be: ${response.headers["location"]}`);
                }
                if ((response.status >= 200 && response.status < 300) // OK
                    || response.status === 410 // Gone or empty.  for JSON replies, this means "{}"
                ) {
                    const text = yield response.text();
                    if (this._cache) {
                        this._cache.saveObject(query, { data: text });
                    }
                    return text;
                }
                else {
                    throw Error(`Unexpected response: ${response.status}: ${yield response.text()}`);
                }
            }))
                .catch((error) => {
                throw Error(`Error on URL: ${url}\n: ${error}`);
            });
        });
    }
    //------------------------------------------------------------------------------
    // remove the item from the cache if it is there
    //------------------------------------------------------------------------------
    removeFromCache(query) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return (_a = this._cache) === null || _a === void 0 ? void 0 : _a.removeObject(query);
        });
    }
}
exports.RestHelper = RestHelper;
//# sourceMappingURL=RestHelper.js.map