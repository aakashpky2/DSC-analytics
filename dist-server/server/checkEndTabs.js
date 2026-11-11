"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Let's check lines 3680 to end of file to see what tabs are rendered near the end
const lines = content.split('\n');
console.log('--- Lines 3680-3800 ---');
console.log(lines.slice(3679, 3800).join('\n'));
