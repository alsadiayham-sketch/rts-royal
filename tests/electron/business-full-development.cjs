const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');

async function until(web, expression) {
  for (let i = 0; i < 100; i++) {
    if (await web.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${expression}; login error: ${await web.executeJavaScript("document.getElementById('loginError').textContent")}`);
}

async function main() {
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, done) => done({ cancel: true }));
  const win = new BrowserWindow({ show: false, width: 390, height: 844,
    webPreferences: { nodeIntegration: false, contextIsolation: true } });
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  try {
    await win.loadFile(path.resolve(__dirname, '..', '..', 'test-results', 'business-full-development', 'index.html'));
    const web = win.webContents;
    await until(web, "document.getElementById('loginScreen').style.display === 'flex'");
    const before = await web.executeJavaScript(`({
      banner: document.getElementById('full-preview-warning').textContent,
      node: typeof process,
      login: !!document.getElementById('loginBtn')
    })`);
    assert.match(before.banner, /معاينة تطوير/);
    assert.equal(before.node, 'undefined');
    const policy = await web.executeJavaScript("document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]').content");
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
    const toggled = await web.executeJavaScript(`(() => {
      const el = document.getElementById('taxRow');
      const initial = el.style.display; el.style.display = '';
      const cleared = getComputedStyle(el).display; el.style.display = initial;
      return { initial, cleared };
    })()`);
    assert.equal(toggled.initial, 'none');
    assert.notEqual(toggled.cleared, 'none');
    await web.executeJavaScript(`(() => {
      document.getElementById('loginStoreName').value = 'fixture';
      document.getElementById('loginUsername').value = 'preview';
      document.getElementById('loginPassword').value = 'preview';
      document.getElementById('loginBtn').click();
    })()`);
    await until(web, "document.getElementById('appContainer').style.display === 'flex'");
    await until(web, "document.body.textContent.includes('وجبة تجريبية')");
    await web.executeJavaScript(`document.querySelector('[data-page="inventory"]').click()`);
    await until(web, "!!document.querySelector('#inventoryTable .inv-master')");
    await web.executeJavaScript("document.querySelector('#inventoryTable .inv-master').click()");
    assert.equal(await web.executeJavaScript("document.getElementById('inv_fixture-product').style.display"), 'table-row');
    const events = await web.executeJavaScript(`(() => {
      const calls = [];
      window.adjustProfilePoints = n => calls.push(['points', n]);
      window.openCustomerProfile = id => calls.push(['customer', id]);
      window.removeReward = id => calls.push(['reward', id]);
      window.clearAttachedCustomer = () => calls.push(['clear']);
      window.printProductLabel = id => calls.push(['label', id]);
      window.toggleInvRow = id => calls.push(['row', id]);
      document.querySelector('[data-rts-click="adjustProfilePoints(1)"]').click();
      const fixture = document.createElement('div');
      fixture.innerHTML = '<button data-rts-click="openCustomerProfile(\\'customer-1\\')">customer</button>'
        + '<button data-rts-click="removeReward(2)">reward</button>'
        + '<a href="#" data-rts-click="clearAttachedCustomer();return false;">clear</a>'
        + '<div data-rts-click="toggleInvRow(\\'parent\\')"><button data-rts-click="event.stopPropagation();printProductLabel(\\'p1\\')">label</button></div>'
        + '<button data-rts-click="openCustomerProfile(\\'ok\\');window.injected=true;evil(\\'x\\')">bad</button>'
        + '<button data-rts-click="constructor.constructor(\\'window.injected=true\\')">bad2</button>'
        + '<span data-rts-style="color:rgb(1, 2, 3);display:none">style</span>'
        + '<img data-rts-error="this.style.display=\\'none\\'">';
      document.body.append(fixture);
      fixture.children[0].click(); fixture.children[1].click();
      const prevented = !fixture.children[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      fixture.children[3].firstElementChild.click(); fixture.children[4].click(); fixture.children[5].click();
      fixture.children[7].dispatchEvent(new Event('error'));
      return new Promise(resolve => setTimeout(() => resolve({
        calls, prevented, injected: !!window.injected,
        color: fixture.children[6].style.color, display: fixture.children[6].style.display,
        image: fixture.children[7].style.display,
      }), 0));
    })()`);
    assert.deepEqual(events, {
      calls: [['points', 1], ['customer', 'customer-1'], ['reward', 2], ['clear'], ['label', 'p1']],
      prevented: true, injected: false, color: 'rgb(1, 2, 3)', display: 'none', image: 'none',
    });
    const coverage = await web.executeJavaScript(`(() => {
      const specs = {
        adjustProfilePoints:'1', resetCustomerPoints:'', adjustCustomerCredit:'', saveCustomerProfile:'',
        removePendingPrize:'2', toggleInvRow:"'item'", printProductLabel:"'item'", viewBill:"'item'",
        reprintBill:"'item'", clearAttachedCustomer:'', openTable:'2', addHookahToCart:'2', removeReward:'2',
        openCustomerProfile:"'item'", openSettleDebt:"'item'", removeReplacement:"'item'",
        resumeHeld:'"held-id"', deleteHeld:'2', openLegacyRestaurantHeld:'', importLegacyRestaurantHeld:'2'
      };
      const calls = [];
      for (const [name, arg] of Object.entries(specs)) {
        window[name] = (...values) => calls.push(name);
        const button = document.createElement('button');
        button.setAttribute('data-rts-click', name + '(' + arg + ')');
        document.body.append(button); button.click(); button.remove();
      }
      return { expected: Object.keys(specs), calls };
    })()`);
    assert.deepEqual(coverage.calls, coverage.expected);
    const guard = await web.executeJavaScript(`(async () => {
      const fb = require('./firebase-config');
      return {
        direct: await fb.rawDb.collection('orders').doc('x').set({private: true}).then(() => false, () => true),
        shared: await fb.posRestaurantOrders('POST', {action:'checkout'}).then(() => false, () => true),
        auth: await fb.posAuthenticate('real-user', 'not-fixture', 'real-store').then(() => false, () => true),
        external: await fetch('https://example.invalid/').then(() => false, () => true)
      };
    })()`);
    assert.deepEqual(guard, { direct: true, shared: true, auth: true, external: true });
    const print = await web.executeJavaScript(`(async () => {
      let requested = false; window.print = () => { requested = true; };
      await require('electron').ipcRenderer.invoke('print-html', '<body><p>Fixture receipt</p><img src=x onerror=alert(1)></body>');
      const area = document.getElementById('full-preview-print');
      return { requested, text: area.textContent, children: area.children.length };
    })()`);
    assert.deepEqual(print, { requested: true, text: 'Fixture receipt', children: 0 });
    const image = await web.executeJavaScript(`(() => {
      const binary = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=');
      return require('image-size').imageSize(Uint8Array.from(binary, c => c.charCodeAt(0)));
    })()`);
    assert.equal(image.type, 'png');
    assert.equal(image.width, 1);
    assert.equal(image.height, 1);
    const unexpected = errors.filter(error =>
      !error.includes('Loading shared restaurant state failed: Error: DEVELOPMENT PREVIEW:')
      && !error.includes('https://example.invalid/'));
    assert.deepEqual(unexpected, []);
    console.log('Development browser fixture passed: login, catalog, inventory, text print request, auth/write/network gates.');
  } finally { win.destroy(); app.quit(); }
}
main().catch(error => { console.error(error); app.exit(1); });
