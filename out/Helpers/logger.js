"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
class ConsoleLogger {
    logLine(text = undefined) { console.log(text); }
    logWarning(text) { console.error(chalk_1.default.yellowBright(text)); }
    logError(text) { console.error(chalk_1.default.redBright(text)); }
}
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=logger.js.map