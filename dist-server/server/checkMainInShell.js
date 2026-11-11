"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/components/ShellLayout.tsx', 'utf8');
// Check lines containing <main
const lines = content.split('\n');
lines.forEach((l, idx) => {
    if (l.includes('<main') || l.includes('main className')) {
        console.log(`${idx + 1}: ${l}`);
    }
});
