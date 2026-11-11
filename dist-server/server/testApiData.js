"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Let's inspect how quotes, estimates, profiles, locations, vendors, sales-payments are structured in the database / API
// We can query the existing API or database to see sample rows
async function test() {
    var _a, _b, _c, _d, _e, _f;
    const [qRes, eRes, pRes, lRes, vRes, spRes] = await Promise.all([
        fetch('http://localhost:3000/api/token-procurement/quotes').then(r => r.json()).catch(e => ({ error: e.message })),
        fetch('http://localhost:3000/api/token-procurement/estimates').then(r => r.json()).catch(e => ({ error: e.message })),
        fetch('http://localhost:3000/api/token-procurement/internal-profiles').then(r => r.json()).catch(e => ({ error: e.message })),
        fetch('http://localhost:3000/api/token-procurement/delivery-locations').then(r => r.json()).catch(e => ({ error: e.message })),
        fetch('http://localhost:3000/api/token-procurement/parties').then(r => r.json()).catch(e => ({ error: e.message })),
        fetch('http://localhost:3000/api/token-sales/payments').then(r => r.json()).catch(e => ({ error: e.message }))
    ]);
    console.log('qRes keys:', Object.keys(qRes), 'sample:', (_a = qRes.quotes) === null || _a === void 0 ? void 0 : _a[0]);
    console.log('eRes keys:', Object.keys(eRes), 'sample:', (_b = eRes.estimates) === null || _b === void 0 ? void 0 : _b[0]);
    console.log('pRes keys:', Object.keys(pRes), 'sample:', (_c = pRes.profiles) === null || _c === void 0 ? void 0 : _c[0]);
    console.log('lRes keys:', Object.keys(lRes), 'sample:', (_d = lRes.locations) === null || _d === void 0 ? void 0 : _d[0]);
    console.log('vRes keys:', Object.keys(vRes), 'sample:', (_e = vRes.parties) === null || _e === void 0 ? void 0 : _e[0]);
    console.log('spRes keys:', Object.keys(spRes), 'sample:', (_f = spRes.payments) === null || _f === void 0 ? void 0 : _f[0]);
}
test();
