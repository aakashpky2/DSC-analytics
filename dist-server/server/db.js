"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.local' });
dotenv_1.default.config();
const supabase_js_1 = require("@supabase/supabase-js");
let rawUrl = process.env.SUPABASE_URL || 'https://kbqwsfmfiomcakbhclca.supabase.co';
if (rawUrl.endsWith('.supabase.c')) {
    rawUrl += 'o';
}
else if (rawUrl.endsWith('.supabase.')) {
    rawUrl += 'co';
}
else if (!rawUrl.includes('.supabase.co') && rawUrl.includes('kbqwsfmfiomcakbhclca')) {
    rawUrl = 'https://kbqwsfmfiomcakbhclca.supabase.co';
}
const supabaseUrl = rawUrl;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase server environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.');
}
/**
 * Backend Database Client (Used ONLY inside Express routes / Node.js backend).
 */
exports.db = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
