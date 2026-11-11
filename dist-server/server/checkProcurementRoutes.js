"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/server/routes/tokenProcurement.ts', 'utf8');
// Search for /quotes, /estimates, /internal-profiles, /delivery-locations, /parties
const lines = content.split('\n');
const routes = ['/token-procurement/quotes', '/token-procurement/estimates', '/token-procurement/internal-profiles', '/token-procurement/delivery-locations', '/token-procurement/parties'];
routes.forEach(r => {
    console.log(`=== Route ${r} ===`);
    lines.forEach((l, idx) => {
        if (l.includes(r)) {
            console.log(lines.slice(idx, idx + 25).join('\n'));
        }
    });
});
