(function () {
  'use strict';
  // These are the only inline actions emitted by the current desktop renderer.
  const actions = Object.freeze({
    adjustProfilePoints: ['number', n => adjustProfilePoints(n)],
    resetCustomerPoints: ['none', () => resetCustomerPoints()],
    adjustCustomerCredit: ['none', () => adjustCustomerCredit()],
    saveCustomerProfile: ['none', () => saveCustomerProfile()],
    removePendingPrize: ['number', n => removePendingPrize(n)],
    toggleInvRow: ['string', s => toggleInvRow(s)],
    printProductLabel: ['string', s => printProductLabel(s)],
    viewBill: ['string', s => viewBill(s)],
    reprintBill: ['string', s => reprintBill(s)],
    clearAttachedCustomer: ['none', () => clearAttachedCustomer()],
    openTable: ['number', n => openTable(n)],
    addHookahToCart: ['number', n => addHookahToCart(n)],
    removeReward: ['number', n => removeReward(n)],
    openCustomerProfile: ['string', s => openCustomerProfile(s)],
    openSettleDebt: ['string', s => openSettleDebt(s)],
    removeReplacement: ['string', s => removeReplacement(s)],
    resumeHeld: ['id', x => resumeHeld(x)],
    deleteHeld: ['id', x => deleteHeld(x)],
    openLegacyRestaurantHeld: ['none', () => openLegacyRestaurantHeld()],
    importLegacyRestaurantHeld: ['number', n => importLegacyRestaurantHeld(n)],
  });
  function parseArgument(kind, raw) {
    if (kind === 'none') return raw === '' ? { ok: true } : null;
    if ((kind === 'number' || kind === 'id') && /^-?(?:0|[1-9]\d*)$/.test(raw)) {
      const value = Number(raw);
      return Number.isSafeInteger(value) ? { ok: true, value } : null;
    }
    if (kind !== 'string' && kind !== 'id') return null;
    if (raw.startsWith('"')) {
      try {
        const value = JSON.parse(raw);
        return typeof value === 'string' ? { ok: true, value } : null;
      } catch { return null; }
    }
    if (raw.length >= 2 && raw[0] === "'" && raw.at(-1) === "'") {
      const value = raw.slice(1, -1);
      // Never interpret JavaScript escapes or permit a second statement.
      if (!/['\\\r\n]/.test(value)) return { ok: true, value };
    }
    return null;
  }
  function readAction(value) {
    const text = value.trim();
    const label = /^event\.stopPropagation\(\);printProductLabel\((.*)\)$/.exec(text);
    if (label) {
      const arg = parseArgument('string', label[1]);
      return arg && { run: actions.printProductLabel[1], arg, stop: true };
    }
    if (text === 'clearAttachedCustomer();return false;') {
      return { run: actions.clearAttachedCustomer[1], arg: { ok: true }, prevent: true };
    }
    const match = /^([A-Za-z][A-Za-z0-9]*)\(([\s\S]*)\)$/.exec(text);
    if (!match || !Object.hasOwn(actions, match[1])) return null;
    const [kind, run] = actions[match[1]];
    const arg = parseArgument(kind, match[2]);
    return arg && { run, arg };
  }
  function dispatch(event, capture) {
    const element = event.target instanceof Element && event.target.closest('[data-rts-click]');
    if (!element) return;
    const action = readAction(element.getAttribute('data-rts-click'));
    if (!action || Boolean(action.stop) !== capture) return;
    if (action.stop) event.stopPropagation();
    if (action.prevent) event.preventDefault();
    action.run(action.arg.value);
  }
  document.addEventListener('click', event => dispatch(event, true), true);
  document.addEventListener('click', event => dispatch(event, false));
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement
        && event.target.getAttribute('data-rts-error') === "this.style.display='none'") {
      event.target.style.display = 'none';
    }
  }, true);

  function applyStyles(root) {
    const elements = [];
    if (root instanceof Element && root.hasAttribute('data-rts-style')) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll('[data-rts-style]'));
    for (const element of elements) {
      const declarations = element.getAttribute('data-rts-style');
      element.removeAttribute('data-rts-style');
      for (const declaration of declarations.split(';')) {
        const colon = declaration.indexOf(':');
        if (colon < 1) continue;
        const property = declaration.slice(0, colon).trim().toLowerCase();
        const value = declaration.slice(colon + 1).trim();
        if (!/^(?:--[a-z0-9-]+|[a-z][a-z0-9-]*)$/.test(property)
            || /url\s*\(|expression\s*\(|javascript:|@/i.test(value)) continue;
        element.style.setProperty(property, value);
      }
    }
  }
  new MutationObserver(records => records.forEach(record =>
    record.addedNodes.forEach(applyStyles))).observe(document, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyStyles(document));
  else applyStyles(document);
}());
