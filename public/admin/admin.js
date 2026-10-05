const I18N = {
  ar: {
    dir: "rtl",
    skipLink: "تخطي إلى المحتوى",
    phoneHelp: "أدخل رمز الدولة ورقم الهاتف. يسري التغيير على وسائل التواصل في الموقع.",
    sectionsLabel: "أقسام الإدارة",
    appTitle: "لوحة إدارة RTS",
    appSubtitle: "إدارة العمل ومتاجر RTS POS والمشرفين",
    backToWebsite: "العودة إلى الموقع",
    loginTitle: "تسجيل الدخول",
    usernameLabel: "اسم المستخدم",
    passwordLabel: "كلمة المرور",
    showPassword: "إظهار",
    hidePassword: "إخفاء",
    loginButton: "دخول",
    tabSettings: "إعدادات العمل",
    tabStores: "متاجر RTS POS",
    tabUsers: "المشرفون",
    tabPassword: "كلمة المرور الخاصة بي",
    logoutButton: "تسجيل الخروج",
    whatsappLabel: "رقم واتساب",
    downloadLabel: "رابط تحميل برنامج POS",
    contentLabel: "محتوى الصفحة الرئيسية (JSON)",
    contentHelp: "يمكن تعديل رسالة المدير والتقييمات والمحتوى العام. يجب أن يكون JSON صالحاً.",
    heroSlidesLabel: "شرائح البطل (صور وفيديو)",
    heroSlidesHelp: "أضف حتى 8 عناصر. النوع image أو video، والرابط يجب أن يكون HTTPS أو مساراً محلياً يبدأ بـ /.",
    saveSettings: "حفظ الإعدادات",
    nameLabel: "الاسم المعروض",
    statusLabel: "الحالة",
    passwordStatusLabel: "حالة كلمة المرور",
    actionsLabel: "إجراءات",
    addAdminTitle: "إضافة مشرف",
    addAdminButton: "إضافة",
    newPasswordLabel: "كلمة المرور الجديدة",
    confirmPasswordLabel: "تأكيد كلمة المرور",
    currentPasswordLabel: "كلمة المرور الحالية",
    changePasswordButton: "تحديث كلمة المرور",
    adminsTableCaption: "قائمة المشرفين",
    storesIntro: "إنشاء المتاجر وإدارة مدة الترخيص من لوحة RTS المركزية.",
    refreshStores: "تحديث القائمة",
    addStoreTitle: "إضافة متجر جديد",
    storeIdLabel: "معرّف المتجر",
    storeIdHelp: "إنجليزي صغير وأرقام وشرطات فقط. لا يمكن تغييره لاحقاً.",
    storeNameLabel: "اسم المتجر",
    warrantyLabel: "مدة الترخيص بالأشهر",
    backendLabel: "مصدر البيانات",
    backendD1: "RTS POS + موقع إلكتروني — مخزون مشترك",
    backendFirestore: "RTS POS فقط — بدون موقع إلكتروني",
    backendStandalone: "RTS POS فقط",
    linkedProjectLabel: "معرّف مشروع الويب",
    apiUrlLabel: "رابط واجهة المشروع",
    d1UserNote: "تُنشأ حسابات الكاشير من لوحة المشروع المرتبط لأن كلمات المرور مشفرة على الخادم.",
    storeAdminUsernameLabel: "اسم مستخدم المدير الأول",
    storeAdminNameLabel: "اسم المدير المعروض",
    storeAdminPasswordLabel: "كلمة مرور المدير الأول",
    firestoreWarning: "كتالوج مستقل للمتجر. تُدار حسابات المستخدمين وبيانات الدخول مباشرة من RTS.",
    createStore: "إنشاء المتجر",
    storesTableCaption: "قائمة متاجر RTS POS",
    warrantyStatusLabel: "حالة الترخيص",
    noStores: "لا توجد متاجر مسجلة بعد.",
    storeCreated: "تم إنشاء المتجر وأصبح جاهزاً لتسجيل الدخول.",
    licenceActive: "نشط",
    licenceExpired: "منتهي",
    licenceDisabled: "معطل",
    extendLicence: "تمديد",
    disableStore: "تعطيل",
    warrantyPrompt: "عدد أشهر التمديد من اليوم:",
    confirmDisableStore: "تعطيل هذا المتجر؟ لن يتمكن مستخدموه من تسجيل الدخول.",
    licenceUpdated: "تم تحديث ترخيص المتجر.",
    manageStoreUsers: "المستخدمون",
    closeStoreUsers: "إغلاق",
    storeUsersCaption: "مستخدمو متجر RTS POS",
    addStoreUserTitle: "إضافة أو تحديث مستخدم",
    roleLabel: "الدور",
    roleWorker: "كاشير / موظف",
    roleAdmin: "مدير",
    saveStoreUser: "حفظ المستخدم",
    storeUserSaved: "تم حفظ مستخدم المتجر.",
    storeUsersContext: "إدارة حسابات",
    confirmStoreUserDeactivate: "تعطيل هذا المستخدم؟ لن يتمكن من تسجيل الدخول إلى RTS POS.",
    active: "نشط",
    inactive: "معطل",
    recommended: "مطلوب تغيير",
    ready: "محدثة",
    deactivate: "تعطيل",
    activate: "تفعيل",
    welcome: "مرحباً",
    settingsSaved: "تم حفظ الإعدادات.",
    invalidContent: "تحقق من صحة JSON لمحتوى الصفحة الرئيسية.",
    userAdded: "تمت إضافة المشرف.",
    passwordChanged: "تم تغيير كلمة المرور. يرجى تسجيل الدخول مجدداً.",
    loggedOut: "تم تسجيل الخروج.",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    warningChangePassword:
      "تنبيه أمني: كلمة مرور هذا الحساب بحاجة إلى تحديث. يرجى تغييرها في تبويب كلمة المرور.",
    invalidCredentials: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    confirmDeactivate: "هل تريد تعطيل هذا الحساب؟ سيتم تسجيل خروجه من جميع الجلسات.",
    confirmActivate: "هل تريد تفعيل هذا الحساب؟",
    sessionExpired: "انتهت الجلسة. يرجى تسجيل الدخول.",
    serviceUnavailable: "الخدمة غير متاحة حالياً. حاول مرة أخرى لاحقاً.",
    unexpectedError: "حدث خطأ غير متوقع.",
  },
  en: {
    dir: "ltr",
    skipLink: "Skip to content",
    phoneHelp: "Include the country code. Changes apply to the website's contact options.",
    sectionsLabel: "Admin sections",
    appTitle: "RTS Admin Panel",
    appSubtitle: "Manage business settings, RTS POS stores, and administrators",
    backToWebsite: "Back to Website",
    loginTitle: "Sign In",
    usernameLabel: "Username",
    passwordLabel: "Password",
    showPassword: "Show",
    hidePassword: "Hide",
    loginButton: "Sign In",
    tabSettings: "Business Settings",
    tabStores: "RTS POS Stores",
    tabUsers: "Admins",
    tabPassword: "My Password",
    logoutButton: "Logout",
    whatsappLabel: "WhatsApp Number",
    downloadLabel: "POS Download URL",
    contentLabel: "Homepage content (JSON)",
    contentHelp: "Edit the CEO message, testimonials, and general homepage content. The JSON must be valid.",
    heroSlidesLabel: "Hero slides (images and videos)",
    heroSlidesHelp: "Add up to 8 items. Use image or video; URLs must be HTTPS or same-origin paths beginning with /.",
    saveSettings: "Save Settings",
    nameLabel: "Display Name",
    statusLabel: "Status",
    passwordStatusLabel: "Password Status",
    actionsLabel: "Actions",
    addAdminTitle: "Add Admin",
    addAdminButton: "Add Admin",
    newPasswordLabel: "New Password",
    confirmPasswordLabel: "Confirm Password",
    currentPasswordLabel: "Current Password",
    changePasswordButton: "Update Password",
    adminsTableCaption: "Admins list",
    storesIntro: "Create stores and manage licence periods from the central RTS administration panel.",
    refreshStores: "Refresh List",
    addStoreTitle: "Add New Store",
    storeIdLabel: "Store ID",
    storeIdHelp: "Lowercase English letters, numbers, and hyphens only. It cannot be changed later.",
    storeNameLabel: "Store Name",
    warrantyLabel: "Licence Period in Months",
    backendLabel: "Data Source",
    backendD1: "RTS POS + Website — Shared Inventory",
    backendFirestore: "RTS POS Only — No Website",
    backendStandalone: "RTS POS Only",
    linkedProjectLabel: "Website Project ID",
    apiUrlLabel: "Project API URL",
    d1UserNote: "Cashier accounts are created in the linked project admin because passwords are encrypted server-side.",
    storeAdminUsernameLabel: "Initial Admin Username",
    storeAdminNameLabel: "Admin Display Name",
    storeAdminPasswordLabel: "Initial Admin Password",
    firestoreWarning: "An independent store catalogue. User accounts and sign-in details are managed directly from RTS.",
    createStore: "Create Store",
    storesTableCaption: "RTS POS stores list",
    warrantyStatusLabel: "Licence Status",
    noStores: "No stores are registered yet.",
    storeCreated: "The store was created and is ready for sign-in.",
    licenceActive: "Active",
    licenceExpired: "Expired",
    licenceDisabled: "Disabled",
    extendLicence: "Extend",
    disableStore: "Disable",
    warrantyPrompt: "Extension months from today:",
    confirmDisableStore: "Disable this store? Its users will no longer be able to sign in.",
    licenceUpdated: "Store licence updated.",
    manageStoreUsers: "Users",
    closeStoreUsers: "Close",
    storeUsersCaption: "RTS POS store users",
    addStoreUserTitle: "Add or Update User",
    roleLabel: "Role",
    roleWorker: "Cashier / Staff",
    roleAdmin: "Manager",
    saveStoreUser: "Save User",
    storeUserSaved: "Store user saved.",
    storeUsersContext: "Managing accounts for",
    confirmStoreUserDeactivate: "Deactivate this user? They will no longer be able to sign in to RTS POS.",
    active: "Active",
    inactive: "Inactive",
    recommended: "Change recommended",
    ready: "Updated",
    deactivate: "Deactivate",
    activate: "Activate",
    welcome: "Welcome",
    settingsSaved: "Settings saved.",
    invalidContent: "Check that the homepage content is valid JSON.",
    userAdded: "Admin added.",
    passwordChanged: "Password changed. Please sign in again.",
    loggedOut: "Logged out.",
    passwordMismatch: "Passwords do not match.",
    warningChangePassword:
      "Security warning: this account still uses an initial password. Change it from My Password.",
    invalidCredentials: "Invalid username or password.",
    confirmDeactivate: "Deactivate this account? It will be logged out from all sessions.",
    confirmActivate: "Activate this account?",
    sessionExpired: "Session expired. Please sign in.",
    serviceUnavailable: "Service is temporarily unavailable. Try again later.",
    unexpectedError: "Unexpected error occurred.",
  },
};

