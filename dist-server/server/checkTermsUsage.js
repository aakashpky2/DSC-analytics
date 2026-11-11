"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
const terms = ['salesPayments', 'setSalesPayments', 'showSalesPayModal', 'quotes', 'parties', 'estimates', 'profiles', 'locations'];
terms.forEach(t => {
    const matches = [];
    content.split('\n').forEach((line, idx) => {
        if (line.includes(t))
            matches.push(idx + 1);
    });
    console.log(`${t} found at lines:`, matches.slice(0, 15));
});
