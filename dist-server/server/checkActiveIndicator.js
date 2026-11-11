"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Let's check lines 740 to 800
const lines = content.split('\n');
console.log('--- Lines 740 to 800 ---');
console.log(lines.slice(739, 800).join('\n'));
