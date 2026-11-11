"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./auth");
const http_1 = __importDefault(require("http"));
async function checkData() {
    var _a, _b, _c;
    const adminToken = await (0, auth_1.createSession)('usr-admin-root', 1);
    function fetchApi(path) {
        return new Promise((resolve) => {
            http_1.default.get(`http://localhost:3000${path}`, {
                headers: { 'Cookie': `signsync_session=${adminToken}` }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch (_a) {
                        resolve(data);
                    }
                });
            });
        });
    }
    const [rev, directInit, billingInvoices, tokenBatches] = await Promise.all([
        fetchApi('/api/reports/revenue?period=current_month'),
        fetchApi('/api/dsc/direct/init-data'),
        fetchApi('/api/billing/invoices'),
        fetchApi('/api/inventory/batches')
    ]);
    console.log('REVENUE KPIS:', rev === null || rev === void 0 ? void 0 : rev.kpis);
    console.log('REVENUE ACCESSIBLE PROFILES:', rev === null || rev === void 0 ? void 0 : rev.accessibleProfiles);
    console.log('DIRECT INIT STAGES:', (_a = directInit === null || directInit === void 0 ? void 0 : directInit.stages) === null || _a === void 0 ? void 0 : _a.map((s) => ({ id: s.id, name: s.stage_name, order: s.stage_order })));
    console.log('DIRECT INIT TOKEN MODELS:', directInit === null || directInit === void 0 ? void 0 : directInit.tokenModels);
    console.log('BILLING INVOICES COUNT:', (_b = billingInvoices === null || billingInvoices === void 0 ? void 0 : billingInvoices.invoices) === null || _b === void 0 ? void 0 : _b.length);
    console.log('TOKEN BATCHES COUNT:', (_c = tokenBatches === null || tokenBatches === void 0 ? void 0 : tokenBatches.batches) === null || _c === void 0 ? void 0 : _c.length);
}
checkData();
