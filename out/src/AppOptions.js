"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//------------------------------------------------------------------------------
// Simple Class for thinking about options
//------------------------------------------------------------------------------
class AppOptions {
    //------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------
    constructor(argv) {
        this.shouldMoo = true;
        this.brainSize = undefined;
        this.badArgs = new Array();
        for (let i = 2; i < argv.length; i++) {
            // commandline is -name=value  (or /name=value), value is optional
            let trimmed = argv[i].replace(/^([-/]*)/, "").toLowerCase();
            let parts = trimmed.split('=');
            switch (parts[0]) {
                case "brainsize":
                    this.brainSize = parts[1];
                    break;
                case "moo":
                    this.shouldMoo = true;
                    break;
                default:
                    this.badArgs.push(argv[i]);
                    break;
            }
        }
    }
}
exports.AppOptions = AppOptions;
//# sourceMappingURL=AppOptions.js.map