let state = {
  lang: "ar",
  currentUser: null,
  passwordChangeRecommended: false,
  users: [],
  settings: null,
  stores: [],
  storesLoaded: false,
  currentStore: null,
  storeUsers: [],
  pending: new Set(),
};

const els = {
  html: document.documentElement,
  loginPanel: document.getElementById("login-panel"),
  appPanel: document.getElementById("app-panel"),
  globalStatus: document.getElementById("global-status"),
  globalAlert: document.getElementById("global-alert"),
  passwordWarning: document.getElementById("password-warning"),
  loginForm: document.getElementById("login-form"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  logoutBtn: document.getElementById("logout-btn"),
  settingsForm: document.getElementById("settings-form"),
  settingsWhatsapp: document.getElementById("settings-whatsapp"),
  settingsDownload: document.getElementById("settings-download"),
  settingsContent: document.getElementById("settings-content"),
  settingsHeroSlides: document.getElementById("settings-hero-slides"),
  storeForm: document.getElementById("store-form"),
  storeBackend: document.getElementById("store-backend"),
  storeSubmit: document.getElementById("store-submit"),
  storesRefresh: document.getElementById("stores-refresh"),
  storesTbody: document.getElementById("stores-tbody"),
  storesEmpty: document.getElementById("stores-empty"),
  storeUsersPanel: document.getElementById("store-users-panel"),
  storeUsersTitle: document.getElementById("store-users-title"),
  storeUsersContext: document.getElementById("store-users-context"),
  storeUsersTbody: document.getElementById("store-users-tbody"),
  storeUserForm: document.getElementById("store-user-form"),
  storeUsersClose: document.getElementById("store-users-close"),
  usersTbody: document.getElementById("users-tbody"),
  addUserForm: document.getElementById("add-user-form"),
  passwordForm: document.getElementById("password-form"),
  langToggle: document.getElementById("lang-toggle"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
};

function t(key) {
  return I18N[state.lang][key] || key;
}

function renderStoreUsersTable() {
  els.storeUsersTbody.textContent = "";
  for (const user of state.storeUsers) {
    const row = document.createElement("tr");
    const usernameCell = document.createElement("td");
    usernameCell.dir = "ltr";
    usernameCell.textContent = user.username;
    const nameCell = document.createElement("td");
    nameCell.textContent = user.name;
    const roleCell = document.createElement("td");
    roleCell.textContent = user.role === "admin" ? t("roleAdmin") : t("roleWorker");
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status-pill ${user.active ? "active" : "inactive"}`;
    status.textContent = user.active ? t("active") : t("inactive");
    statusCell.append(status);
    const actionCell = document.createElement("td");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary-btn compact-btn";
    toggle.textContent = user.active ? t("deactivate") : t("activate");
    toggle.addEventListener("click", () => toggleStoreUser(user));
    actionCell.append(toggle);
    row.append(usernameCell, nameCell, roleCell, statusCell, actionCell);
    els.storeUsersTbody.append(row);
  }
}

async function loadStoreUsers() {
  if (!state.currentStore) return;
  const data = await apiFetch(`/api/pos-store-users?storeId=${encodeURIComponent(state.currentStore.id)}`);
  state.storeUsers = data.users || [];
  renderStoreUsersTable();
}

async function openStoreUsers(store) {
  clearMessages();
  state.currentStore = store;
  state.storeUsers = [];
  els.storeUsersTitle.textContent = `${t("manageStoreUsers")} · ${store.name}`;
  els.storeUsersContext.textContent = `${t("storeUsersContext")} ${store.id}`;
  els.storeUsersPanel.classList.remove("hidden");
  els.storeUserForm.reset();
  try {
    await loadStoreUsers();
    els.storeUsersPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("store-user-username").focus({ preventScroll: true });
  } catch (error) {
    showAlert(error.message);
  }
}

function closeStoreUsers() {
  state.currentStore = null;
  state.storeUsers = [];
  els.storeUserForm.reset();
  els.storeUsersPanel.classList.add("hidden");
}

function formatLicenceDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(state.lang === "ar" ? "ar-PS" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

async function handleStoreUserSave(event) {
  event.preventDefault();
  clearMessages();
  if (!state.currentStore || state.pending.has("store-user-save")) return;
  const data = new FormData(els.storeUserForm);
  const payload = {
    storeId: state.currentStore.id,
    username: String(data.get("username") || "").trim(),
    name: String(data.get("name") || "").trim(),
    role: String(data.get("role") || ""),
    password: String(data.get("password") || ""),
  };
  const submit = document.getElementById("store-user-submit");
  setPending("store-user-save", true, submit);
  try {
    await apiFetch("/api/pos-store-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    els.storeUserForm.reset();
    await loadStoreUsers();
    showStatus(t("storeUserSaved"));
  } catch (error) {
    showAlert(error.message);
  } finally {
    setPending("store-user-save", false, submit);
    document.getElementById("store-user-password").value = "";
  }
}

async function toggleStoreUser(user) {
  clearMessages();
  const nextActive = !user.active;
  if (!nextActive && !window.confirm(t("confirmStoreUserDeactivate"))) return;
  const key = `store-user-${user.username}`;
  if (!state.currentStore || state.pending.has(key)) return;
  state.pending.add(key);
  try {
    await apiFetch("/api/pos-store-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: state.currentStore.id,
        username: user.username,
        active: nextActive,
      }),
    });
    await loadStoreUsers();
  } catch (error) {
    showAlert(error.message);
  } finally {
    state.pending.delete(key);
  }
}

function renderStoresTable() {
  if (!els.storesTbody) return;
  els.storesTbody.textContent = "";
  els.storesEmpty.classList.toggle("hidden", state.stores.length !== 0);
  const now = Date.now();
  for (const store of state.stores) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = store.name;
    const idCell = document.createElement("td");
    idCell.dir = "ltr";
    idCell.textContent = store.id;
    const backendCell = document.createElement("td");
    const backendPill = document.createElement("span");
    backendPill.className = `status-pill backend-${store.backend}`;
    backendPill.textContent =
      store.backend === "d1"
        ? `${state.lang === "ar" ? "موقع + POS" : "Website + POS"}${store.linkedProject ? ` · ${store.linkedProject}` : ""}`
        : t("backendStandalone");
    backendCell.append(backendPill);

    const warrantyCell = document.createElement("td");
    const active = store.warrantyEnd && new Date(store.warrantyEnd).getTime() > now;
    const warrantyPill = document.createElement("span");
    warrantyPill.className = `status-pill ${active ? "active" : "inactive"}`;
    warrantyPill.textContent = `${active ? t("licenceActive") : t("licenceExpired")} · ${formatLicenceDate(store.warrantyEnd)}`;
    warrantyCell.append(warrantyPill);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const extend = document.createElement("button");
    extend.type = "button";
    extend.className = "secondary-btn compact-btn";
    extend.textContent = t("extendLicence");
    extend.addEventListener("click", () => updateStoreLicence(store, "extend"));
    actions.append(extend);
    if (active) {
      const disable = document.createElement("button");
      disable.type = "button";
      disable.className = "secondary-btn compact-btn danger-btn";
      disable.textContent = t("disableStore");
      disable.addEventListener("click", () => updateStoreLicence(store, "disable"));
      actions.append(disable);
    }
    if (store.backend === "firestore") {
      const users = document.createElement("button");
      users.type = "button";
      users.className = "secondary-btn compact-btn";
      users.textContent = t("manageStoreUsers");
      users.addEventListener("click", () => openStoreUsers(store));
      actions.prepend(users);
    }
    actionsCell.append(actions);
    row.append(nameCell, idCell, backendCell, warrantyCell, actionsCell);
    els.storesTbody.append(row);
  }
}

function syncStoreBackendFields() {
  const d1 = els.storeBackend.value === "d1";
  document.getElementById("d1-store-fields").classList.toggle("hidden", !d1);
  document.getElementById("firestore-store-fields").classList.toggle("hidden", d1);
  for (const id of ["store-linked-project", "store-api-url"]) {
    document.getElementById(id).required = d1;
  }
  for (const id of ["store-admin-username", "store-admin-name", "store-admin-password"]) {
    document.getElementById(id).required = !d1;
  }
}

async function loadStores() {
  const data = await apiFetch("/api/pos-stores");
  state.stores = data.stores || [];
  state.storesLoaded = true;
  renderStoresTable();
}

async function handleCreateStore(event) {
  event.preventDefault();
  clearMessages();
  if (state.pending.has("create-store")) return;
  const formData = new FormData(els.storeForm);
  const payload = Object.fromEntries(formData.entries());
  payload.warrantyMonths = Number(payload.warrantyMonths);
  if (payload.backend === "d1") {
    delete payload.adminUsername;
    delete payload.adminName;
    delete payload.adminPassword;
  } else {
    delete payload.linkedProject;
    delete payload.apiBaseUrl;
  }

  setPending("create-store", true, els.storeSubmit);
  try {
    await apiFetch("/api/pos-stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    els.storeForm.reset();
    els.storeBackend.value = "d1";
    syncStoreBackendFields();
    clearSensitiveInputs();
    await loadStores();
    showStatus(t("storeCreated"));
  } catch (error) {
    showAlert(error.message);
  } finally {
    setPending("create-store", false, els.storeSubmit);
  }
}

async function updateStoreLicence(store, action) {
  clearMessages();
  const key = `store-${action}-${store.id}`;
  if (state.pending.has(key)) return;
  let warrantyMonths;
  if (action === "extend") {
    const value = window.prompt(t("warrantyPrompt"), "12");
    if (value === null) return;
    warrantyMonths = Number(value);
    if (!Number.isInteger(warrantyMonths) || warrantyMonths < 1 || warrantyMonths > 60) {
      showAlert(state.lang === "ar" ? "أدخل عدداً من 1 إلى 60 شهراً." : "Enter a period from 1 to 60 months.");
      return;
    }
  } else if (!window.confirm(t("confirmDisableStore"))) {
    return;
  }

  state.pending.add(key);
  try {
    await apiFetch("/api/pos-stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: store.id,
        action,
        ...(action === "extend" ? { warrantyMonths } : {}),
      }),
    });
    await loadStores();
    showStatus(t("licenceUpdated"));
  } catch (error) {
    showAlert(error.message);
  } finally {
    state.pending.delete(key);
  }
}

function clearMessages() {
  els.globalStatus.textContent = "";
  els.globalAlert.textContent = "";
  els.globalStatus.classList.add("hidden");
  els.globalAlert.classList.add("hidden");
}

function showStatus(message) {
  if (!message) return;
  els.globalStatus.textContent = message;
  els.globalStatus.classList.remove("hidden");
}

function showAlert(message) {
  if (!message) return;
  els.globalAlert.textContent = message;
  els.globalAlert.classList.remove("hidden");
}

function updateLanguageUi() {
  const dict = I18N[state.lang];
  els.html.lang = state.lang;
  els.html.dir = dict.dir;
  document.title = dict.appTitle;
  document.querySelector(".sidebar").setAttribute("aria-label", dict.sectionsLabel);
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const key = node.getAttribute("data-i18n");
    node.textContent = dict[key] || key;
  }

  els.langToggle.textContent = state.lang === "ar" ? "English" : "العربية";
  for (const button of document.querySelectorAll(".toggle-password")) {
    const input = document.getElementById(button.dataset.target);
    button.textContent = input.type === "password" ? t("showPassword") : t("hidePassword");
  }
  els.passwordWarning.textContent = state.passwordChangeRecommended ? t("warningChangePassword") : "";
  els.passwordWarning.classList.toggle("hidden", !state.passwordChangeRecommended);
  renderUsersTable();
  renderStoresTable();
  renderStoreUsersTable();
  if (state.currentStore) {
    els.storeUsersTitle.textContent = `${t("manageStoreUsers")} · ${state.currentStore.name}`;
    els.storeUsersContext.textContent = `${t("storeUsersContext")} ${state.currentStore.id}`;
  }
}

function mapApiError(errorCode, fallbackMessage) {
  const dictionary = {
    AUTH_REQUIRED: t("sessionExpired"),
    AUTH_FAILED: t("invalidCredentials"),
    SERVICE_UNAVAILABLE: t("serviceUnavailable"),
    WEAK_PASSWORD:
      state.lang === "ar"
        ? "كلمة المرور يجب أن تكون بين 12 و128 حرفاً."
        : "Password must be between 12 and 128 characters.",
    LAST_ADMIN_FORBIDDEN:
      state.lang === "ar"
        ? "لا يمكن تعطيل آخر مشرف نشط."
        : "Cannot deactivate the last active admin.",
    SELF_DEACTIVATE_FORBIDDEN:
      state.lang === "ar" ? "لا يمكنك تعطيل حسابك." : "You cannot deactivate your own account.",
    INVALID_WHATSAPP_NUMBER:
      state.lang === "ar"
        ? "رقم واتساب يجب أن يكون من 8 إلى 15 رقماً."
        : "WhatsApp number must be 8-15 digits.",
    INVALID_DOWNLOAD_URL:
      state.lang === "ar" ? "رابط التحميل غير مسموح." : "Download URL is not allowed.",
    USERNAME_EXISTS:
      state.lang === "ar" ? "اسم المستخدم مستخدم مسبقاً." : "Username already exists.",
    ORIGIN_FORBIDDEN:
      state.lang === "ar" ? "الطلب غير مسموح من هذا المصدر." : "Request origin is not allowed.",
    UNKNOWN_FIELDS:
      state.lang === "ar" ? "تم إرسال حقول غير معروفة." : "Unknown fields were provided.",
    STORE_EXISTS:
      state.lang === "ar" ? "معرّف المتجر مستخدم بالفعل." : "Store ID already exists.",
    POS_REGISTRY_UNAVAILABLE:
      state.lang === "ar"
        ? "تعذر الوصول إلى سجل متاجر نقطة البيع."
        : "The POS store registry is currently unavailable.",
    LAST_POS_ADMIN_FORBIDDEN:
      state.lang === "ar"
        ? "لا يمكن تعطيل آخر مدير نشط للمتجر."
        : "The last active store manager cannot be disabled.",
  };

  return dictionary[errorCode] || fallbackMessage || t("unexpectedError");
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      "Cache-Control": "no-store",
      ...(options.headers || {}),
    },
    ...options,
  });

  const isJson = (response.headers.get("Content-Type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) {
    const code = payload?.error?.code;
    const message = payload?.error?.message;
    const err = new Error(mapApiError(code, message));
    err.status = response.status;
    err.code = code;
    throw err;
  }
  return payload;
}

function setPending(key, active, button) {
  if (active) {
    state.pending.add(key);
  } else {
    state.pending.delete(key);
  }
  if (button) {
    button.disabled = active;
  }
}

function switchTab(name) {
  for (const btn of els.tabButtons) {
    btn.classList.toggle("active", btn.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll(".tab-panel")) {
    panel.classList.toggle("hidden", panel.id !== `tab-${name}`);
  }

  if (name === "settings") {
    els.settingsWhatsapp.focus();
  } else if (name === "users") {
    document.getElementById("add-username").focus();
  } else if (name === "stores") {
    document.getElementById("store-id").focus();
    if (!state.storesLoaded) loadStores().catch((error) => showAlert(error.message));
  } else if (name === "password") {
    document.getElementById("current-password").focus();
  }
}

function clearSensitiveInputs() {
  els.loginPassword.value = "";
  document.getElementById("add-password").value = "";
  document.getElementById("add-password-confirm").value = "";
  document.getElementById("current-password").value = "";
  document.getElementById("new-password").value = "";
  document.getElementById("new-password-confirm").value = "";
  document.getElementById("store-admin-password").value = "";
  for (const button of document.querySelectorAll(".toggle-password")) {
    document.getElementById(button.dataset.target).type = "password";
    button.textContent = t("showPassword");
  }
}

function renderUsersTable() {
  if (!els.usersTbody) return;
  els.usersTbody.textContent = "";
  for (const user of state.users) {
    const row = document.createElement("tr");

    const usernameCell = document.createElement("td");
    usernameCell.textContent = user.username;

    const nameCell = document.createElement("td");
    nameCell.textContent = user.name;

    const statusCell = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = `status-pill ${user.active ? "active" : "inactive"}`;
    statusPill.textContent = user.active ? t("active") : t("inactive");
    statusCell.append(statusPill);

    const passwordCell = document.createElement("td");
    passwordCell.textContent = user.passwordChangeRecommended ? t("recommended") : t("ready");

    const actionCell = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary-btn";
    btn.textContent = user.active ? t("deactivate") : t("activate");
    btn.disabled = Boolean(
      state.pending.has(`toggle-${user.username}`) ||
        (!user.active && !state.currentUser) ||
        user.username === state.currentUser?.username
    );
    btn.addEventListener("click", () => toggleUser(user));
    actionCell.append(btn);

    row.append(usernameCell, nameCell, statusCell, passwordCell, actionCell);
    els.usersTbody.append(row);
  }
}

async function loadSettings() {
  const data = await apiFetch("/api/settings");
  state.settings = data;
  els.settingsWhatsapp.value = data.whatsappNumber ?? "";
  els.settingsDownload.value = data.downloadUrl ?? "";
  els.settingsContent.value = JSON.stringify(data.content || {}, null, 2);
  const heroSlides = Array.isArray(data.content?.heroSlides)
    ? data.content.heroSlides
    : Array.isArray(data.content?.heroMedia)
      ? data.content.heroMedia
      : [];
  els.settingsHeroSlides.value = JSON.stringify(heroSlides, null, 2);
}

async function loadUsers() {
  const data = await apiFetch("/api/users");
  state.users = data.users || [];
  renderUsersTable();
}

async function bootstrapSession() {
  clearMessages();
  try {
    const session = await apiFetch("/api/session");
    state.currentUser = session.user;
    state.passwordChangeRecommended = Boolean(session.passwordChangeRecommended);
    els.loginPanel.classList.add("hidden");
    els.appPanel.classList.remove("hidden");
    els.passwordWarning.classList.toggle("hidden", !state.passwordChangeRecommended);
    els.passwordWarning.textContent = state.passwordChangeRecommended ? t("warningChangePassword") : "";
    showStatus(`${t("welcome")} ${session.user.name}`);
    await Promise.all([loadSettings(), loadUsers()]);
    switchTab("settings");
  } catch (error) {
    state.currentUser = null;
    state.passwordChangeRecommended = false;
    els.appPanel.classList.add("hidden");
    els.loginPanel.classList.remove("hidden");
    els.passwordWarning.classList.add("hidden");
    if (error.status === 401) {
      els.loginUsername.focus();
      return;
    }
    showAlert(error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearMessages();
  if (state.pending.has("login")) return;
  setPending("login", true, document.getElementById("login-submit"));
  try {
    const payload = {
      username: els.loginUsername.value.trim(),
      password: els.loginPassword.value,
    };
    await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    els.loginForm.reset();
    await bootstrapSession();
  } catch (error) {
    showAlert(error.message);
    els.loginPassword.value = "";
    els.loginPassword.focus();
  } finally {
    setPending("login", false, document.getElementById("login-submit"));
  }
}

async function handleLogout() {
  clearMessages();
  if (state.pending.has("logout")) return;
  setPending("logout", true, els.logoutBtn);
  try {
    await apiFetch("/api/logout", { method: "POST" });
    state.users = [];
    state.settings = null;
    state.stores = [];
    state.storesLoaded = false;
    closeStoreUsers();
    clearSensitiveInputs();
    await bootstrapSession();
    showStatus(t("loggedOut"));
  } catch (error) {
    showAlert(error.message);
  } finally {
    setPending("logout", false, els.logoutBtn);
  }
}

async function handleSaveSettings(event) {
  event.preventDefault();
  clearMessages();
  const submit = document.getElementById("settings-submit");
  if (state.pending.has("settings")) return;
  setPending("settings", true, submit);
  try {
    let content;
    try {
      content = JSON.parse(els.settingsContent.value || "{}");
      if (!content || typeof content !== "object" || Array.isArray(content)) throw new Error("Invalid content");
    } catch {
      showAlert(t("invalidContent"));
      setPending("settings", false, submit);
      return;
    }
    let heroSlides;
    try {
      heroSlides = JSON.parse(els.settingsHeroSlides.value || "[]");
      if (!Array.isArray(heroSlides)) throw new Error("Invalid hero slides");
    } catch {
      showAlert(t("invalidContent"));
      setPending("settings", false, submit);
      return;
    }
    content.heroSlides = heroSlides;
    const payload = {
      whatsappNumber: els.settingsWhatsapp.value.trim(),
      downloadUrl: els.settingsDownload.value.trim(),
      content,
    };
    const data = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    els.settingsWhatsapp.value = data.whatsappNumber;
    els.settingsDownload.value = data.downloadUrl;
    els.settingsContent.value = JSON.stringify(data.content || {}, null, 2);
    els.settingsHeroSlides.value = JSON.stringify(data.content?.heroSlides || [], null, 2);
    showStatus(t("settingsSaved"));
  } catch (error) {
    showAlert(error.message);
  } finally {
    setPending("settings", false, submit);
  }
}

async function handleAddUser(event) {
  event.preventDefault();
  clearMessages();
  const submit = document.getElementById("add-user-submit");
  if (state.pending.has("add-user")) return;

  const username = document.getElementById("add-username").value.trim();
  const name = document.getElementById("add-name").value.trim();
  const password = document.getElementById("add-password").value;
  const passwordConfirm = document.getElementById("add-password-confirm").value;
  if (password !== passwordConfirm) {
    showAlert(t("passwordMismatch"));
    return;
  }

  setPending("add-user", true, submit);
  try {
    await apiFetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, name, password }),
    });
    els.addUserForm.reset();
    clearSensitiveInputs();
    await loadUsers();
    showStatus(t("userAdded"));
  } catch (error) {
    showAlert(error.message);
  } finally {
    setPending("add-user", false, submit);
  }
}

async function toggleUser(user) {
  clearMessages();
  const nextActive = !user.active;
  const confirmed = window.confirm(nextActive ? t("confirmActivate") : t("confirmDeactivate"));
  if (!confirmed) return;

  const key = `toggle-${user.username}`;
  if (state.pending.has(key)) return;
  state.pending.add(key);
  renderUsersTable();
  try {
    await apiFetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, active: nextActive }),
    });
    await loadUsers();
  } catch (error) {
    showAlert(error.message);
  } finally {
    state.pending.delete(key);
    renderUsersTable();
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  clearMessages();
  const submit = document.getElementById("password-submit");
  if (state.pending.has("password-change")) return;

  const currentPassword = document.getElementById("current-password").value;
  const newPassword = document.getElementById("new-password").value;
  const newPasswordConfirm = document.getElementById("new-password-confirm").value;
  if (newPassword !== newPasswordConfirm) {
    showAlert(t("passwordMismatch"));
    return;
  }

  setPending("password-change", true, submit);
  try {
    await apiFetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    clearSensitiveInputs();
    state.currentUser = null;
    state.passwordChangeRecommended = false;
    state.users = [];
    state.settings = null;
    els.appPanel.classList.add("hidden");
    els.loginPanel.classList.remove("hidden");
    els.passwordWarning.classList.add("hidden");
    showStatus(t("passwordChanged"));
    document.getElementById("login-username").focus();
  } catch (error) {
    showAlert(error.message);
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
    document.getElementById("new-password-confirm").value = "";
    document.getElementById("current-password").focus();
  } finally {
    setPending("password-change", false, submit);
  }
}

function wirePasswordToggleButtons() {
  for (const button of document.querySelectorAll(".toggle-password")) {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.textContent = isHidden ? t("hidePassword") : t("showPassword");
    });
  }
}

function initTabs() {
  for (const btn of els.tabButtons) {
    btn.addEventListener("click", () => {
      clearMessages();
      switchTab(btn.dataset.tab);
    });
  }
}

function initLanguageToggle() {
  els.langToggle.addEventListener("click", () => {
    state.lang = state.lang === "ar" ? "en" : "ar";
    updateLanguageUi();
  });
}

function initForms() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.settingsForm.addEventListener("submit", handleSaveSettings);
  els.storeForm.addEventListener("submit", handleCreateStore);
  els.storeUserForm.addEventListener("submit", handleStoreUserSave);
  els.storeUsersClose.addEventListener("click", closeStoreUsers);
  els.storeBackend.addEventListener("change", syncStoreBackendFields);
  els.storesRefresh.addEventListener("click", () => {
    clearMessages();
    loadStores().catch((error) => showAlert(error.message));
  });
  els.addUserForm.addEventListener("submit", handleAddUser);
  els.passwordForm.addEventListener("submit", handlePasswordChange);
  els.logoutBtn.addEventListener("click", handleLogout);
}

initForms();
initTabs();
initLanguageToggle();
wirePasswordToggleButtons();
syncStoreBackendFields();
updateLanguageUi();
bootstrapSession();
