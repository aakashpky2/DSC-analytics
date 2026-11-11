"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Let's check the table structures for bills, orders, inwards, couriers
const lines = content.split('\n');
const billsStart = lines.findIndex(l => l.includes("activeTab === 'bills'"));
console.log('--- Bills section sample (lines', billsStart + 1, 'to', billsStart + 60, ') ---');
console.log(lines.slice(billsStart, billsStart + 60).join('\n'));
