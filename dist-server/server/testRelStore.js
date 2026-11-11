"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dscMasterStore_1 = require("./dscMasterStore");
async function testStores() {
    const allStores = [
        'purchase_internal_profiles',
        'employee_master_directory',
        'employees',
        'user_data_visibility_scopes',
    ];
    for (const s of allStores) {
        const data = await (0, dscMasterStore_1.getRelationalStore)(s);
        console.log(`Store '${s}': ${data.length} records.`, data.slice(0, 2));
    }
}
testStores();
