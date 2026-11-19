(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = {
    token: null, user: null, storeId: null, restaurant: false, products: [], tables: [], cursor: null,
    busy: false, pending: null, deviceToken: null, orderBusy: false, pendingHold: null,
    pendingCheckout: null, draft: null, quote: null, receipt: null, generation: 0,
    configConfigured: false, tablesConfigured: false, setupBusy: false, pendingSetup: null,
    configPreview: null, noLegacyConfig: false, tablesPreview: null, previewEpoch: 0,
  };
  const notice = (message) => { $("notice").textContent = message || ""; };
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  async function api(path, options = {}) {
    const generation = state.generation;
    const headers = { ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.body) headers["Content-Type"] = "application/json";
    let response, data;
    try {
      response = await fetch(path, { ...options, headers, cache: "no-store", redirect: "error" });
      data = await response.json();
    } catch (error) {
      if (generation === state.generation) throw error;
    }
    if (generation !== state.generation) {
      const error = new Error("Session changed.");
      error.code = "STALE_SESSION";
      throw error;
    }
    if (!response.ok) {
      const error = new Error(data.error?.message || "تعذر الاتصال بالخدمة.");
      error.status = response.status;
      error.code = data.error?.code;
      throw error;
    }
    return data;
  }
  function showError(error) {
    if (error.code === "STALE_SESSION") return;
    if (error.status === 401 && state.token) {
      reset();
      notice("انتهت الجلسة أو تغيّر الحساب. سجّل الدخول مجدداً.");
    } else notice(error.message || "تعذر الاتصال. تحقق من الإنترنت وحاول مجدداً.");
  }
  function reset() {
    state.generation += 1;
    state.token = null; state.user = null; state.storeId = null; state.restaurant = false;
    state.products = []; state.tables = []; state.cursor = null; state.pending = null; state.deviceToken = null;
    state.orderBusy = false; state.pendingHold = null; state.pendingCheckout = null;
    state.draft = null; state.quote = null; state.receipt = null;
    state.configConfigured = false; state.tablesConfigured = false; state.setupBusy = false;
    state.pendingSetup = null; state.configPreview = null; state.noLegacyConfig = false; state.tablesPreview = null;
    state.previewEpoch += 1;
    $("config-preview").textContent = ""; $("tables-preview").textContent = "";
    $("config-source-id").value = ""; $("tables-import").value = "";
    $("login").hidden = false; $("workspace").hidden = true; $("logout").hidden = true;
    $("login-form").reset(); $("order-form").reset();
    $("cart-list").replaceChildren(); $("held-list").replaceChildren(); $("quote-details").replaceChildren();
    $("receipt").textContent = ""; $("receipt").hidden = true; $("receipt-actions").hidden = true;
    $("quote-panel").hidden = true; $("restaurant-setup").hidden = true;
    $("config-candidates").replaceChildren();
    $("pending-hold").hidden = true; $("pending-checkout").hidden = true; $("pending-setup").hidden = true;
    $("products").replaceChildren(); $("supply-list").replaceChildren(); $("account-list").replaceChildren();
  }
  function showTab(tab) {
    for (const id of ["catalog", "orders", "supplies", "accounts"]) $(id).hidden = id !== tab;
    document.querySelectorAll("[data-tab]").forEach((button) => {
      if (button.dataset.tab === tab) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }
  function renderProducts() {
    const query = $("search").value.trim().toLocaleLowerCase();
    const products = state.products.filter((item) => `${item.name} ${item.category}`.toLocaleLowerCase().includes(query));
    const rows = products.map((product) => {
      const row = node("div", null, "row");
      const info = node("div", null, "row-info");
      const actions = node("div", null, "actions");
      info.append(node("strong", product.name || "صنف بدون اسم"));
      info.append(node("small", product.category));
      for (const variant of product.variants) {
        info.append(node("small", `${variant.size || variant.color || "افتراضي"} · ₪${variant.price == null ? "—" : variant.price.toFixed(2)} · المخزون ${variant.stock ?? "—"}`));
        if (state.restaurant && variant.price != null && Number.isInteger(variant.stock) && variant.stock > 0) {
          const button = node("button", `إضافة ${variant.size || variant.color || "افتراضي"}`, "quiet");
          button.type = "button";
          button.addEventListener("click", () => addToCart(product, variant));
          actions.append(button);
        }
      }
      row.append(info, actions);
      return row;
    });
    $("products").replaceChildren(...rows);
    if (!rows.length) $("products").append(node("p", "لا توجد أصناف مطابقة."));
    $("more").hidden = !state.cursor;
  }
  async function loadProducts(more = false) {
    const query = more && state.cursor ? `?cursor=${encodeURIComponent(state.cursor)}` : "";
    const result = await api(`/api/pos-mobile${query}`);
    state.products = more ? state.products.concat(result.products) : result.products;
    state.cursor = result.cursor;
    state.restaurant = result.businessType === "restaurant";
    $("orders-tab").hidden = !state.restaurant;
    $("supplies-tab").hidden = result.businessType !== "restaurant";
    $("notification-controls").hidden = result.businessType !== "restaurant";
    renderProducts();
    if (result.businessType === "restaurant") await loadSupplies();
  }
  function pendingKey() { return `rts-pending-checkout:${state.storeId}:${state.user.username}`; }
  function holdPendingKey() { return `rts-pending-hold:${state.storeId}:${state.user.username}`; }
  function setupPendingKey() { return `rts-pending-setup:${state.storeId}:${state.user.username}`; }
  function checkoutReady() { return state.configConfigured && state.tablesConfigured && !state.pendingSetup; }
  function updateOrderControls() {
    const locked = state.orderBusy || Boolean(state.pendingHold) || Boolean(state.pendingCheckout);
    $("order-form").querySelectorAll("input, select").forEach((input) => { input.disabled = locked; });
    $("save-order").disabled = state.orderBusy || Boolean(state.pendingCheckout);
    $("review-order").disabled = state.orderBusy || Boolean(state.pendingCheckout) || !checkoutReady();
    if (state.pendingHold?.action === "cancel") {
      $("save-order").disabled = true; $("review-order").disabled = true;
    }
    $("cancel-order").disabled = state.orderBusy || Boolean(state.pendingCheckout)
      || (Boolean(state.pendingHold) && state.pendingHold.action !== "cancel")
      || (!state.draft?.revision && state.pendingHold?.action !== "cancel");
    $("new-order").disabled = locked;
    $("pay-cash").disabled = locked || !checkoutReady(); $("pay-card").disabled = locked || !checkoutReady();
    $("pending-hold").hidden = !state.pendingHold;
    $("retry-hold").disabled = state.orderBusy || Boolean(state.pendingCheckout) || !!state.pendingHold?.invalid;
  }
  function setCheckoutPending(payload) {
    if (payload) localStorage.setItem(pendingKey(), JSON.stringify(payload));
    else localStorage.removeItem(pendingKey());
    state.pendingCheckout = payload;
    $("pending-checkout").hidden = !payload;
    updateOrderControls();
  }
  function setHoldPending(payload) {
    if (payload) localStorage.setItem(holdPendingKey(), JSON.stringify(payload));
    else localStorage.removeItem(holdPendingKey());
    state.pendingHold = payload;
    updateOrderControls();
  }
  function restorePending() {
    try {
      const previous = localStorage.getItem(pendingKey());
      if (previous) {
        const pending = JSON.parse(previous);
        if (pending?.action !== "checkout") throw new Error("invalid");
        state.pendingCheckout = pending;
      }
    } catch {
      state.pendingCheckout = { invalid: true };
      notice("تعذر قراءة عملية دفع سابقة؛ تواصل مع الدعم قبل تحصيل أي مبلغ.");
    }
    try {
      const previous = localStorage.getItem(holdPendingKey());
      if (previous) {
        const pending = JSON.parse(previous);
        if (!["hold", "cancel"].includes(pending?.action) || typeof pending.requestId !== "string"
            || typeof pending.holdId !== "string") throw new Error("invalid");
        state.pendingHold = pending;
      }
    } catch {
      state.pendingHold = { invalid: true };
      notice("تعذر قراءة عملية طلب سابقة؛ تواصل مع الدعم قبل المتابعة.");
    }
    if (state.user.role === "admin") {
      try {
        const previous = localStorage.getItem(setupPendingKey());
        if (previous) {
          const pending = JSON.parse(previous);
          if (!["/api/pos-shared-config", "/api/pos-restaurant-tables"].includes(pending?.path)
              || typeof pending.payload?.requestId !== "string") throw new Error("invalid");
          state.pendingSetup = pending;
        }
      } catch {
        state.pendingSetup = { invalid: true };
        notice("تعذر قراءة عملية إعداد سابقة؛ تواصل مع الدعم قبل المتابعة.");
      }
    }
    $("pending-checkout").hidden = !state.pendingCheckout;
    $("retry-checkout").disabled = !!state.pendingCheckout?.invalid;
    updateOrderControls();
  }
  function createDraft() {
    return { id: crypto.randomUUID(), revision: 0, items: [], dirty: false };
  }
  function canEditOrder() {
    if (state.orderBusy || state.pendingHold || state.pendingCheckout) {
      notice("أكمل تأكيد العملية السابقة قبل تعديل الطلب.");
      return false;
    }
    return true;
  }
  function invalidateQuote() { state.quote = null; $("quote-panel").hidden = true; }
  function addToCart(product, variant) {
    if (!canEditOrder()) return;
    if (!state.draft) state.draft = createDraft();
    const color = String(variant.color || "").trim(), size = String(variant.size || "").trim();
    const existing = state.draft.items.find((line) => line.productId === product.id && line.color === color && line.size === size);
    if (existing) existing.qty += 1;
    else state.draft.items.push({ productId: product.id, color, size, qty: 1, note: "" });
    state.draft.dirty = true; invalidateQuote(); renderCart();
    notice("تمت إضافة الصنف إلى الطلب.");
  }
  function productName(line) { return state.products.find((product) => product.id === line.productId)?.name || line.productId; }
  function renderCart() {
    const lines = state.draft?.items || [];
    const rows = lines.map((line, index) => {
      const row = node("div", null, "row"), info = node("div", null, "row-info");
      info.append(node("strong", productName(line)), node("small", `${line.size || line.color || "افتراضي"} · الكمية ${line.qty}`));
      const actions = node("div", null, "actions");
      for (const [label, delta] of [["−", -1], ["+", 1]]) {
        const button = node("button", label, "quiet"); button.type = "button";
        button.setAttribute("aria-label", `${label === "+" ? "زيادة" : "تقليل"} كمية ${productName(line)}`);
        button.addEventListener("click", () => {
          if (!canEditOrder()) return;
          line.qty += delta;
          if (line.qty < 1) state.draft.items.splice(index, 1);
          state.draft.dirty = true; invalidateQuote(); renderCart();
        });
        actions.append(button);
      }
      const noteButton = node("button", line.note ? "تعديل الملاحظة" : "ملاحظة", "quiet"); noteButton.type = "button";
      noteButton.addEventListener("click", () => {
        if (!canEditOrder()) return;
        const value = window.prompt("ملاحظة الصنف", line.note);
        if (value == null) return;
        if (value.length > 300) return notice("ملاحظة الصنف طويلة.");
        line.note = value; state.draft.dirty = true; invalidateQuote(); renderCart();
      });
      if (line.note) info.append(node("small", line.note));
      actions.append(noteButton); row.append(info, actions); return row;
    });
    $("cart-list").replaceChildren(...rows);
    if (!rows.length) $("cart-list").append(node("p", "السلة فارغة. أضف أصنافاً من القائمة."));
  }
  function updateServiceFields() {
    const type = $("order-form").elements.type.value;
    $("table-field").hidden = type !== "dinein";
    $("address-field").hidden = type !== "delivery";
    $("fee-field").hidden = type !== "delivery";
  }
  function draftPayload() {
    const form = $("order-form"), fields = form.elements;
    return {
      items: state.draft.items,
      service: {
        type: fields.type.value, table: fields.type.value === "dinein" ? Number(fields.table.value) : null,
        customerName: fields.customerName.value, phone: fields.phone.value,
        address: fields.type.value === "delivery" ? fields.address.value : "",
        deliveryFee: fields.type.value === "delivery" ? fields.deliveryFee.value : 0,
      },
      note: fields.note.value,
    };
  }
  function applyHold(hold) {
    state.draft = { id: hold.id, revision: hold.revision, items: hold.items.map((item) => ({ ...item })), dirty: false };
    const form = $("order-form").elements, service = hold.service || {};
    for (const name of ["type", "table", "customerName", "phone", "address", "deliveryFee"]) {
      form[name].value = service[name] == null ? "" : service[name];
    }
    form.note.value = hold.note || "";
    updateServiceFields(); invalidateQuote(); renderCart(); updateOrderControls();
  }
  async function loadTables() {
    if (!state.restaurant) return;
    state.tablesConfigured = false; renderSetup();
    const result = await api("/api/pos-restaurant-tables");
    state.tablesConfigured = result.configured === true;
    state.tables = result.tables.filter((table) => !table.archived);
    const select = $("order-form").elements.table, selected = select.value;
    const empty = node("option", result.configured ? "اختر طاولة" : "يجب إعداد الطاولات من المدير");
    empty.value = "";
    const options = state.tables.map((table) => {
      const option = node("option", table.name);
      option.value = String(table.id);
      return option;
    });
    select.replaceChildren(empty, ...options);
    select.value = state.tables.some((table) => String(table.id) === selected) ? selected : "";
    renderSetup();
  }
  async function loadSharedConfig() {
    if (!state.restaurant) return;
    state.configConfigured = false; renderSetup();
    const result = await api("/api/pos-shared-config");
    state.configConfigured = result.configured === true;
    renderSetup();
  }
  function renderSetup() {
    $("restaurant-setup").hidden = !state.restaurant;
    $("setup-admin").hidden = state.user?.role !== "admin";
    $("setup-status").textContent = `الضريبة: ${state.configConfigured ? "مهيأة" : "غير مهيأة"} · الطاولات: ${state.tablesConfigured ? "مهيأة" : "غير مهيأة"}`;
    $("config-setup").hidden = state.configConfigured;
    $("tables-setup").hidden = state.tablesConfigured;
    $("pending-setup").hidden = !state.pendingSetup;
    $("retry-setup").disabled = state.setupBusy || !!state.pendingSetup?.invalid;
    $("cutover-config").disabled = state.setupBusy || !!state.pendingSetup || !state.configPreview;
    $("initialize-config-button").disabled = state.setupBusy || !!state.pendingSetup || !state.noLegacyConfig;
    $("initialize-tables").disabled = state.setupBusy || !!state.pendingSetup || !state.tablesPreview;
    for (const id of ["preview-config", "preview-source", "preview-candidate", "preview-tables", "empty-tables"]) {
      $(id).disabled = state.setupBusy || !!state.pendingSetup;
    }
    updateOrderControls();
  }
  function setSetupPending(value) {
    if (value) localStorage.setItem(setupPendingKey(), JSON.stringify(value));
    else localStorage.removeItem(setupPendingKey());
    state.pendingSetup = value;
    renderSetup();
  }
  async function sendSetup(path, payload) {
    if (state.setupBusy || !navigator.onLine) throw new Error("إعداد المطعم يحتاج اتصالاً بالإنترنت.");
    const generation = state.generation;
    state.setupBusy = true;
    try {
      setSetupPending({ path, payload });
      await api(path, { method: "POST", body: JSON.stringify(payload) });
      setSetupPending(null);
      state.configPreview = null; state.noLegacyConfig = false; state.tablesPreview = null;
      try { await Promise.all([loadSharedConfig(), loadTables()]); }
      catch (error) {
        if (error.code === "STALE_SESSION") throw error;
        notice("تم حفظ الإعداد، لكن تعذر تحديث حالته. لا تكرر العملية.");
        return;
      }
      notice("تم حفظ الإعداد المشترك.");
    } catch (error) {
      if (error.code === "STALE_SESSION") throw error;
      if (error.status && error.status < 500 && error.status !== 401) setSetupPending(null);
      else if (state.pendingSetup) error.message = "تعذر تأكيد الإعداد. استخدم زر تأكيد النتيجة لإعادة العملية نفسها.";
      throw error;
    } finally {
      if (generation === state.generation) { state.setupBusy = false; renderSetup(); }
    }
  }
  async function previewConfig(sourceId = "") {
    const epoch = ++state.previewEpoch;
    state.configPreview = null; state.noLegacyConfig = false;
    $("config-preview").textContent = "";
    renderSetup();
    const query = sourceId ? `&sourceId=${encodeURIComponent(sourceId)}` : "";
    let result;
    try { result = await api(`/api/pos-shared-config?preview=1${query}`); }
    catch (error) {
      if (epoch !== state.previewEpoch && error.code !== "STALE_SESSION") return;
      throw error;
    }
    if (epoch !== state.previewEpoch) return;
    const candidates = Array.isArray(result.candidates) ? result.candidates : [];
    if (!sourceId) {
      const empty = node("option", "اختر سجلاً"); empty.value = "";
      const options = candidates.map((candidate) => {
        const option = node("option", `${candidate.sourceId} · ${candidate.createdAtIso || ""}`);
        option.value = candidate.sourceId; return option;
      });
      $("config-candidates").replaceChildren(empty, ...options);
      state.noLegacyConfig = !result.sourceId && candidates.length === 0;
      $("config-preview").textContent = state.noLegacyConfig
        ? "لا يوجد سجل ضريبي. أدخل الإعدادات الجديدة صراحةً."
        : "اختر سجلاً من القائمة أو أدخل معرّفه، ثم اعرضه قبل الاعتماد.";
    } else {
      if (result.sourceId !== sourceId || !result.sourceRevision || !result.config) throw new Error("تعذر التحقق من السجل المحدد.");
      state.configPreview = { sourceId: result.sourceId, sourceRevision: result.sourceRevision };
      $("config-preview").textContent = JSON.stringify({ sourceId: result.sourceId, sourceRevision: result.sourceRevision, config: result.config }, null, 2);
    }
    renderSetup();
  }
  function previewTables(tables) {
    if (!Array.isArray(tables) || tables.length > 500 || tables.some((table) =>
      !table || typeof table !== "object" || Array.isArray(table)
      || !Number.isInteger(table.id) || table.id < 1 || table.id > 2147483647
      || typeof table.name !== "string" || !table.name.trim() || typeof table.archived !== "boolean")) {
      throw new Error("القائمة غير صالحة. استخدم id رقماً وname نصاً وarchived بقيمة true أو false.");
    }
    state.tablesPreview = structuredClone(tables);
    $("tables-preview").textContent = tables.length ? JSON.stringify(tables, null, 2) : "قائمة فارغة: لن تُضاف طاولات.";
    renderSetup();
  }
  async function loadHolds() {
    if (!state.restaurant) return;
    const result = await api("/api/pos-mobile-orders");
    const rows = result.holds.map((hold) => {
      const row = node("div", null, "row"), info = node("div", null, "row-info");
      const table = state.tables.find((item) => item.id === hold.service?.table);
      const type = { dinein: table?.name || `طاولة ${hold.service?.table}`, takeaway: "سفري", delivery: "توصيل" }[hold.service?.type] || "طلب";
      info.append(node("strong", type), node("small", `${hold.items?.length || 0} أصناف · ${hold.updatedAtIso || ""}`));
      const open = node("button", "فتح الطلب", "quiet"); open.type = "button";
      open.addEventListener("click", () => {
        if (!canEditOrder()) return;
        if (state.draft?.dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد فتح الطلب الآخر؟")) return;
        applyHold(hold); showTab("orders"); notice("");
      });
      row.append(info, open); return row;
    });
    $("held-list").replaceChildren(...rows);
    if (!rows.length) $("held-list").append(node("p", "لا توجد طلبات مفتوحة."));
  }
  async function saveOrder() {
    if (state.pendingCheckout) throw new Error("أكّد نتيجة الدفع السابق أولاً.");
    if (!navigator.onLine) throw new Error("لا يمكن حفظ الطلب دون اتصال.");
    if (state.pendingHold?.invalid) throw new Error("تعذر قراءة عملية الطلب السابقة؛ تواصل مع الدعم.");
    if (state.pendingHold?.action === "cancel") throw new Error("أكّد إلغاء الطلب السابق أولاً.");
    if (state.pendingHold) return sendHold(state.pendingHold);
    if (!state.draft?.items.length) throw new Error("أضف صنفاً إلى الطلب أولاً.");
    const payload = state.pendingHold || {
      action: "hold", requestId: crypto.randomUUID(), holdId: state.draft.id,
      revision: state.draft.revision, ...draftPayload(),
    };
    return sendHold(payload);
  }
  async function sendHold(payload) {
    if (!navigator.onLine) throw new Error("تأكيد الطلب يحتاج اتصالاً بالإنترنت.");
    setHoldPending(payload);
    try {
      const result = await api("/api/pos-mobile-orders", { method: "POST", body: JSON.stringify(payload) });
      setHoldPending(null);
      if (payload.action === "hold") applyHold(result.hold);
      else { state.draft = null; invalidateQuote(); renderCart(); }
      try {
        await loadHolds();
        notice(payload.action === "cancel" ? "تم إلغاء الطلب المفتوح." : "تم حفظ الطلب المفتوح.");
      }
      catch (error) {
        if (error.code === "STALE_SESSION") throw error;
        notice("تم حفظ العملية، لكن تعذر تحديث قائمة الطلبات.");
      }
      return result.hold;
    } catch (error) {
      if (error.code === "STALE_SESSION") throw error;
      if (error.status && error.status < 500 && error.status !== 401) setHoldPending(null);
      else error.message = "تعذر تأكيد الطلب. استخدم زر تأكيد النتيجة لإعادة العملية نفسها.";
      throw error;
    }
  }
  async function runOrderAction(action) {
    if (state.orderBusy || state.pendingCheckout) return;
    const generation = state.generation;
    state.orderBusy = true;
    updateOrderControls();
    try { await action(); } catch (error) { showError(error); }
    finally { if (generation === state.generation) { state.orderBusy = false; updateOrderControls(); } }
  }
  function renderReceipt(bill) {
    state.receipt = bill;
    const lines = [
      "RTS Business", `فاتورة ${bill.billNumber}`, bill.createdAtIso || "",
      ...bill.items.map((item) => `${item.name} · ${item.size || item.color || ""} × ${item.qty}  ₪${Number(item.total).toFixed(2)}`),
      `المجموع الفرعي: ₪${Number(bill.subtotal).toFixed(2)}`,
      `التوصيل: ₪${Number(bill.deliveryFee || 0).toFixed(2)}`,
      `الضريبة ${bill.taxRate}%${bill.taxIncluded ? " (شاملة)" : ""}: ₪${Number(bill.taxAmount).toFixed(2)}`,
      `الإجمالي: ₪${Number(bill.total).toFixed(2)}`,
      `طريقة الدفع: ${bill.paymentMethod === "cash" ? "نقدي" : "بطاقة"}`,
    ];
    $("receipt").textContent = lines.join("\n");
    $("receipt").hidden = false; $("receipt-actions").hidden = false;
  }
  async function sendCheckout(payload) {
    if (state.orderBusy) return;
    if (!navigator.onLine) return notice("الدفع يحتاج اتصالاً بالإنترنت؛ لم تُرسل العملية.");
    if (!state.pendingCheckout && !checkoutReady()) return notice("أكمل إعداد الضريبة والطاولات المشتركة قبل الدفع.");
    const generation = state.generation;
    state.orderBusy = true;
    updateOrderControls();
    let result;
    try {
      try { setCheckoutPending(payload); }
      catch {
        notice("تعذر حفظ بيانات إعادة المحاولة على الجهاز؛ لم يُرسل الدفع.");
        return;
      }
      result = await api("/api/pos-mobile-orders", { method: "POST", body: JSON.stringify(payload) });
      setCheckoutPending(null);
      state.draft = null; invalidateQuote(); renderCart(); renderReceipt(result.bill);
      notice(result.replayed ? "تم تأكيد الفاتورة المحفوظة سابقاً دون تكرار التحصيل." : "تم حفظ الفاتورة وتحديث المخزون.");
    } catch (error) {
      if (error.code === "STALE_SESSION") return;
      if (error.status === 401) {
        reset();
        notice("انتهت الجلسة. سجّل الدخول مجدداً لتأكيد نتيجة الدفع السابق.");
        return;
      }
      if (error.status && error.status < 500 && error.status !== 401) {
        setCheckoutPending(null);
        if (error.code === "QUOTE_CHANGED") invalidateQuote();
        showError(error);
      } else {
        notice("تعذر تأكيد نتيجة الدفع. لا تكرر التحصيل؛ استخدم زر تأكيد النتيجة السابقة.");
      }
    } finally { if (generation === state.generation) { state.orderBusy = false; updateOrderControls(); } }
    if (result) {
      try { await Promise.all([loadHolds(), loadProducts()]); }
      catch { if (generation === state.generation) notice("تم حفظ الفاتورة، لكن تعذر تحديث القوائم. لا تعِد تحصيل المبلغ."); }
    }
  }
  async function supplyAction(action, itemId) {
    if (state.busy || state.pending) return;
    const label = action === "use" ? "الكمية المستخدمة" : action === "adjust" ? "الرصيد الجديد" : "حد التنبيه الجديد";
    const quantity = window.prompt(label + " (حتى 3 منازل عشرية)");
    if (quantity == null) return;
    if (!/^(0|[1-9]\d{0,5})(\.\d{1,3})?$/.test(quantity)) return notice("أدخل كمية صحيحة حتى 3 منازل عشرية.");
    const payload = { action, itemId, requestId: crypto.randomUUID(), [action === "threshold" ? "lowStockThreshold" : "quantity"]: quantity };
    await submitSupply(payload);
  }
  async function submitSupply(payload) {
    const generation = state.generation;
    state.busy = true;
    state.pending = payload;
    notice("جارٍ الحفظ...");
    try {
      const result = await api("/api/pos-supplies", { method: "POST", body: JSON.stringify(payload) });
      state.pending = null;
      notice(result.replayed ? "تم تأكيد العملية المحفوظة سابقاً." : "تم حفظ العملية.");
      try { await loadSupplies(); }
      catch (error) {
        if (error.code !== "STALE_SESSION") notice("تم حفظ العملية، لكن تعذر تحديث القائمة. لا تكرر الخصم.");
      }
    } catch (error) {
      if (error.code === "STALE_SESSION") return;
      if (error.status && error.status < 500) { state.pending = null; showError(error); }
      else {
        notice("تعذر تأكيد الحفظ. اضغط «إعادة تأكيد العملية» لتجنب تكرار الخصم.");
        const retry = node("button", "إعادة تأكيد العملية", "quiet");
        retry.addEventListener("click", () => submitSupply(state.pending), { once: true });
        $("notice").append(" ", retry);
      }
    } finally { if (generation === state.generation) state.busy = false; }
  }
  async function loadSupplies() {
    const result = await api("/api/pos-supplies?auditLimit=1");
    const rows = result.items.map((item) => {
      const row = node("div", null, "row"), info = node("div", null, "row-info");
      info.append(node("strong", item.name), node("small", `${item.category} · ${item.quantity} ${item.unit} · حد التنبيه ${item.lowStockThreshold}`));
      if (item.lowStock) info.append(node("small", "مخزون منخفض", "low"));
      const actions = node("div", null, "actions");
      for (const [action, label] of [["use", "استخدام"], ["adjust", "تعديل الرصيد"], ["threshold", "حد التنبيه"]]) {
        const button = node("button", label, "quiet"); button.type = "button";
        button.addEventListener("click", () => supplyAction(action, item.id));
        actions.append(button);
      }
      row.append(info, actions); return row;
    });
    $("supply-list").replaceChildren(...rows);
    if (!rows.length) $("supply-list").append(node("p", "لا توجد مستلزمات بعد. أضف أول مستلزم من الأسفل."));
    if (result.itemsTruncated) $("supply-list").append(node("p", "القائمة طويلة؛ لا تظهر جميع المستلزمات."));
  }
  async function loadAccounts() {
    if (state.user.role !== "admin") return;
    const result = await api("/api/pos-employees");
    const rows = result.users.map((user) => {
      const row = node("div", null, "row"), info = node("div", null, "row-info");
      info.append(node("strong", user.name), node("small", `${user.username} · ${user.role === "admin" ? "مدير" : "موظف"} · ${user.active ? "نشط" : "موقوف"}`));
      row.append(info); return row;
    });
    $("account-list").replaceChildren(...rows);
  }
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector("button");
    button.disabled = true; notice("جارٍ تسجيل الدخول...");
    try {
      const payload = Object.fromEntries(new FormData(form));
      const result = await api("/api/pos-login", { method: "POST", body: JSON.stringify(payload) });
      if (result.productType !== "business" || !result.token || !result.user) throw new Error("استجابة الدخول غير صالحة.");
      state.generation += 1;
      state.token = result.token; state.user = result.user; state.storeId = result.store?.id || payload.storeId;
      restorePending();
      form.elements.password.value = "";
      $("store-name").textContent = result.store?.name || payload.storeId;
      $("user-name").textContent = result.user.name;
      $("accounts-tab").hidden = result.user.role !== "admin";
      $("login").hidden = true; $("workspace").hidden = false; $("logout").hidden = false;
      $("check-update").hidden = !window.RTSNative;
      showTab("catalog");
      await Promise.all([loadProducts(), loadAccounts()]);
      if (state.restaurant) { await Promise.all([loadTables(), loadSharedConfig()]); await loadHolds(); }
      if (!state.pendingCheckout && !state.pendingHold && !state.pendingSetup) notice("");
      else if (state.pendingCheckout && !state.pendingCheckout.invalid) { showTab("orders"); notice("أكّد نتيجة الدفع السابق قبل إنشاء عملية جديدة."); }
      else if (state.pendingHold && !state.pendingHold.invalid) { showTab("orders"); notice("أكّد نتيجة الطلب السابق قبل إنشاء طلب جديد."); }
      if (window.RTSNative && localStorage.getItem("rts-mobile-notifications") === "enabled"
          && !$("notification-controls").hidden) window.RTSNative.postMessage("notifications");
    } catch (error) { showError(error); }
    finally { button.disabled = false; }
  });
  $("logout").addEventListener("click", async () => {
    const generation = state.generation;
    let failed = false;
    if (state.deviceToken) {
      try {
        await api("/api/pos-mobile-devices", { method: "POST", body: JSON.stringify({ action: "unregister", token: state.deviceToken }) });
      } catch { failed = true; }
    }
    if (generation !== state.generation) return;
    localStorage.removeItem("rts-mobile-notifications");
    reset();
    notice(failed ? "تم تسجيل الخروج. تعذر إلغاء التنبيهات؛ تنتهي تلقائياً خلال 30 يوماً." : "تم تسجيل الخروج.");
  });
  $("check-update").addEventListener("click", async () => {
    if (!window.RTSNative) return notice("تحديث التطبيق متاح من تطبيق Android فقط.");
    $("check-update").disabled = true;
    notice("جارٍ التحقق من تحديث التطبيق...");
    try {
      const response = await fetch("/business-mobile/android-version.json", { cache: "no-store" });
      if (!response.ok) throw new Error("تعذر قراءة إصدار التطبيق.");
      const update = await response.json();
      if (!Number.isInteger(update.versionCode) || typeof update.versionName !== "string"
          || typeof update.apkUrl !== "string") throw new Error("بيانات التحديث غير صالحة.");
      window.RTSNative.postMessage(`update:${JSON.stringify({
        versionCode: update.versionCode,
        versionName: update.versionName,
        apkUrl: new URL(update.apkUrl, location.origin).toString(),
      })}`);
    } catch (error) {
      notice(error.message || "تعذر التحقق من التحديث.");
    } finally {
      $("check-update").disabled = false;
    }
  });
  $("enable-notifications").addEventListener("click", () => {
    if (!window.RTSNative) {
      $("notification-status").textContent = "التنبيهات متاحة من تطبيق Android فقط.";
      return;
    }
    $("notification-status").textContent = "جارٍ إعداد التنبيهات...";
    window.RTSNative.postMessage("notifications");
  });
  if (window.RTSNative) {
    window.RTSNative.onmessage = async (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "permission-requested") {
        $("notification-status").textContent = "بعد السماح بالتنبيهات، اضغط التفعيل مرة أخرى.";
      } else if (data.type === "notifications-disabled") {
        $("notification-status").textContent = "التنبيهات معطلة في إعدادات Android. فعّلها ثم حاول مجدداً.";
      } else if (data.type === "notifications-unavailable") {
        $("notification-status").textContent = "تعذر إعداد خدمة التنبيهات على هذا الجهاز.";
      } else if (data.type === "update-unavailable") {
        notice("أنت تستخدم أحدث إصدار من التطبيق.");
      } else if (data.type === "update-permission-required") {
        notice("اسمح للتطبيق بتثبيت التحديثات من إعدادات Android ثم اضغط تحديث التطبيق مرة أخرى.");
      } else if (data.type === "update-started") {
        notice("بدأ تنزيل التحديث. افتح إشعار التنزيل لتثبيته بعد اكتماله.");
      } else if (data.type === "update-failed") {
        notice("تعذر بدء تحديث التطبيق. تحقق من الاتصال وحاول مجدداً.");
      } else if (data.type === "notification-token" && state.token && typeof data.token === "string") {
        const generation = state.generation;
        try {
          await api("/api/pos-mobile-devices", { method: "POST", body: JSON.stringify({ action: "register", token: data.token }) });
          state.deviceToken = data.token;
          localStorage.setItem("rts-mobile-notifications", "enabled");
          $("notification-status").textContent = "تم تفعيل تنبيهات المخزون على هذا الجهاز لمدة 30 يوماً.";
        } catch { if (generation === state.generation) $("notification-status").textContent = "تعذر تسجيل الجهاز للتنبيهات. تحقق من الإنترنت وحاول مجدداً."; }
      }
    };
  }
  $("refresh").addEventListener("click", () => Promise.all([loadProducts(), loadAccounts(), loadTables(), loadSharedConfig()]).then(loadHolds).then(() => notice("تم التحديث.")).catch(showError));
  $("preview-config").addEventListener("click", () => previewConfig().catch((error) => {
    if (error.code === "CONFIG_PREVIEW_LIMIT") notice("عدد السجلات كبير. أدخل معرّف السجل المطلوب لعرضه بالتحديد.");
    else showError(error);
  }));
  $("preview-source").addEventListener("click", () => {
    const sourceId = $("config-source-id").value.trim();
    if (!sourceId) return notice("أدخل معرّف السجل أولاً.");
    previewConfig(sourceId).catch(showError);
  });
  $("preview-candidate").addEventListener("click", () => {
    const sourceId = $("config-candidates").value;
    if (!sourceId) return notice("اختر سجلاً أولاً.");
    previewConfig(sourceId).catch(showError);
  });
  const invalidateConfigPreview = () => {
    state.previewEpoch += 1; state.configPreview = null; state.noLegacyConfig = false;
    $("config-preview").textContent = ""; renderSetup();
  };
  $("config-source-id").addEventListener("input", invalidateConfigPreview);
  $("config-candidates").addEventListener("change", invalidateConfigPreview);
  $("cutover-config").addEventListener("click", () => {
    if (!state.configPreview || state.pendingSetup || state.setupBusy) return;
    if (!window.confirm("اعتماد السجل المعروض بعد تحديث جميع أجهزة Windows؟ لن يُحذف السجل القديم.")) return;
    sendSetup("/api/pos-shared-config", { action: "cutover", requestId: crypto.randomUUID(), ...state.configPreview }).catch(showError);
  });
  $("initialize-config").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.noLegacyConfig || state.pendingSetup || state.setupBusy) return;
    const fields = event.currentTarget.elements;
    if (!["true", "false"].includes(fields.tax.value) || !["true", "false"].includes(fields.included.value)
        || fields.percent.value.trim() === "") return notice("اختر حالة الضريبة وأدخل نسبتها وطريقة احتسابها.");
    const taxPercent = Number(fields.percent.value);
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) return notice("أدخل نسبة ضريبة من 0 إلى 100.");
    if (!window.confirm("إنشاء هذه الإعدادات بعد تحديث جميع أجهزة Windows؟")) return;
    sendSetup("/api/pos-shared-config", {
      action: "initialize", requestId: crypto.randomUUID(),
      config: { features: { tax: fields.tax.value === "true" }, taxPercent, taxIncluded: fields.included.value === "true" },
    }).catch(showError);
  });
  $("preview-tables").addEventListener("click", () => {
    try { previewTables(JSON.parse($("tables-import").value)); }
    catch (error) { state.tablesPreview = null; renderSetup(); notice(error.message || "تعذر قراءة القائمة."); }
  });
  $("tables-import").addEventListener("input", () => { state.tablesPreview = null; renderSetup(); });
  $("empty-tables").addEventListener("click", () => previewTables([]));
  $("initialize-tables").addEventListener("click", () => {
    if (!state.tablesPreview || state.pendingSetup || state.setupBusy) return;
    if (!window.confirm("اعتماد القائمة المعروضة؟ لن تُنقل طلبات Windows المحلية تلقائياً.")) return;
    sendSetup("/api/pos-restaurant-tables", { action: "initialize", requestId: crypto.randomUUID(), revision: 0, tables: state.tablesPreview }).catch(showError);
  });
  $("retry-setup").addEventListener("click", () => {
    if (!state.pendingSetup || state.pendingSetup.invalid || state.setupBusy) return;
    sendSetup(state.pendingSetup.path, state.pendingSetup.payload).catch(showError);
  });
  $("more").addEventListener("click", () => loadProducts(true).catch(showError));
  $("search").addEventListener("input", renderProducts);
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));
  $("create-supply").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy || state.pending) return;
    const payload = { action: "create", requestId: crypto.randomUUID(), ...Object.fromEntries(new FormData(event.currentTarget)) };
    await submitSupply(payload);
    if (!state.pending) event.currentTarget.reset();
  });
  $("new-order").addEventListener("click", () => {
    if (!canEditOrder()) return;
    if (state.draft?.dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد بدء طلب جديد؟")) return;
    state.draft = createDraft(); $("order-form").reset(); updateServiceFields(); invalidateQuote(); renderCart();
    $("receipt").hidden = true; $("receipt-actions").hidden = true;
  });
  $("order-form").addEventListener("input", () => {
    if (!state.draft) state.draft = createDraft();
    state.draft.dirty = true; invalidateQuote(); updateServiceFields();
  });
  $("order-form").addEventListener("change", updateServiceFields);
  $("save-order").addEventListener("click", () => runOrderAction(async () => {
    await saveOrder();
  }));
  $("review-order").addEventListener("click", () => runOrderAction(async () => {
    if (!checkoutReady()) throw new Error("أكمل إعداد الضريبة والطاولات المشتركة قبل مراجعة الدفع.");
    if (!state.draft?.items.length) throw new Error("أضف صنفاً إلى الطلب أولاً.");
    if (!navigator.onLine) throw new Error("مراجعة المبلغ تحتاج اتصالاً بالإنترنت.");
    if (state.pendingHold || state.draft.dirty || !state.draft.revision) await saveOrder();
    const result = await api("/api/pos-mobile-orders", {
      method: "POST",
      body: JSON.stringify({ action: "quote", requestId: crypto.randomUUID(), holdId: state.draft.id, revision: state.draft.revision }),
    });
    state.quote = result;
    const details = $("quote-details");
    details.replaceChildren(
      ...result.quote.items.map((item) => node("p", `${item.name} × ${item.qty} · ₪${Number(item.total).toFixed(2)}`)),
      node("p", `المجموع الفرعي: ₪${Number(result.quote.subtotal).toFixed(2)}`),
      node("p", `التوصيل: ₪${Number(result.quote.deliveryFee).toFixed(2)}`),
      node("p", `الضريبة ${result.quote.taxRate}%${result.quote.taxIncluded ? " شاملة" : ""}: ₪${Number(result.quote.taxAmount).toFixed(2)}`),
      node("strong", `الإجمالي: ₪${Number(result.quote.total).toFixed(2)}`),
    );
    $("quote-panel").hidden = false; notice("راجع المبلغ وطريقة الدفع قبل التأكيد.");
  }));
  $("cancel-order").addEventListener("click", () => runOrderAction(async () => {
    if (state.pendingHold && state.pendingHold.action !== "cancel") throw new Error("أكّد حفظ الطلب السابق أولاً.");
    if (!state.draft?.revision) throw new Error("لا يوجد طلب محفوظ لإلغائه.");
    if (!navigator.onLine) throw new Error("إلغاء الطلب يحتاج اتصالاً بالإنترنت.");
    if (!state.pendingHold && !window.confirm("إلغاء الطلب المفتوح وتحرير الطاولة؟")) return;
    const payload = state.pendingHold || {
      action: "cancel", requestId: crypto.randomUUID(), holdId: state.draft.id, revision: state.draft.revision,
    };
    await sendHold(payload);
  }));
  $("retry-hold").addEventListener("click", () => runOrderAction(async () => {
    if (!state.pendingHold || state.pendingHold.invalid) return;
    await sendHold(state.pendingHold);
  }));
  for (const [id, method] of [["pay-cash", "cash"], ["pay-card", "card"]]) {
    $(id).addEventListener("click", () => {
      if (!canEditOrder() || !state.draft || !state.quote || state.draft.dirty) return;
      const message = method === "cash"
        ? `تأكيد استلام ₪${Number(state.quote.quote.total).toFixed(2)} نقداً؟`
        : `تأكيد تسجيل ₪${Number(state.quote.quote.total).toFixed(2)} بالبطاقة؟ لا ينفّذ التطبيق الدفع الإلكتروني.`;
      if (!window.confirm(message)) return;
      sendCheckout({
        action: "checkout", requestId: crypto.randomUUID(), holdId: state.draft.id,
        revision: state.draft.revision, quoteHash: state.quote.quoteHash, paymentMethod: method,
      });
    });
  }
  $("retry-checkout").addEventListener("click", () => {
    if (state.pendingCheckout && !state.pendingCheckout.invalid) sendCheckout(state.pendingCheckout);
  });
  $("print-receipt").addEventListener("click", () => {
    if (window.RTSNative) window.RTSNative.postMessage("print"); else window.print();
  });
  $("share-receipt").addEventListener("click", async () => {
    const value = $("receipt").textContent;
    try {
      if (navigator.share) await navigator.share({ title: "RTS Business", text: value });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(value); notice("تم نسخ نص الفاتورة."); }
      else notice("المشاركة غير مدعومة على هذا الجهاز. يمكنك طباعة الفاتورة.");
    } catch { notice("لم تتم مشاركة الفاتورة."); }
  });
  updateServiceFields();
  renderCart();
  window.addEventListener("offline", () => notice("لا يوجد اتصال. لا يمكن حفظ العمليات دون إنترنت."));
  let refreshing = false;
  setInterval(async () => {
    if (!state.token || state.busy || refreshing || document.hidden || $("supplies").hidden) return;
    refreshing = true;
    try { await loadSupplies(); } catch { notice("تعذر تحديث المستلزمات. تحقق من الإنترنت."); }
    finally { refreshing = false; }
  }, 30000);
})();
