"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Look for how quotes, vendors, estimates, profiles, locations were used or if any modals exist
const lines = content.split('\n');
// Search for showQuotesModal or similar
const stateRegex = /const\s+\[show([A-Za-z0-9]+Modal)/g;
let m;
while ((m = stateRegex.exec(content)) !== null) {
    console.log('Modal state:', m[0]);
}
