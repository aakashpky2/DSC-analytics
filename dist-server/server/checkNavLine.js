"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Let's create the replacement for lines 705 to 765
const lines = content.split('\n');
const navStart = lines.findIndex(l => l.includes('{/* Navigation Tabs */}'));
console.log('navStart line:', navStart + 1);
console.log(lines.slice(navStart, navStart + 60).join('\n'));
