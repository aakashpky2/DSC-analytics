"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// The 6 tabs without sections were:
// quotes, sales-payments, vendors, estimates, profiles, locations
// Let's see what happens if someone clicks them right now: activeTab becomes that string, but NO section is rendered! The screen becomes blank under the tabs!
console.log('Quotes length:', content.includes('quotes.length'));
console.log('Parties length:', content.includes('parties.length'));
console.log('Estimates length:', content.includes('estimates.length'));
console.log('Profiles length:', content.includes('profiles.length'));
console.log('Locations length:', content.includes('locations.length'));
