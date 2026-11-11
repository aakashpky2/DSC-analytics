"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_USER_PASSWORD_CHANGE_FLAGS = void 0;
exports.isPasswordChangeRequired = isPasswordChangeRequired;
exports.setPasswordChangeRequired = setPasswordChangeRequired;
const dscMasterStore_1 = require("./dscMasterStore");
exports.STORE_USER_PASSWORD_CHANGE_FLAGS = 'user_password_change_flags';
async function isPasswordChangeRequired(userId) {
    const flags = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_USER_PASSWORD_CHANGE_FLAGS);
    const item = flags.find(f => f.user_id === userId);
    return item ? Boolean(item.password_change_required) : false;
}
async function setPasswordChangeRequired(userId, required) {
    const flags = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_USER_PASSWORD_CHANGE_FLAGS);
    const idx = flags.findIndex(f => f.user_id === userId);
    if (idx >= 0) {
        flags[idx] = Object.assign(Object.assign(Object.assign({}, flags[idx]), { password_change_required: required }), (required ? { temporary_password_set_at: new Date().toISOString() } : { last_password_changed_at: new Date().toISOString() }));
    }
    else {
        flags.push(Object.assign({ user_id: userId, password_change_required: required }, (required ? { temporary_password_set_at: new Date().toISOString() } : { last_password_changed_at: new Date().toISOString() })));
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_USER_PASSWORD_CHANGE_FLAGS, flags);
}
