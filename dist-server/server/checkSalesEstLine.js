"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Find sales-estimates in page.tsx
const lines = content.split('\n');
lines.forEach((l, idx) => {
    if (l.includes('sales-estimates') || l.includes('sales-invoices')) {
        console.log(`${idx + 1}: ${l.trim().slice(0, 100)}`);
    }
});
