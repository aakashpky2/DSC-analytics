"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Let's check lines 930 to 955 to see the end of calculator and start of orders
const lines = content.split('\n');
const calcEnd = lines.findIndex(l => l.includes("activeTab === 'orders'"));
console.log('--- Lines', calcEnd - 20, 'to', calcEnd + 10, '---');
console.log(lines.slice(calcEnd - 20, calcEnd + 10).join('\n'));
