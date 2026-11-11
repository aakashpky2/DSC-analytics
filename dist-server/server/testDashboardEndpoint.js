"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./auth");
const http_1 = __importDefault(require("http"));
async function testEndpoint() {
    var _a;
    const adminToken = await (0, auth_1.createSession)('usr-admin-root', 1);
    const staffToken = await (0, auth_1.createSession)('usr-1793787633577', 1);
    function fetchSummary(token, query = '') {
        return new Promise((resolve) => {
            http_1.default.get(`http://localhost:3000/api/dashboard/summary${query}`, {
                headers: { 'Cookie': `signsync_session=${token}` }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    }
                    catch (_a) {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
        });
    }
    const adminRes = await fetchSummary(adminToken);
    console.log('ADMIN SUMMARY STATUS:', adminRes.status);
    console.log('ADMIN USER:', adminRes.body.user);
    console.log('ADMIN KPIS:', adminRes.body.kpis);
    console.log('ADMIN PIPELINE:', adminRes.body.pipeline);
    console.log('ADMIN ALERTS:', adminRes.body.alerts);
    const staffRes = await fetchSummary(staffToken);
    console.log('STAFF SUMMARY STATUS:', staffRes.status);
    console.log('STAFF USER:', staffRes.body.user);
    console.log('STAFF IS_MANAGEMENT:', staffRes.body.isManagementRole);
    console.log('STAFF TASKS COUNT:', (_a = staffRes.body.staffTasks) === null || _a === void 0 ? void 0 : _a.length);
}
testEndpoint();
