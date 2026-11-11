"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Look at line with active indicator
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('Active:'));
console.log('--- Lines around Active indicator ---');
console.log(lines.slice(idx - 5, idx + 45).join('\n'));
