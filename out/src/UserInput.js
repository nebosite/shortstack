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
const readline_1 = require("readline");
var Writable = require('stream').Writable;
//------------------------------------------------------------------------------
// A little helper for interacting with the user
//------------------------------------------------------------------------------
class UserInput {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(hideTypeing = false) {
        this.hideTypeing = hideTypeing;
    }
    // //------------------------------------------------------------------------------
    // // Our special mutable writer
    // //------------------------------------------------------------------------------
    // private writer = (chunk: any, encoding: string, callback: () =>void) =>
    // {
    //     if (!this.hideTypeing) process.stdout.write(chunk, encoding);
    //     else 
    //     {
    //         if(chunk.length == 1) process.stdout.write(Buffer.from("*"), 'utf8')
    //         else process.stdout.write(chunk, encoding);
    //     }
    //     callback();
    // }
    //------------------------------------------------------------------------------
    // Ask the user something
    //------------------------------------------------------------------------------
    getUserInput(query) {
        return __awaiter(this, void 0, void 0, function* () {
            let readLineInterface = readline_1.createInterface({
                input: process.stdin,
                output: new Writable({ write: (chunk, encoding, callback) => {
                        if (this.hideTypeing && chunk.toString().startsWith(query)) {
                            chunk = Buffer.from(query + "*".repeat(chunk.length - query.length));
                        }
                        else if (this.hideTypeing && chunk.length == 1) {
                            chunk = Buffer.from("*".repeat(chunk.length));
                        }
                        process.stdout.write(chunk, encoding);
                        callback();
                    } }),
                terminal: true
            });
            return new Promise((resolve) => {
                readLineInterface.question(query, (input) => resolve(input));
            }).then(value => {
                readLineInterface.close();
                return value;
            });
        });
    }
}
exports.UserInput = UserInput;
//# sourceMappingURL=UserInput.js.map