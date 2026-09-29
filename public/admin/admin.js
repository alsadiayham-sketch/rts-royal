const I18N = {
  ar: {
    dir: "rtl",
    skipLink: "تخطي إلى المحتوى",
    phoneHelp: "أدخل رمز الدولة ورقم الهاتف. يسري التغيير على وسائل التواصل في الموقع.",
    sectionsLabel: "أقسام الإدارة",
    appTitle: "لوحة إدارة RTS",
    appSubtitle: "إدارة إعدادات العمل والمشرفين",
    backToWebsite: "العودة إلى الموقع",
    loginTitle: "تسجيل الدخول",
    usernameLabel: "اسم المستخدم",
    passwordLabel: "كلمة المرور",
    showPassword: "إظهار",
    hidePassword: "إخفاء",
    loginButton: "دخول",
    tabSettings: "إعدادات العمل",
    tabUsers: "المشرفون",
    tabPassword: "كلمة المرور الخاصة بي",
    logoutButton: "تسجيل الخروج",
    whatsappLabel: "رقم واتساب",
    downloadLabel: "رابط تحميل برنامج POS",
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
    active: "نشط",
    inactive: "معطل",
    recommended: "مطلوب تغيير",
    ready: "محدثة",
    deactivate: "تعطيل",
    activate: "تفعيل",
    welcome: "مرحباً",
    settingsSaved: "تم حفظ الإعدادات.",
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
    appSubtitle: "Manage business settings and administrators",
    backToWebsite: "Back to Website",
    loginTitle: "Sign In",
    usernameLabel: "Username",
    passwordLabel: "Password",
    showPassword: "Show",
    hidePassword: "Hide",
    loginButton: "Sign In",
    tabSettings: "Business Settings",
    tabUsers: "Admins",
    tabPassword: "My Password",
    logoutButton: "Logout",
    whatsappLabel: "WhatsApp Number",
    downloadLabel: "POS Download URL",
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
    active: "Active",
    inactive: "Inactive",
    recommended: "Change recommended",
    ready: "Updated",
    deactivate: "Deactivate",
    activate: "Activate",
    welcome: "Welcome",
    settingsSaved: "Settings saved.",
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
  usersTbody: document.getElementById("users-tbody"),
  addUserForm: document.getElementById("add-user-form"),
  passwordForm: document.getElementById("password-form"),
  langToggle: document.getElementById("lang-toggle"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
};

function t(key) {
  return I18N[state.lang][key] || key;
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
    const payload = {
      whatsappNumber: els.settingsWhatsapp.value.trim(),
      downloadUrl: els.settingsDownload.value.trim(),
    };
    const data = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    els.settingsWhatsapp.value = data.whatsappNumber;
    els.settingsDownload.value = data.downloadUrl;
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
  els.addUserForm.addEventListener("submit", handleAddUser);
  els.passwordForm.addEventListener("submit", handlePasswordChange);
  els.logoutBtn.addEventListener("click", handleLogout);
}

initForms();
initTabs();
initLanguageToggle();
wirePasswordToggleButtons();
updateLanguageUi();
bootstrapSession();
