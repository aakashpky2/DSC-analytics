"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
let content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Let's check lines 25 to 40
console.log(content.split('\n').slice(24, 40).join('\n'));
