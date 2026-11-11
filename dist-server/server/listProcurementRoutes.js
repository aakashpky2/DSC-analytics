"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/server/routes/tokenProcurement.ts', 'utf8');
const lines = content.split('\n');
const regex = /procurementRouter\.(get|post|put|delete)\(['"]([^'"]+)['"]/;
lines.forEach((l, idx) => {
    const match = regex.exec(l);
    if (match) {
        console.log(`${match[1].toUpperCase()} ${match[2]}`);
    }
});
