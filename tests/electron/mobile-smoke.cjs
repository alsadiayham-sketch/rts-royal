// Isolated renderer fixture: all API responses are fictional and no network is used.
const { app, BrowserWindow, session } = require("electron");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const publicRoot = path.join(root, "public");
const fixture = `
  (() => {
    const values = new Map();
    Object.defineProperty(window, 'localStorage', { value: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    }});
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    if (!crypto.randomUUID) {
      let n = 0;
      crypto.randomUUID = () => 'fixture-' + String(++n).padStart(8, '0');
    }
    window.confirm = () => true;
    const state = window.__fixture = { holds: [], stock: 5, bills: [] };
    window.fetch = async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : {};
      let result;
      if (url === '/api/pos-login') {
        result = { token: 'fixture-only', productType: 'business', user: { username: 'worker', name: 'موظف', role: 'worker' }, store: { id: 'fixture-shop', name: 'مطعم تجريبي' } };
      } else if (url.startsWith('/api/pos-mobile?') || url === '/api/pos-mobile') {
        result = { businessType: 'restaurant', cursor: null, products: [{ id: 'product1', name: 'وجبة تجريبية', category: 'الوجبات', variants: [{ color: 'افتراضي', size: 'كبير', price: 10, stock: state.stock }] }] };
      } else if (url.startsWith('/api/pos-supplies')) {
        result = { items: [], audit: [], itemsTruncated: false };
      } else if (url === '/api/pos-restaurant-tables') {
        result = { configured: true, revision: 1, tables: [{ id: 3, name: 'طاولة 3', archived: false }] };
      } else if (url === '/api/pos-shared-config') {
        result = { configured: true, revision: 1, config: { features: { tax: false }, taxPercent: 0, taxIncluded: false } };
      } else if (url === '/api/pos-mobile-orders' && !options.method) {
        result = { holds: state.holds.filter(hold => hold.status === 'open') };
      } else if (url === '/api/pos-mobile-orders' && body.action === 'hold') {
        const hold = { id: body.holdId, revision: body.revision + 1, items: body.items, service: body.service, note: body.note, status: 'open', updatedAtIso: '2026-01-01' };
        state.holds = state.holds.filter(old => old.id !== hold.id).concat([hold]);
        result = { ok: true, hold };
      } else if (url === '/api/pos-mobile-orders' && body.action === 'quote') {
        const hold = state.holds.find(item => item.id === body.holdId);
        const qty = hold.items[0].qty;
        result = { ok: true, quoteHash: 'fixture-quote', quote: { items: [{ name: 'وجبة تجريبية', qty, total: qty * 10 }], subtotal: qty * 10, deliveryFee: 0, taxRate: 0, taxAmount: 0, total: qty * 10 } };
      } else if (url === '/api/pos-mobile-orders' && body.action === 'checkout') {
        const hold = state.holds.find(item => item.id === body.holdId);
        const qty = hold.items[0].qty;
        state.stock -= qty; hold.status = 'paid';
        const bill = { billNumber: 'POS-M-' + hold.id, items: [{ name: 'وجبة تجريبية', qty, total: qty * 10 }], subtotal: qty * 10, deliveryFee: 0, taxRate: 0, taxAmount: 0, total: qty * 10, paymentMethod: body.paymentMethod };
        state.bills.push(bill); result = { ok: true, bill };
      } else {
        throw new Error('Unexpected fixture request: ' + url);
      }
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    };
  })();
`;

function documentHtml() {
  const html = fs.readFileSync(path.join(publicRoot, "business-mobile", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(publicRoot, "business-mobile", "mobile.css"), "utf8");
  const js = fs.readFileSync(path.join(publicRoot, "business-mobile", "mobile.js"), "utf8");
  return html.replace('<link rel="stylesheet" href="/business-mobile/mobile.css">', `<style>${css}</style>`)
    .replace('<script src="/business-mobile/mobile.js" defer></script>', `<script>${fixture}</script><script>${js}</script>`)
    .replaceAll("/business-mobile/ada-icon.png", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=");
}

async function until(web, expression) {
  for (let i = 0; i < 80; i++) {
    if (await web.executeJavaScript(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const notice = await web.executeJavaScript("document.getElementById('notice').textContent");
  throw new Error(`Timed out: ${expression}; notice: ${notice}`);
}

async function main() {
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, done) => done({ cancel: true }));
  const window = new BrowserWindow({ show: false, width: 390, height: 844, useContentSize: true, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  try {
    await window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(documentHtml()));
    const web = window.webContents;
    await web.executeJavaScript(`(() => {
      const form = document.getElementById('login-form');
      form.elements.storeId.value = 'fixture-shop';
      form.elements.username.value = 'worker';
      form.elements.password.value = 'fixture';
      form.requestSubmit();
    })()`);
    await until(web, "!document.getElementById('workspace').hidden && !!document.querySelector('#products .actions button') && !!document.querySelector('#order-form select[name=table] option[value=\"3\"]')");
    await web.executeJavaScript(`document.querySelector('#products .actions button').click(); document.getElementById('orders-tab').click();`);
    await web.executeJavaScript(`(() => {
      const form = document.getElementById('order-form');
      form.elements.type.value = 'dinein'; form.elements.table.value = '3';
      form.elements.type.dispatchEvent(new Event('input', { bubbles: true }));
      form.elements.table.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('save-order').click();
    })()`);
    await until(web, "document.getElementById('held-list').textContent.includes('طاولة 3')");
    await web.executeJavaScript(`document.querySelector('#cart-list .actions button:nth-child(2)').click(); document.getElementById('review-order').click();`);
    await until(web, "!document.getElementById('quote-panel').hidden");
    await web.executeJavaScript("document.getElementById('pay-cash').click()");
    await until(web, "!document.getElementById('receipt').hidden");
    const actual = await web.executeJavaScript(`({
      receipt: document.getElementById('receipt').textContent,
      stock: window.__fixture.stock, count: window.__fixture.bills.length,
      scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth
    })`);
    if (!actual.receipt.includes("20.00") || actual.stock !== 3 || actual.count !== 1) throw new Error(`Bad fixture result: ${JSON.stringify(actual)}`);
    if (actual.scroll > actual.viewport) throw new Error(`Horizontal overflow ${actual.scroll} > ${actual.viewport}`);
    console.log("Mobile renderer fixture passed: login, cart, table, edit, quote, checkout, receipt, width.");
  } finally { window.destroy(); app.quit(); }
}

main().catch((error) => { console.error(error); app.exit(1); });
