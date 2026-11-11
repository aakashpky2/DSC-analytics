"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
function fixTheme(filePath) {
    let content = fs_1.default.readFileSync(filePath, 'utf8');
    // Find all <select ... className="..."
    content = content.replace(/<select\b([^>]*?)className="([^"]*?)"/g, (match, before, classes) => {
        let cls = classes;
        if (!cls.includes('bg-slate-') && !cls.includes('bg-transparent')) {
            cls += ' bg-slate-950';
        }
        if (!cls.includes('text-white') && !cls.includes('text-slate-')) {
            cls += ' text-white';
        }
        if (!cls.includes('border-slate-')) {
            cls += ' border border-slate-800';
        }
        return `<select${before}className="${cls}"`;
    });
    // Find all <input ... className="..."
    content = content.replace(/<input\b([^>]*?)className="([^"]*?)"/g, (match, before, classes) => {
        if (classes.includes('checkbox') || classes.includes('radio') || before.includes('checkbox') || before.includes('radio')) {
            return match;
        }
        let cls = classes;
        if (!cls.includes('bg-slate-') && !cls.includes('bg-transparent')) {
            cls += ' bg-slate-950';
        }
        if (!cls.includes('text-white') && !cls.includes('text-slate-')) {
            cls += ' text-white';
        }
        if (!cls.includes('border-slate-')) {
            cls += ' border border-slate-800';
        }
        return `<input${before}className="${cls}"`;
    });
    // Also replace any option tags or inline styles
    fs_1.default.writeFileSync(filePath, content);
    console.log('Fixed theme in:', filePath);
}
fixTheme('src/app/dsc/direct/page.tsx');
fixTheme('src/app/dsc/issuance/page.tsx');
fixTheme('src/app/reports/revenue/page.tsx');
