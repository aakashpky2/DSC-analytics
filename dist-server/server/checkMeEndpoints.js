"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./auth");
const http_1 = __importDefault(require("http"));
async function check() {
    const adminToken = await (0, auth_1.createSession)('usr-admin-root', 1);
    const staffToken = await (0, auth_1.createSession)('usr-1793787633577', 1);
    function getMe(token, label) {
        return new Promise((resolve) => {
            http_1.default.get('http://localhost:3000/api/auth/me', {
                headers: { 'Cookie': `signsync_session=${token}` }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    console.log(`${label}:`, data);
                    resolve(JSON.parse(data));
                });
            });
        });
    }
    await getMe(adminToken, 'Admin Me');
    await getMe(staffToken, 'Staff Me');
}
check();
