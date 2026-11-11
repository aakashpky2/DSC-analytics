"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
const tabs = [
    'calculator', 'quotes', 'orders', 'bills', 'opening-stock', 'profile-stocks',
    'sales-estimates', 'sales-invoices', 'sales-payments', 'party-ledgers',
    'outstanding-ageing', 'sales-monthly', 'sales-annual', 'purchase-overall',
    'estimate-pipeline', 'customer-analytics', 'vendor-analytics', 'receipts',
    'inwards', 'couriers', 'analytics', 'templates', 'numbering', 'rules',
    'sales-rates', 'pricing-categories', 'customer-levels', 'token-register',
    'vendors', 'estimates', 'profiles', 'locations'
];
for (const t of tabs) {
    const needle = `activeTab === '${t}'`;
    console.log(`${t} => ${content.includes(needle)}`);
}
