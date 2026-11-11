"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
const terms = ['quotes', 'sales-payments', 'vendors', 'estimates', 'profiles', 'locations'];
for (const term of terms) {
    const lines = [];
    content.split('\n').forEach((l, idx) => {
        if (l.includes(term)) {
            lines.push(`${idx + 1}: ${l.trim().slice(0, 100)}`);
        }
    });
    console.log(`=== Matches for ${term} ===`);
    console.log(lines.slice(0, 10).join('\n'));
}
