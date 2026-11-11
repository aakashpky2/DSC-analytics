"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Look around line 1714 (sales-invoices) and line 1846 (customer-analytics)
const lines = content.split('\n');
console.log('--- Lines 1820-1860 ---');
console.log(lines.slice(1819, 1860).join('\n'));
