(function () {
  'use strict';
  const unavailable = () => Promise.reject(new Error('DEVELOPMENT PREVIEW: secure route unavailable; no data was sent.'));
  const product = { name: 'وجبة تجريبية', category: 'تجريبي', variants: [{ color: 'افتراضي', size: 'كبير', price: 10, stock: 5 }] };
  let project = null;
  const snapshot = (id, value) => ({ id, exists: Boolean(value), data: () => value && structuredClone(value) });
  const collection = (name) => {
    const docs = name === 'products' ? [snapshot('fixture-product', product)] : [];
    const query = {
      doc(id) {
        return {
          get: () => Promise.resolve(snapshot(id, name === 'settings' && id === 'pos'
            ? { warrantyEnd: '2099-01-01', businessType: 'restaurant' } : null)),
          update: unavailable, set: unavailable, delete: unavailable,
          collection,
        };
      },
      get: () => Promise.resolve({ docs, forEach: (fn) => docs.forEach(fn) }),
      onSnapshot(fn) {
        let active = true;
        queueMicrotask(() => { if (active) fn({ docs, forEach: (cb) => docs.forEach(cb) }); });
        return () => { active = false; };
      },
      add: unavailable,
      orderBy() { return this; }, limit() { return this; }, where() { return this; },
    };
    return query;
  };
  const db = { collection, runTransaction: unavailable, batch() { throw new Error('Preview writes disabled'); } };
  const fb = {
    db, rawDb: db, storage: null,
    firebase: { firestore: { FieldValue: { serverTimestamp: () => null } } },
    serverTimestamp: () => null,
    setProjectId(id) { project = id; }, getProjectId() { return project; },
    isD1: () => false, registerD1Tenant() {}, registerD1MessagingBackend() {},
    isMessagingConfigured: () => false, isPosEmployeeManagementConfigured: () => false,
    isPosSuppliesConfigured: () => false,
    configurePosAuth: () => true,
    posAuthenticate(username, password, storeId) {
      if (storeId === 'fixture' && username === 'preview' && password === 'preview') {
        return Promise.resolve({ username: 'preview', name: 'تجريبي فقط', role: 'admin' });
      }
      return Promise.reject(Object.assign(new Error('Fixture login only.'), { status: 401 }));
    },
    clearPosToken() {}, publishOwnerTelemetry: unavailable,
    posEmployees: unavailable, posSupplies: unavailable,
    posRestaurantConfig: unavailable, posRestaurantTables: unavailable, posRestaurantOrders: unavailable,
    messagingGetStatus: unavailable, messagingPreviewAudience: unavailable,
    messagingRequestCredits: unavailable, messagingSend: unavailable, messagingUpdatePricing: unavailable,
  };
  function printHtml(html) {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const area = document.getElementById('full-preview-print');
    area.textContent = doc.body.textContent || '';
    if (window.RTSNative) window.RTSNative.postMessage('print');
    else window.print();
    return Promise.resolve({ success: true });
  }
  const electron = { ipcRenderer: {
    on() {},
    invoke(command, arg) {
      if (command === 'print-html') return printHtml(arg);
      if (command === 'list-printers') return Promise.resolve([]);
      if (command === 'updater-check') return Promise.resolve({ ok: false });
      return unavailable();
    },
  } };
  const modules = {
    './firebase-config': fb, electron, fs: {}, path: {},
    './owner-telemetry': window.__businessModules.telemetry,
    './restaurant-service': window.__businessModules.service,
    './restaurant-shared': window.__businessModules.shared,
    'node:crypto': window.__businessModules.crypto,
    '../../package.json': { version: window.__businessModules.version },
    './server-auth': { loginErrorMessage: () => 'معاينة تجريبية فقط.' },
    'image-size': window.__businessModules.image,
  };
  window.require = (id) => {
    if (!Object.prototype.hasOwnProperty.call(modules, id)) throw new Error(`Preview module unavailable: ${id}`);
    return modules[id];
  };
  window.businessPreviewShare = async function (text) {
    if (navigator.share) return navigator.share({ text: String(text) });
    throw new Error('Sharing unavailable.');
  };
}());
