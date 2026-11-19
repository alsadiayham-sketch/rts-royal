'use strict';
exports.randomUUID = () => globalThis.crypto.randomUUID();
exports.createHash = () => { throw new Error('Legacy ticket import is unavailable in the browser preview.'); };
