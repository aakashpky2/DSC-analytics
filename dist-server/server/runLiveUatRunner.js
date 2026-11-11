"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const acceptanceSuiteUatLive_1 = require("./acceptanceSuiteUatLive");
const fs_1 = __importDefault(require("fs"));
async function main() {
    try {
        const results = await (0, acceptanceSuiteUatLive_1.runFullLiveUat)();
        console.log('\n======================================================');
        console.log('              LIVE UAT SUMMARY RESULTS                ');
        console.log('======================================================');
        let passCount = 0;
        for (const r of results) {
            console.log(`[${r.status}] ${r.step} - ${r.title}`);
            if (r.status === 'PASS')
                passCount++;
        }
        console.log(`TOTAL: ${results.length} | PASS: ${passCount} | FAIL: ${results.length - passCount}`);
        fs_1.default.writeFileSync('uat_results.json', JSON.stringify(results, null, 2));
        process.exit(results.length === passCount ? 0 : 1);
    }
    catch (err) {
        console.error('UAT Execution failed:', err);
        process.exit(1);
    }
}
main();
