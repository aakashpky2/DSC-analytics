"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
const lines = content.split('\n');
const regex = /\{\s*activeTab === ['"]([^'"]+)['"]/;
lines.forEach((line, idx) => {
    const match = regex.exec(line);
    if (match) {
        console.log(`Line ${idx + 1}: activeTab === '${match[1]}'`);
    }
});
