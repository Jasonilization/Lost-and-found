const API_PORT = "8000";
const API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const API_BASE = window.location.hostname
  ? window.location.port === API_PORT
    ? `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
    : `${API_PROTOCOL}//${window.location.hostname}:${API_PORT}`
  : "";
const SESSION_STORAGE_KEY = "lostfound_session";
const THEME_STORAGE_KEY = "lostfound_theme";
const CURRENT_ITEM_STORAGE_KEY = "lostfound_current_item";
const LANGUAGE_STORAGE_KEY = "lostfound_language";
const CHAT_MODE_STORAGE_KEY = "lostfound_chat_mode";
const INITIALS_PATTERN = /^[a-z]+(?:\.[a-z]+)+$/;
const THEMES = ["dark", "light", "aurora"];
const SUPPORTED_LANGUAGES = ["en", "zh-CN"];
const CHAT_MODES = ["ai", "free"];

const translations = {
  en: {
    "page.title": "School Lost and Found",
    "app.name": "Lost and Found",
    "status.checkingBackend": "Checking backend...",
    "status.checkingOllama": "Checking Ollama...",
    "status.backendOnline": "Backend online on port 8000",
    "status.backendOffline": "Backend offline",
    "status.ollamaUnavailable": "Ollama unavailable",
    "auth.eyebrow": "School account",
    "auth.hero": "Sign in to report lost items, track claims, and move item questions into a dedicated chat page.",
    "auth.tabs": "Authentication tabs",
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.initials": "Initials",
    "auth.classOf": "Class of",
    "topbar.eyebrow": "Local campus desk",
    "topbar.hero": "Reports stay local, admin actions stay guarded, and item questions live in their own chat page.",
    "topbar.theme": "Theme",
    "topbar.language": "Language",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "theme.aurora": "Aurora",
    "nav.reports": "Reports",
    "nav.query": "Query",
    "nav.claims": "My Claims",
    "nav.account": "Account",
    "nav.admin": "Admin Panel",
    "nav.logout": "Logout",
    "report.eyebrow": "New report",
    "report.title": "Upload a lost item",
    "report.lostOnly": "Lost only",
    "report.dropTitle": "Drop image here",
    "report.dropHint": "or choose a JPG/PNG file",
    "report.itemTitle": "Item title",
    "report.itemTitlePlaceholder": "Blue water bottle",
    "report.displayName": "Display name",
    "report.displayNamePlaceholder": "How this report should display",
    "report.predefinedLocation": "Predefined location",
    "report.roomCode": "Room code",
    "report.chooseLocation": "Choose location",
    "report.descriptionPlaceholder": "Add color, brand, markings, or details that would help someone confirm it.",
    "report.supportingEvidence": "Supporting evidence",
    "report.evidencePlaceholder": "Optional: ownership clues, identifying marks, timeline, or extra evidence.",
    "report.save": "Save report",
    "reports.eyebrow": "Reports",
    "reports.title": "Live search",
    "reports.searchPlaceholder": "Search description, tags, or location",
    "claims.refresh": "Refresh claims",
    "admin.eyebrow": "Admin tools",
    "admin.title": "Admin Panel",
    "admin.refresh": "Refresh admin data",
    "admin.users": "Users",
    "admin.items": "Items",
    "admin.claims": "Claims",
    "admin.aiInspection": "AI Inspection",
    "admin.identity": "Identity",
    "admin.role": "Role",
    "admin.created": "Created",
    "admin.actions": "Actions",
    "query.eyebrow": "Item chat",
    "query.title": "Query page",
    "query.back": "Back to reports",
    "query.selectItem": "Select item",
    "query.generalInquiry": "General inquiry",
    "query.generalNote": "Use general inquiry for questions without a selected item.",
    "query.refreshItems": "Refresh item list",
    "query.chatMode": "Chat mode",
    "query.aiChat": "AI Chat",
    "query.freeChat": "Free Chat (No AI)",
    "query.selectAnItem": "Select an item",
    "query.selectOrGeneral": "Select a report or use general inquiry mode.",
    "query.noMessages": "No messages yet.",
    "query.askAboutItem": "Ask about this item",
    "query.send": "Send message",
    "common.category": "Category",
    "common.date": "Date",
    "common.location": "Location",
    "common.description": "Description",
    "common.status": "Status",
    "common.search": "Search",
    "common.refresh": "Refresh",
    "common.all": "All",
    "common.yes": "Yes",
    "common.no": "No",
  },
  "zh-CN": {
    "page.title": "校园失物招领",
    "app.name": "失物招领",
    "status.checkingBackend": "正在检查后端...",
    "status.checkingOllama": "正在检查 Ollama...",
    "status.backendOnline": "后端已连接，端口 8000",
    "status.backendOffline": "后端离线",
    "status.ollamaUnavailable": "Ollama 不可用",
    "auth.eyebrow": "校园账号",
    "auth.hero": "登录后即可提交失物报告、追踪认领记录，并在独立聊天页中咨询物品问题。",
    "auth.tabs": "身份验证标签",
    "auth.login": "登录",
    "auth.register": "注册",
    "auth.username": "用户名",
    "auth.password": "密码",
    "auth.initials": "姓名缩写",
    "auth.classOf": "毕业年份",
    "topbar.eyebrow": "校园服务台",
    "topbar.hero": "报告仅保存在本地，管理员操作受到保护，物品问题会进入独立聊天页。",
    "topbar.theme": "主题",
    "topbar.language": "语言",
    "theme.dark": "深色",
    "theme.light": "浅色",
    "theme.aurora": "极光",
    "nav.reports": "报告",
    "nav.query": "聊天",
    "nav.claims": "我的认领",
    "nav.account": "账号",
    "nav.admin": "管理面板",
    "nav.logout": "退出登录",
    "report.eyebrow": "新报告",
    "report.title": "上传失物报告",
    "report.lostOnly": "仅限遗失",
    "report.dropTitle": "将图片拖到这里",
    "report.dropHint": "或选择 JPG/PNG 文件",
    "report.itemTitle": "物品标题",
    "report.itemTitlePlaceholder": "蓝色水瓶",
    "report.displayName": "显示名称",
    "report.displayNamePlaceholder": "报告展示给他人的名称",
    "report.predefinedLocation": "预设地点",
    "report.roomCode": "教室代码",
    "report.chooseLocation": "选择地点",
    "report.descriptionPlaceholder": "补充颜色、品牌、标记或其他便于确认物品的信息。",
    "report.supportingEvidence": "补充证据",
    "report.evidencePlaceholder": "可选：所有权线索、识别标记、时间线或其他证据。",
    "report.save": "保存报告",
    "reports.eyebrow": "报告",
    "reports.title": "实时搜索",
    "reports.searchPlaceholder": "搜索描述、标签或地点",
    "claims.refresh": "刷新认领记录",
    "admin.eyebrow": "管理工具",
    "admin.title": "管理面板",
    "admin.refresh": "刷新管理数据",
    "admin.users": "用户",
    "admin.items": "物品",
    "admin.claims": "认领",
    "admin.aiInspection": "AI 检查",
    "admin.identity": "身份",
    "admin.role": "角色",
    "admin.created": "创建时间",
    "admin.actions": "操作",
    "query.eyebrow": "物品聊天",
    "query.title": "咨询页面",
    "query.back": "返回报告",
    "query.selectItem": "选择物品",
    "query.generalInquiry": "一般咨询",
    "query.generalNote": "未选择具体物品时可使用一般咨询。",
    "query.refreshItems": "刷新物品列表",
    "query.chatMode": "聊天模式",
    "query.aiChat": "AI 聊天",
    "query.freeChat": "自由聊天（无 AI）",
    "query.selectAnItem": "选择一个物品",
    "query.selectOrGeneral": "选择一条报告，或使用一般咨询模式。",
    "query.noMessages": "还没有消息。",
    "query.askAboutItem": "询问这个物品",
    "query.send": "发送消息",
    "common.category": "分类",
    "common.date": "日期",
    "common.location": "地点",
    "common.description": "描述",
    "common.status": "状态",
    "common.search": "搜索",
    "common.refresh": "刷新",
    "common.all": "全部",
    "common.yes": "是",
    "common.no": "否",
  },
};

const localizedValues = {
  "zh-CN": {
    Electronics: "电子产品",
    "ID Card": "学生证",
    Books: "书籍",
    Stationery: "文具",
    Uniform: "校服",
    Bag: "包",
    Bottle: "水瓶",
    Keys: "钥匙",
    "Sports Gear": "运动用品",
    Other: "其他",
    Open: "开放",
    Matched: "匹配",
    Claimed: "已认领",
    Archived: "已归档",
    "New Sports Hall": "新体育馆",
    "Sports Hall": "体育馆",
    "Long Court": "长球场",
    Library: "图书馆",
    "Morris Forum": "Morris 论坛",
    "Senior Building": "高中部大楼",
    "Primary Building": "小学部大楼",
    "Innovation Building": "创新楼",
  },
};

const predefinedLocations = [
  "New Sports Hall",
  "Sports Hall",
  "Long Court",
  "Library",
  "Morris Forum",
];

const buildings = {
  S: "Senior Building",
  P: "Primary Building",
  A: "Innovation Building",
};

const fallbackFilters = {
  categories: [
    "Electronics",
    "ID Card",
    "Books",
    "Stationery",
    "Uniform",
    "Bag",
    "Bottle",
    "Keys",
    "Sports Gear",
    "Other",
  ],
  statuses: ["Open", "Matched", "Claimed", "Archived"],
  locations: [
    ...predefinedLocations,
    "Senior Building",
    "Primary Building",
    "Innovation Building",
  ],
};

const state = {
  authView: "login",
  user: null,
  token: localStorage.getItem(SESSION_STORAGE_KEY) || "",
  items: [],
  claims: [],
  adminUsers: [],
  adminItems: [],
  adminClaims: [],
  aiInspectionLogs: [],
  adminTab: "users",
  filters: fallbackFilters,
  selectedFile: null,
  previewUrls: new Map(),
  searchTimer: null,
  activeClaimItem: null,
  currentView: "reports",
  currentItemId: Number(localStorage.getItem(CURRENT_ITEM_STORAGE_KEY) || "") || null,
  currentQueryItem: null,
  queryItems: [],
  queryMessages: [],
  querySuggestions: [],
  queryRequestToken: null,
  language: localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en",
  chatMode: localStorage.getItem(CHAT_MODE_STORAGE_KEY) || "ai",
};

const authScreen = document.querySelector("#authScreen");
const appShell = document.querySelector("#appShell");
const authForm = document.querySelector("#authForm");
const authUsername = document.querySelector("#authUsername");
const authPassword = document.querySelector("#authPassword");
const authInitials = document.querySelector("#authInitials");
const authClassOf = document.querySelector("#authClassOf");
const registerFields = document.querySelector("#registerFields");
const authMessage = document.querySelector("#authMessage");
const authSubmitButton = document.querySelector("#authSubmitButton");
const authSubmitLabel = document.querySelector("#authSubmitLabel");
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");

const serverStatus = document.querySelector("#serverStatus");
const ollamaStatus = document.querySelector("#ollamaStatus");

const showReportsButton = document.querySelector("#showReportsButton");
const showQueryButton = document.querySelector("#showQueryButton");
const showClaimsButton = document.querySelector("#showClaimsButton");
const showAccountButton = document.querySelector("#showAccountButton");
const showAdminButton = document.querySelector("#showAdminButton");
const themeSelect = document.querySelector("#themeSelect");
const languageSelect = document.querySelector("#languageSelect");
const logoutButton = document.querySelector("#logoutButton");
const accountName = document.querySelector("#accountName");
const accountMeta = document.querySelector("#accountMeta");
const reportsSection = document.querySelector("#reportsSection");
const claimsSection = document.querySelector("#claimsSection");
const accountSection = document.querySelector("#accountSection");
const adminSection = document.querySelector("#adminSection");
const querySection = document.querySelector("#querySection");

const form = document.querySelector("#itemForm");
const dropZone = document.querySelector("#dropZone");
const imageInput = document.querySelector("#imageInput");
const dropTitle = document.querySelector("#dropTitle");
const dropHint = document.querySelector("#dropHint");
const reporterInput = document.querySelector("#reporterInput");
const titleInput = document.querySelector("#titleInput");
const categoryInput = document.querySelector("#categoryInput");
const categoryFilter = document.querySelector("#categoryFilter");
const statusFilter = document.querySelector("#statusFilter");
const locationFilter = document.querySelector("#locationFilter");
const predefinedLocation = document.querySelector("#predefinedLocation");
const predefinedWrap = document.querySelector("#predefinedWrap");
const roomWrap = document.querySelector("#roomWrap");
const roomCodeInput = document.querySelector("#roomCodeInput");
const locationPreview = document.querySelector("#locationPreview");
const locationError = document.querySelector("#locationError");
const dateInput = document.querySelector("#dateInput");
const descriptionInput = document.querySelector("#descriptionInput");
const evidenceDetailsInput = document.querySelector("#evidenceDetailsInput");
const uploadMessage = document.querySelector("#uploadMessage");
const reportWarningCard = document.querySelector("#reportWarningCard");
const submitButton = document.querySelector("#submitButton");

const gallery = document.querySelector("#gallery");
const itemTemplate = document.querySelector("#itemTemplate");
const resultCount = document.querySelector("#resultCount");
const searchInput = document.querySelector("#searchInput");
const searchLoading = document.querySelector("#searchLoading");
const searchWarningCard = document.querySelector("#searchWarningCard");
const refreshButton = document.querySelector("#refreshButton");

const claimsList = document.querySelector("#claimsList");
const claimsCount = document.querySelector("#claimsCount");
const claimsLoading = document.querySelector("#claimsLoading");
const refreshClaimsButton = document.querySelector("#refreshClaimsButton");
const claimHistoryTemplate = document.querySelector("#claimHistoryTemplate");

const accountAvatar = document.querySelector("#accountAvatar");
const accountPageName = document.querySelector("#accountPageName");
const accountPageIdentity = document.querySelector("#accountPageIdentity");
const accountAdminBadge = document.querySelector("#accountAdminBadge");
const accountInfoList = document.querySelector("#accountInfoList");
const profileImageInput = document.querySelector("#profileImageInput");
const profileImageButton = document.querySelector("#profileImageButton");
const profileImageMessage = document.querySelector("#profileImageMessage");

const refreshAdminButton = document.querySelector("#refreshAdminButton");
const adminUsersTab = document.querySelector("#adminUsersTab");
const adminItemsTab = document.querySelector("#adminItemsTab");
const adminClaimsTab = document.querySelector("#adminClaimsTab");
const adminInspectionTab = document.querySelector("#adminInspectionTab");
const adminSummary = document.querySelector("#adminSummary");
const adminLoading = document.querySelector("#adminLoading");
const adminMessage = document.querySelector("#adminMessage");
const adminUsersPanel = document.querySelector("#adminUsersPanel");
const adminItemsPanel = document.querySelector("#adminItemsPanel");
const adminClaimsPanel = document.querySelector("#adminClaimsPanel");
const adminInspectionPanel = document.querySelector("#adminInspectionPanel");
const adminUsersBody = document.querySelector("#adminUsersBody");
const adminItemsList = document.querySelector("#adminItemsList");
const adminClaimsList = document.querySelector("#adminClaimsList");
const adminInspectionList = document.querySelector("#adminInspectionList");

const queryBackButton = document.querySelector("#queryBackButton");
const queryItemSelect = document.querySelector("#queryItemSelect");
const refreshQueryItemsButton = document.querySelector("#refreshQueryItemsButton");
const chatModeSelect = document.querySelector("#chatModeSelect");
const queryModeNote = document.querySelector("#queryModeNote");
const queryItemTitle = document.querySelector("#queryItemTitle");
const queryItemMeta = document.querySelector("#queryItemMeta");
const queryItemStatus = document.querySelector("#queryItemStatus");
const queryItemDescription = document.querySelector("#queryItemDescription");
const queryItemTags = document.querySelector("#queryItemTags");
const queryItemContextLabel = document.querySelector("#queryItemContextLabel");
const queryMessages = document.querySelector("#queryMessages");
const queryForm = document.querySelector("#queryForm");
const queryInput = document.querySelector("#queryInput");
const querySubmitButton = document.querySelector("#querySubmitButton");
const queryMessage = document.querySelector("#queryMessage");
const queryLoading = document.querySelector("#queryLoading");
const queryWarningCard = document.querySelector("#queryWarningCard");
const queryEmptyState = document.querySelector("#queryEmptyState");
const querySuggestions = document.querySelector("#querySuggestions");

const claimDialog = document.querySelector("#claimDialog");
const claimForm = document.querySelector("#claimForm");
const claimItemLabel = document.querySelector("#claimItemLabel");
const claimReasonInput = document.querySelector("#claimReasonInput");
const claimDescriptionInput = document.querySelector("#claimDescriptionInput");
const claimLocationInput = document.querySelector("#claimLocationInput");
const claimIdentifyingInput = document.querySelector("#claimIdentifyingInput");
const claimMessage = document.querySelector("#claimMessage");
const claimSubmitButton = document.querySelector("#claimSubmitButton");
const cancelClaimButton = document.querySelector("#cancelClaimButton");
const closeClaimDialog = document.querySelector("#closeClaimDialog");

function logClientError(context, error, details = {}) {
  console.error(`[LostFound] ${context}`, {
    message: error?.message || String(error),
    details,
    error,
  });
}

function currentLanguage() {
  return SUPPORTED_LANGUAGES.includes(state.language) ? state.language : "en";
}

function currentChatMode() {
  return CHAT_MODES.includes(state.chatMode) ? state.chatMode : "ai";
}

function t(key, vars = {}) {
  const language = currentLanguage();
  const template = translations[language]?.[key] || translations.en[key] || key;
  return Object.entries(vars).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function localizeValue(value) {
  return localizedValues[currentLanguage()]?.[value] || value;
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage() === "zh-CN" ? "zh-CN" : "en";
  document.title = t("page.title");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function setButtonLoading(button, isLoading) {
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
}

function setLoadingLine(element, isLoading) {
  element.classList.toggle("is-active", isLoading);
}

function setWarningCard(element, message = "") {
  element.textContent = message;
  element.classList.toggle("is-hidden", !message);
}

function fillSelect(select, values, includeAll = false) {
  select.replaceChildren();
  if (includeAll) {
    select.append(new Option(t("common.all"), ""));
  }
  values.forEach((value) => select.append(new Option(localizeValue(value), value)));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(currentLanguage() === "zh-CN" ? "zh-CN" : "en-US");
}

function titleCase(value) {
  if (!value) return "";
  if (currentLanguage() === "zh-CN") return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setLanguage(language) {
  state.language = SUPPORTED_LANGUAGES.includes(language) ? language : "en";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  languageSelect.value = state.language;
  applyTranslations();
  setChatMode(state.chatMode);
}

function setChatMode(chatMode) {
  state.chatMode = CHAT_MODES.includes(chatMode) ? chatMode : "ai";
  localStorage.setItem(CHAT_MODE_STORAGE_KEY, state.chatMode);
  chatModeSelect.value = state.chatMode;
  queryModeNote.textContent = currentLanguage() === "zh-CN"
    ? (state.chatMode === "ai" ? "AI 模式会生成回复与建议，自由聊天只保存消息。" : "自由聊天不会发送任何 AI 请求，只保存消息记录。")
    : (state.chatMode === "ai" ? "AI mode generates replies and suggestions. Free chat only stores messages." : "Free chat sends no AI requests and only stores the conversation log.");
}

function ensureApiBase(path = "") {
  if (API_BASE) {
    return `${API_BASE}${path}`;
  }

  const error = new Error("Frontend needs to be opened from http://localhost:8000 or your Mac hostname on port 8000.");
  logClientError("missing api base", error, { path, location: window.location.href });
  throw error;
}

function formatValidationIssue(issue) {
  if (!issue || typeof issue !== "object") return "";
  const field = Array.isArray(issue.loc) ? issue.loc[issue.loc.length - 1] : "";
  const label = typeof field === "string" && field ? titleCase(field.replaceAll("_", " ")) : "";
  if (typeof issue.msg === "string" && issue.msg.trim()) {
    return label ? `${label}: ${issue.msg}` : issue.msg;
  }
  return "";
}

function extractApiMessage(data, fallback = "Request failed") {
  if (typeof data === "string") {
    return data.trim() || fallback;
  }

  if (!data || typeof data !== "object") {
    return fallback;
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }

  if (typeof data.reason === "string" && data.reason.trim()) {
    return data.reason.trim();
  }

  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail.trim();
  }

  if (data.detail && typeof data.detail === "object" && typeof data.detail.reason === "string" && data.detail.reason.trim()) {
    return data.detail.reason.trim();
  }

  if (Array.isArray(data.detail)) {
    const message = data.detail.map(formatValidationIssue).filter(Boolean).join(" ");
    return message || fallback;
  }

  return fallback;
}

function applyTheme(theme) {
  const chosenTheme = THEMES.includes(theme) ? theme : "dark";
  document.documentElement.dataset.theme = chosenTheme;
  themeSelect.value = chosenTheme;
  localStorage.setItem(THEME_STORAGE_KEY, chosenTheme);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function persistSession(token) {
  state.token = token;
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

function clearSession() {
  state.user = null;
  state.token = "";
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function persistCurrentItemId(itemId) {
  state.currentItemId = itemId || null;
  if (itemId) {
    localStorage.setItem(CURRENT_ITEM_STORAGE_KEY, String(itemId));
  } else {
    localStorage.removeItem(CURRENT_ITEM_STORAGE_KEY);
  }
}

function showAuthScreen() {
  authScreen.classList.remove("is-hidden");
  appShell.classList.add("is-hidden");
}

function showAppShell() {
  authScreen.classList.add("is-hidden");
  appShell.classList.remove("is-hidden");
}

function setAuthView(view) {
  state.authView = view;
  authSubmitLabel.textContent = t(view === "login" ? "auth.login" : "auth.register");
  loginTab.classList.toggle("is-active", view === "login");
  registerTab.classList.toggle("is-active", view === "register");
  registerFields.classList.toggle("is-hidden", view !== "register");
  authPassword.setAttribute("autocomplete", view === "login" ? "current-password" : "new-password");
}

function currentUserCanAdmin() {
  return Boolean(state.user?.is_admin);
}

function canPreviewImage(path) {
  return typeof path === "string" && /^(https?:|data:|blob:)/.test(path);
}

function resolveImageUrl(item) {
  const path = item.image_url || item.image_path;
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return "";
}

function normalizeRoomCode(value) {
  return value.trim().toUpperCase();
}

function roomCodeToLabel(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const building = buildings[code[0]];
  return building ? `${building} - Room ${code}` : code;
}

function validateRoomCode(value) {
  const code = normalizeRoomCode(value);
  return /^[SPA][0-9]{3}$/.test(code);
}

function getLocationMode() {
  return document.querySelector("input[name='locationMode']:checked").value;
}

function currentLocation() {
  if (getLocationMode() === "predefined") {
    return {
      valid: true,
      value: predefinedLocation.value,
      meta: `predefined:${predefinedLocation.value}`,
    };
  }

  const code = normalizeRoomCode(roomCodeInput.value);
  if (!validateRoomCode(code)) {
  return {
      valid: false,
      value: "",
      meta: "",
      error: currentLanguage() === "zh-CN"
        ? "教室代码必须以 S、P 或 A 开头，后跟 3 位数字，例如 S302。"
        : "Room code must be S, P, or A followed by 3 digits, like S302.",
    };
  }

  return {
    valid: true,
    value: roomCodeToLabel(code),
    meta: `room:${code}`,
  };
}

function updateLocationUi() {
  const mode = getLocationMode();
  predefinedWrap.classList.toggle("is-hidden", mode !== "predefined");
  roomWrap.classList.toggle("is-hidden", mode !== "room");

  const location = currentLocation();
  locationPreview.textContent = location.valid
    ? location.value
    : (currentLanguage() === "zh-CN"
      ? "请输入类似 S302、P101 或 A204 的教室代码"
      : "Enter a room code like S302, P101, or A204");
  locationError.textContent = location.valid ? "" : location.error;
}

function prefillReporter() {
  if (!state.user) return;
  reporterInput.value = state.user.identity || state.user.username || "";
}

function validateRegisterFields() {
  if (state.authView !== "register") return null;

  const initials = authInitials.value.trim();
  const classOf = Number(authClassOf.value);

  if (!INITIALS_PATTERN.test(initials)) {
    return currentLanguage() === "zh-CN"
      ? "姓名缩写必须为小写，并采用 name.initial 的格式。"
      : "Initials must be lowercase and formatted like name.initial.";
  }
  if (!Number.isInteger(classOf) || classOf < 2025 || classOf > 2035) {
    return currentLanguage() === "zh-CN"
      ? "毕业年份必须在 2025 到 2035 之间。"
      : "Class of must be a year between 2025 and 2035.";
  }
  return null;
}

function validateReportForm() {
  const location = currentLocation();
  if (!titleInput.value.trim() || titleInput.value.trim().length < 3) {
    return currentLanguage() === "zh-CN" ? "物品标题至少需要 3 个字符。" : "Item title must be at least 3 characters.";
  }
  if (!reporterInput.value.trim()) {
    return currentLanguage() === "zh-CN" ? "必须填写显示名称。" : "Display name is required.";
  }
  if (!categoryInput.value) {
    return currentLanguage() === "zh-CN" ? "必须选择分类。" : "Category is required.";
  }
  if (!dateInput.value) {
    return currentLanguage() === "zh-CN" ? "必须填写日期。" : "Date is required.";
  }
  if (!descriptionInput.value.trim() || descriptionInput.value.trim().length < 10) {
    return currentLanguage() === "zh-CN" ? "描述至少需要 10 个字符。" : "Description must be at least 10 characters.";
  }
  if (!location.valid) {
    return location.error;
  }
  return "";
}

function validateClaimForm() {
  if (!claimReasonInput.value.trim() || claimReasonInput.value.trim().length < 6) {
    return currentLanguage() === "zh-CN" ? "认领原因至少需要 6 个字符。" : "Claim reason must be at least 6 characters.";
  }
  if (!claimDescriptionInput.value.trim() || claimDescriptionInput.value.trim().length < 6) {
    return currentLanguage() === "zh-CN" ? "物品描述至少需要 6 个字符。" : "Description of item must be at least 6 characters.";
  }
  if (!claimLocationInput.value.trim() || claimLocationInput.value.trim().length < 4) {
    return currentLanguage() === "zh-CN" ? "丢失地点至少需要 4 个字符。" : "Lost location must be at least 4 characters.";
  }
  if (!claimIdentifyingInput.value.trim() || claimIdentifyingInput.value.trim().length < 4) {
    return currentLanguage() === "zh-CN" ? "补充识别信息至少需要 4 个字符。" : "Additional identifying info must be at least 4 characters.";
  }
  if (claimIdentifyingInput.value.trim().split(/\s+/).filter(Boolean).length < 2) {
    return currentLanguage() === "zh-CN"
      ? "请提供更具体的识别细节，例如颜色、品牌、贴纸或独特标记。"
      : "Add specific identifying details like color, brand, markings, or unique features.";
  }
  return "";
}

function updateReportSubmitState() {
  submitButton.disabled = false;
}

function addInfo(list, label, value) {
  if (!value && value !== false && value !== 0) return;

  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = String(value);
  row.append(dt, dd);
  list.append(row);
}

function renderTags(container, tags) {
  container.replaceChildren();
  (tags || []).slice(0, 6).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    container.append(chip);
  });
}

function itemStatusLabel(item) {
  if (item.claimed) return localizeValue("Claimed");
  return localizeValue(item.status || "Open");
}

function itemStatusClass(item) {
  return item.claimed || item.status === "Claimed" ? "is-claimed" : "is-lost";
}

function confidenceIndicatorClass(item) {
  const risk = item.effective_abuse_risk_level || item.abuse_risk_level || "medium";
  if (risk === "high") return "is-suspicious";
  if (risk === "low" && Number(item.abuse_genuine_score || 0) >= 85) return "is-genuine";
  return "is-uncertain";
}

function confidenceTooltip(item) {
  const score = Math.max(0, Math.min(100, Number(item.abuse_genuine_score || 0)));
  const risk = item.effective_abuse_risk_level || item.abuse_risk_level || "medium";
  return `Confidence: ${score}%\nRisk: ${risk}`;
}

function statusBadgeClass(status) {
  if (status === "approved" || status === "claimed") return "is-claimed";
  if (status === "rejected" || status === "blocked") return "is-flagged";
  if (status === "allowed" || status === "admin") return "is-safe";
  return "is-lost";
}

function userDisplayName(user) {
  return user?.identity || user?.username || "User";
}

function userAvatarLabel(user) {
  const initials = user?.initials?.trim();
  if (initials) {
    return initials.split(".").map((chunk) => chunk[0] || "").join("").slice(0, 2).toUpperCase();
  }
  const source = user?.username || "LF";
  return source.slice(0, 2).toUpperCase();
}

function initialsFromText(value, fallback = "LF") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || fallback;
}

function applyAvatar(element, imageUrl, fallbackText) {
  element.textContent = fallbackText;
  if (imageUrl) {
    element.style.backgroundImage = `url("${imageUrl}")`;
    element.style.color = "transparent";
  } else {
    element.style.backgroundImage = "";
    element.style.color = "";
  }
}

function createMiniAvatar(label, imageUrl = "") {
  const avatar = document.createElement("span");
  avatar.className = "mini-avatar";
  applyAvatar(avatar, imageUrl, initialsFromText(label, "LF"));
  return avatar;
}

function findItemById(itemId) {
  return state.queryItems.find((item) => item.id === itemId)
    || state.items.find((item) => item.id === itemId)
    || null;
}

function buildHash(section, itemId = null) {
  if (section === "query") {
    return itemId ? `#query-${itemId}` : "#query";
  }
  return `#${section}`;
}

function readRoute() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) {
    return { section: "reports", itemId: state.currentItemId };
  }
  if (raw === "query") {
    return { section: "query", itemId: null };
  }
  if (raw.startsWith("query-")) {
    const itemId = Number(raw.slice("query-".length)) || null;
    return { section: "query", itemId };
  }
  if (["reports", "claims", "account", "admin"].includes(raw)) {
    return { section: raw, itemId: state.currentItemId };
  }
  return { section: "reports", itemId: state.currentItemId };
}

function navigateTo(section, itemId = null) {
  const nextHash = buildHash(section, itemId);
  if (window.location.hash === nextHash) {
    void activateRoute({ section, itemId });
    return;
  }
  window.location.hash = nextHash;
}

function updateTopbarState() {
  const toggle = (button, active) => button.classList.toggle("is-active", active);
  toggle(showReportsButton, state.currentView === "reports");
  toggle(showQueryButton, state.currentView === "query");
  toggle(showClaimsButton, state.currentView === "claims");
  toggle(showAccountButton, state.currentView === "account");
  toggle(showAdminButton, state.currentView === "admin");
}

function switchSection(section) {
  state.currentView = section;
  reportsSection.classList.toggle("is-hidden", section !== "reports");
  claimsSection.classList.toggle("is-hidden", section !== "claims");
  accountSection.classList.toggle("is-hidden", section !== "account");
  adminSection.classList.toggle("is-hidden", section !== "admin");
  querySection.classList.toggle("is-hidden", section !== "query");
  updateTopbarState();
}

async function activateRoute(route = readRoute()) {
  if (!state.user) return;

  const section = route.section || "reports";
  if (section !== "query" && state.currentView === "query") {
    clearQueryState();
  }
  if (section === "claims") {
    switchSection("claims");
    await loadClaims();
    return;
  }

  if (section === "account") {
    renderAccount();
    switchSection("account");
    return;
  }

  if (section === "admin") {
    if (!currentUserCanAdmin()) {
      navigateTo("reports");
      return;
    }
    switchSection("admin");
    switchAdminTab(state.adminTab);
    await loadAdminData();
    return;
  }

  if (section === "query") {
    switchSection("query");
    await loadQueryPage(route.itemId || null);
    return;
  }

  switchSection("reports");
}

async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(ensureApiBase(path), {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...authHeaders(),
      },
    });
  } catch (error) {
    logClientError("network request failed", error, { path, apiBase: API_BASE });
    throw new Error(`Could not reach backend at ${API_BASE}. Make sure start.sh is running.`);
  }

  if (response.ok) {
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : response.text();
  }

  let message = "Request failed";
  try {
    const data = await response.json();
    message = extractApiMessage(data, message);
  } catch {
    try {
      message = await response.text();
    } catch {
      message = "Request failed";
    }
  }

  logClientError("api request failed", new Error(message), { path, status: response.status });
  throw new Error(message);
}

async function checkBackend() {
  try {
    const data = await apiFetch("/health", { headers: {} });
    serverStatus.textContent = t("status.backendOnline");
    serverStatus.classList.add("is-online");
    serverStatus.classList.remove("is-offline");

    ollamaStatus.textContent = `${data.ollama_message || `Ollama status at ${data.ollama_url}`} • Model ${data.ai_chat_model || data.ollama_text_model || "unknown"}`;
    ollamaStatus.classList.add(data.ollama_available ? "is-online" : "is-offline");
    ollamaStatus.classList.remove(data.ollama_available ? "is-offline" : "is-online");
  } catch (error) {
    serverStatus.textContent = t("status.backendOffline");
    serverStatus.classList.add("is-offline");
    serverStatus.classList.remove("is-online");
    ollamaStatus.textContent = t("status.ollamaUnavailable");
    ollamaStatus.classList.add("is-offline");
    ollamaStatus.classList.remove("is-online");
    logClientError("health check failed", error);
  }
}

async function loadFilters() {
  try {
    const filters = await apiFetch("/filters");
    state.filters = {
      categories: filters.categories || fallbackFilters.categories,
      statuses: filters.statuses || fallbackFilters.statuses,
      locations: filters.locations || fallbackFilters.locations,
    };
  } catch (error) {
    state.filters = fallbackFilters;
    logClientError("loading filters failed", error);
  }

  fillSelect(categoryInput, state.filters.categories);
  fillSelect(categoryFilter, state.filters.categories, true);
  fillSelect(statusFilter, state.filters.statuses, true);
  fillSelect(predefinedLocation, predefinedLocations);
  fillSelect(locationFilter, state.filters.locations, true);
}

async function loadItems() {
  setLoadingLine(searchLoading, true);
  setWarningCard(searchWarningCard, "");
  const params = new URLSearchParams();
  if (searchInput.value.trim()) {
    params.set("q", searchInput.value.trim());
  }
  if (categoryFilter.value) params.set("category", categoryFilter.value);
  if (statusFilter.value) params.set("status", statusFilter.value);
  if (locationFilter.value) params.set("location", locationFilter.value);

  try {
    const suffix = params.toString();
    const data = await apiFetch(`/items${suffix ? `?${suffix}` : ""}`);
    state.items = data.items || [];
    renderItems(state.items);
    if (state.currentView === "query") {
      renderQueryItemSelector(state.currentQueryItem?.id || state.currentItemId || null);
    }
  } catch (error) {
    setWarningCard(searchWarningCard, error.message);
    gallery.replaceChildren();
    const message = document.createElement("p");
    message.className = "status-message is-error";
    message.textContent = error.message;
    gallery.append(message);
    resultCount.textContent = currentLanguage() === "zh-CN" ? "0 条报告" : "0 reports";
    logClientError("loading items failed", error);
  } finally {
    setLoadingLine(searchLoading, false);
  }
}

async function loadQueryItemOptions() {
  try {
    const data = await apiFetch("/items");
    state.queryItems = data.items || [];
    renderQueryItemSelector(state.currentQueryItem?.id || state.currentItemId || null);
  } catch (error) {
    logClientError("loading query item options failed", error);
  }
}

async function loadClaims() {
  setLoadingLine(claimsLoading, true);
  try {
    const data = await apiFetch("/claims/history");
    state.claims = data.claims || [];
    renderClaims(state.claims);
  } catch (error) {
    claimsList.replaceChildren();
    const message = document.createElement("p");
    message.className = "status-message is-error";
    message.textContent = error.message;
    claimsList.append(message);
    claimsCount.textContent = "0 claims";
    logClientError("loading claims failed", error);
  } finally {
    setLoadingLine(claimsLoading, false);
  }
}

function renderItems(items) {
  gallery.replaceChildren();
  resultCount.textContent = currentLanguage() === "zh-CN"
    ? `${items.length} 条报告`
    : `${items.length} report${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = currentLanguage() === "zh-CN" ? "没有符合当前筛选条件的报告。" : "No reports match the current filters.";
    gallery.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = itemTemplate.content.cloneNode(true);
    const article = card.querySelector(".item-card");
    const imageFrame = card.querySelector(".image-frame");
    const image = card.querySelector("img");
    const title = card.querySelector("h3");
    const summary = card.querySelector(".item-summary");
    const status = card.querySelector(".status-badge");
    const description = card.querySelector(".item-description");
    const tags = card.querySelector(".tag-row");
    const info = card.querySelector(".info-list");
    const flag = card.querySelector("[data-card-flag]");
    const claimButton = card.querySelector("[data-claim-button]");
    const openQueryButton = card.querySelector("[data-open-query-button]");
    const markClaimedButton = card.querySelector("[data-mark-claimed-button]");

    title.textContent = item.title || (currentLanguage() === "zh-CN" ? "未命名物品" : "Untitled item");
    const reporterLine = document.createElement("span");
    reporterLine.className = "person-line";
    reporterLine.append(
      createMiniAvatar(item.reporter_identity || item.reporter_name || "Reporter", item.reporter_avatar_url || ""),
      document.createTextNode(item.ai_summary || (currentLanguage() === "zh-CN"
        ? `证据：${item.evidence_summary || "等待审核"}`
        : `Evidence: ${item.evidence_summary || "Awaiting review"}`)),
    );
    summary.replaceChildren(reporterLine);
    description.textContent = item.description || "";

    const statusLabel = itemStatusLabel(item);
    const badgeClass = itemStatusClass(item);
    status.textContent = statusLabel;
    status.classList.add(badgeClass);
    flag.textContent = statusLabel;
    flag.classList.add(badgeClass);
    if (item.claimed) {
      article.classList.add("is-claimed");
    }

    const confidenceDot = document.createElement("span");
    confidenceDot.className = "confidence-dot";
    confidenceDot.classList.add(confidenceIndicatorClass(item));
    confidenceDot.title = confidenceTooltip(item);
    confidenceDot.setAttribute("aria-label", confidenceTooltip(item));
    imageFrame.append(confidenceDot);

    const preview = state.previewUrls.get(item.id) || resolveImageUrl(item);
    if (canPreviewImage(preview)) {
      image.src = preview;
      image.alt = item.title || "Uploaded item";
      imageFrame.classList.add("has-image");
      image.addEventListener("error", (event) => {
        logClientError("image failed to load", new Error("Image request failed"), {
          itemId: item.id,
          src: event.currentTarget?.src,
        });
        imageFrame.classList.remove("has-image");
      }, { once: true });
    }

    renderTags(tags, item.tags || []);
    addInfo(info, currentLanguage() === "zh-CN" ? "状态" : "Status", statusLabel);
    addInfo(info, currentLanguage() === "zh-CN" ? "报告人" : "Reported by", item.reporter_identity || item.reporter_name);
    addInfo(info, currentLanguage() === "zh-CN" ? "分类" : "Category", localizeValue(item.category));
    addInfo(info, currentLanguage() === "zh-CN" ? "地点" : "Location", localizeValue(item.location));
    addInfo(info, currentLanguage() === "zh-CN" ? "日期" : "Date", item.event_date);
    addInfo(info, currentLanguage() === "zh-CN" ? "证据" : "Evidence", item.evidence_validity);
    addInfo(info, currentLanguage() === "zh-CN" ? "审核" : "Review", item.review_status);
    addInfo(info, currentLanguage() === "zh-CN" ? "创建时间" : "Created", formatDateTime(item.created_at));
    addInfo(info, currentLanguage() === "zh-CN" ? "可信分数" : "Genuine score", `${item.abuse_genuine_score ?? 0}/100`);
    addInfo(info, currentLanguage() === "zh-CN" ? "风险等级" : "Risk level", item.effective_abuse_risk_level || item.abuse_risk_level);

    claimButton.disabled = item.claimed;
    claimButton.textContent = item.claimed
      ? (currentLanguage() === "zh-CN" ? "已被认领" : "Already claimed")
      : (currentLanguage() === "zh-CN" ? "认领物品" : "Claim item");
    claimButton.addEventListener("click", () => openClaimDialog(item));

    openQueryButton.addEventListener("click", () => navigateTo("query", item.id));

    if (currentUserCanAdmin()) {
      markClaimedButton.classList.remove("is-hidden");
      markClaimedButton.disabled = item.claimed;
      markClaimedButton.textContent = currentLanguage() === "zh-CN" ? "标记为已认领" : "Mark as Claimed";
      markClaimedButton.addEventListener("click", () => markItemClaimed(item.id, markClaimedButton));
    } else {
      markClaimedButton.classList.add("is-hidden");
    }

    gallery.append(card);
  });
}

function renderClaims(claims) {
  claimsList.replaceChildren();
  claimsCount.textContent = currentLanguage() === "zh-CN"
    ? `${claims.length} 条认领`
    : `${claims.length} claim${claims.length === 1 ? "" : "s"}`;

  if (!claims.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = currentLanguage() === "zh-CN" ? "还没有认领记录。" : "No claims yet.";
    claimsList.append(empty);
    return;
  }

  claims.forEach((claim) => {
    const card = claimHistoryTemplate.content.cloneNode(true);
    const title = card.querySelector("h3");
    const meta = card.querySelector(".claim-history-meta");
    const status = card.querySelector(".status-badge");
    const reason = card.querySelector(".claim-history-reason");
    const info = card.querySelector(".info-list");

    title.textContent = claim.item?.title || (currentLanguage() === "zh-CN" ? "不可用物品" : "Unavailable item");
    meta.textContent = currentLanguage() === "zh-CN"
      ? `${claim.user_identity || "用户"} • 提交于 ${formatDateTime(claim.timestamp)}`
      : `${claim.user_identity || "User"} • Submitted ${formatDateTime(claim.timestamp)}`;
    status.textContent = titleCase(claim.status);
    status.classList.add(statusBadgeClass(claim.status));
    reason.textContent = claim.claim_reason;

    addInfo(info, currentLanguage() === "zh-CN" ? "认领人" : "Claimant", claim.user_identity || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "报告人" : "Reported", claim.item?.reporter_identity || claim.item?.reporter_name || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "丢失地点" : "Lost at", claim.lost_location);
    addInfo(info, currentLanguage() === "zh-CN" ? "描述" : "Description", claim.item_description);
    addInfo(info, currentLanguage() === "zh-CN" ? "识别信息" : "ID info", claim.identifying_info);
    addInfo(info, currentLanguage() === "zh-CN" ? "更新时间" : "Updated", formatDateTime(claim.updated_at));

    claimsList.append(card);
  });
}

function renderAccount() {
  if (!state.user) return;

  applyAvatar(accountAvatar, state.user.avatar_url || "", userAvatarLabel(state.user));
  accountPageName.textContent = userDisplayName(state.user);
  accountPageIdentity.textContent = `@${state.user.username}`;
  accountAdminBadge.classList.toggle("is-hidden", !currentUserCanAdmin());

  accountInfoList.replaceChildren();
  addInfo(accountInfoList, currentLanguage() === "zh-CN" ? "姓名缩写" : "Initials", state.user.initials || "-");
  addInfo(accountInfoList, currentLanguage() === "zh-CN" ? "毕业年份" : "Class of", state.user.class_of || "-");
  addInfo(accountInfoList, currentLanguage() === "zh-CN" ? "创建时间" : "Created", formatDateTime(state.user.created_at));
  addInfo(accountInfoList, currentLanguage() === "zh-CN" ? "管理员" : "Admin", currentUserCanAdmin() ? t("common.yes") : t("common.no"));
}

function updateAdminSummary() {
  if (state.adminTab === "users") {
    adminSummary.textContent = currentLanguage() === "zh-CN" ? `${state.adminUsers.length} 位用户` : `${state.adminUsers.length} user${state.adminUsers.length === 1 ? "" : "s"}`;
    return;
  }
  if (state.adminTab === "items") {
    adminSummary.textContent = currentLanguage() === "zh-CN" ? `${state.adminItems.length} 个物品` : `${state.adminItems.length} item${state.adminItems.length === 1 ? "" : "s"}`;
    return;
  }
  if (state.adminTab === "claims") {
    adminSummary.textContent = currentLanguage() === "zh-CN" ? `${state.adminClaims.length} 条认领` : `${state.adminClaims.length} claim${state.adminClaims.length === 1 ? "" : "s"}`;
    return;
  }
  adminSummary.textContent = currentLanguage() === "zh-CN" ? `${state.aiInspectionLogs.length} 条 AI 记录` : `${state.aiInspectionLogs.length} AI decision${state.aiInspectionLogs.length === 1 ? "" : "s"}`;
}

function switchAdminTab(tab) {
  state.adminTab = tab;
  adminUsersTab.classList.toggle("is-active", tab === "users");
  adminItemsTab.classList.toggle("is-active", tab === "items");
  adminClaimsTab.classList.toggle("is-active", tab === "claims");
  adminInspectionTab.classList.toggle("is-active", tab === "inspection");
  adminUsersPanel.classList.toggle("is-hidden", tab !== "users");
  adminItemsPanel.classList.toggle("is-hidden", tab !== "items");
  adminClaimsPanel.classList.toggle("is-hidden", tab !== "claims");
  adminInspectionPanel.classList.toggle("is-hidden", tab !== "inspection");
  updateAdminSummary();
}

function renderAdminUsers(users) {
  adminUsersBody.replaceChildren();

  if (!users.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "admin-empty-cell";
    cell.textContent = "No users found.";
    row.append(cell);
    adminUsersBody.append(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    idCell.textContent = String(user.id || "-");

    const usernameCell = document.createElement("td");
    const usernameLine = document.createElement("div");
    usernameLine.className = "person-line";
    usernameLine.append(
      createMiniAvatar(user.identity || user.username || "User", user.avatar_url || ""),
      document.createTextNode(user.username || "-"),
    );
    usernameCell.append(usernameLine);

    const identityCell = document.createElement("td");
    identityCell.textContent = user.identity || `${user.initials || "-"} / ${user.class_of || "-"}`;

    const roleCell = document.createElement("td");
    roleCell.textContent = user.is_admin ? "Admin" : "User";

    const createdCell = document.createElement("td");
    createdCell.textContent = formatDateTime(user.created_at) || "-";

    row.append(idCell, usernameCell, identityCell, roleCell, createdCell);

    const actions = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "admin-user-actions";

    const promoteButton = document.createElement("button");
    promoteButton.className = "ghost-button small-button";
    promoteButton.type = "button";
    promoteButton.textContent = "Promote";
    promoteButton.disabled = Boolean(user.is_admin);
    promoteButton.addEventListener("click", () => handleAdminUserRoleAction(user, "promote"));

    const demoteButton = document.createElement("button");
    demoteButton.className = "ghost-button small-button";
    demoteButton.type = "button";
    demoteButton.textContent = "Demote";
    demoteButton.disabled = !user.is_admin || user.id === state.user?.id;
    demoteButton.addEventListener("click", () => handleAdminUserRoleAction(user, "demote"));

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button small-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.disabled = user.id === state.user?.id;
    deleteButton.addEventListener("click", () => handleAdminDelete(`/admin/users/${user.id}`, `Delete user #${user.id}? This cannot be undone.`));

    wrap.append(promoteButton, demoteButton, deleteButton);
    actions.append(wrap);
    row.append(actions);
    adminUsersBody.append(row);
  });
}

function renderAdminItems(items) {
  adminItemsList.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = "No items available.";
    adminItemsList.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-claim-card";

    const head = document.createElement("div");
    head.className = "admin-claim-head";
    const headText = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = item.title || (currentLanguage() === "zh-CN" ? "不可用物品" : "Unavailable item");
    const meta = document.createElement("p");
    meta.className = "admin-claim-meta";
    meta.textContent = `${localizeValue(item.category || t("common.category"))} • ${localizeValue(item.location || t("common.location"))} • ${formatDateTime(item.created_at)}`;
    headText.append(title, meta);

    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.classList.add(itemStatusClass(item));
    badge.textContent = item.status || (item.claimed ? "Claimed" : "Open");
    head.append(headText, badge);

    const info = document.createElement("dl");
    info.className = "info-list";
    addInfo(info, "ID", item.id);
    addInfo(info, currentLanguage() === "zh-CN" ? "报告人" : "Reporter", item.reporter_identity || item.reporter_name || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "描述" : "Description", item.description || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "证据摘要" : "Evidence", item.evidence_summary || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "缺失信息" : "Missing info", item.evidence_missing_info || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "矛盾点" : "Inconsistencies", item.evidence_inconsistencies || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "有效性" : "Validity", item.evidence_validity || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "审核状态" : "Review", item.review_status || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "可信分数" : "Genuine score", `${item.abuse_genuine_score ?? 0}/100`);
    addInfo(info, currentLanguage() === "zh-CN" ? "风险等级" : "Risk level", item.effective_abuse_risk_level || item.abuse_risk_level || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "风险说明" : "Risk reasoning", item.abuse_reasoning || "");
    addInfo(info, currentLanguage() === "zh-CN" ? "管理员覆盖" : "Admin override", item.abuse_override_status || "-");
    addInfo(info, currentLanguage() === "zh-CN" ? "标签" : "Tags", (item.tags || []).join(", "));

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const approveButton = document.createElement("button");
    approveButton.className = "primary-button card-button";
    approveButton.type = "button";
    approveButton.textContent = currentLanguage() === "zh-CN" ? "通过" : "Approve";
    approveButton.addEventListener("click", () => handleAdminItemReview(item.id, "approved"));

    const rejectButton = document.createElement("button");
    rejectButton.className = "ghost-button card-button";
    rejectButton.type = "button";
    rejectButton.textContent = currentLanguage() === "zh-CN" ? "拒绝" : "Reject";
    rejectButton.addEventListener("click", () => handleAdminItemReview(item.id, "rejected"));

    const incompleteButton = document.createElement("button");
    incompleteButton.className = "ghost-button card-button";
    incompleteButton.type = "button";
    incompleteButton.textContent = currentLanguage() === "zh-CN" ? "需补信息" : "Needs info";
    incompleteButton.addEventListener("click", () => handleAdminItemReview(item.id, "incomplete"));

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button card-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = currentLanguage() === "zh-CN" ? "删除物品" : "Delete item";
    deleteButton.addEventListener("click", () => handleAdminDelete(`/admin/items/${item.id}`, currentLanguage() === "zh-CN" ? `删除物品 #${item.id}？` : `Delete item #${item.id}?`));

    const allowButton = document.createElement("button");
    allowButton.className = "ghost-button card-button";
    allowButton.type = "button";
    allowButton.textContent = currentLanguage() === "zh-CN" ? "标记安全" : "Mark safe";
    allowButton.addEventListener("click", () => handleAdminAbuseOverride(item.id, "allow"));

    const flagButton = document.createElement("button");
    flagButton.className = "ghost-button card-button";
    flagButton.type = "button";
    flagButton.textContent = currentLanguage() === "zh-CN" ? "标记高风险" : "Flag high risk";
    flagButton.addEventListener("click", () => handleAdminAbuseOverride(item.id, "flag"));

    const clearButton = document.createElement("button");
    clearButton.className = "ghost-button card-button";
    clearButton.type = "button";
    clearButton.textContent = currentLanguage() === "zh-CN" ? "清除覆盖" : "Clear override";
    clearButton.addEventListener("click", () => handleAdminAbuseOverride(item.id, ""));

    actions.append(approveButton, rejectButton, incompleteButton, allowButton, flagButton, clearButton, deleteButton);

    card.append(head, info, actions);
    adminItemsList.append(card);
  });
}

function renderAdminClaims(claims) {
  adminClaimsList.replaceChildren();

  if (!claims.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = "No claims available.";
    adminClaimsList.append(empty);
    return;
  }

  claims.forEach((claim) => {
    const card = document.createElement("article");
    card.className = "admin-claim-card";
    if (claim.status === "pending") {
      card.classList.add("is-pending");
    }

    const head = document.createElement("div");
    head.className = "admin-claim-head";

    const headText = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = claim.item?.title || "Unavailable item";
    const meta = document.createElement("p");
    meta.className = "admin-claim-meta";
    meta.textContent = `User #${claim.user?.id || claim.user_id} • ${claim.user_identity || "User"} • Submitted ${formatDateTime(claim.timestamp)}`;
    headText.append(title, meta);

    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.classList.add(statusBadgeClass(claim.status));
    badge.textContent = titleCase(claim.status);
    head.append(headText, badge);

    const reason = document.createElement("p");
    reason.className = "claim-history-reason";
    reason.textContent = claim.claim_reason;

    const info = document.createElement("dl");
    info.className = "info-list";
    addInfo(info, "Item ID", claim.item_id);
    addInfo(info, "Initials", claim.user?.initials || "");
    addInfo(info, "Class of", claim.user?.class_of || "");
    addInfo(info, "Location", claim.lost_location);
    addInfo(info, "Item desc", claim.item_description);
    addInfo(info, "ID info", claim.identifying_info);
    addInfo(info, "Match score", `${claim.match_score ?? 0}/100`);
    addInfo(info, "Match reasoning", claim.match_reasoning || "");
    addInfo(info, "Updated", formatDateTime(claim.updated_at));

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const approveButton = document.createElement("button");
    approveButton.className = "primary-button card-button";
    approveButton.type = "button";
    approveButton.textContent = claim.status === "approved" ? "Approved" : "Approve";
    const rejectButton = document.createElement("button");
    rejectButton.className = "ghost-button card-button";
    rejectButton.type = "button";
    rejectButton.textContent = claim.status === "rejected" ? "Rejected" : "Reject";
    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button card-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    const actionable = claim.status === "pending";
    approveButton.disabled = !actionable;
    rejectButton.disabled = !actionable;

    approveButton.addEventListener("click", () => handleAdminClaimDecision(claim.id, "approve", approveButton));
    rejectButton.addEventListener("click", () => handleAdminClaimDecision(claim.id, "reject", rejectButton));
    deleteButton.addEventListener("click", () => handleAdminDelete(`/admin/claims/${claim.id}`, `Delete claim #${claim.id}?`));
    actions.append(approveButton, rejectButton, deleteButton);

    card.append(head, reason, info, actions);
    adminClaimsList.append(card);
  });
}

function renderAIInspection(logs) {
  adminInspectionList.replaceChildren();

  if (!logs.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = "No AI decisions recorded yet.";
    adminInspectionList.append(empty);
    return;
  }

  logs.forEach((log) => {
    const card = document.createElement("article");
    card.className = "admin-claim-card";
    if (!log.allowed) {
      card.classList.add("is-pending");
    }

    const head = document.createElement("div");
    head.className = "admin-claim-head";
    const headText = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = log.route;
    const meta = document.createElement("p");
    meta.className = "admin-claim-meta";
    meta.textContent = `${log.user_identity || "User"} • ${formatDateTime(log.created_at)}`;
    headText.append(title, meta);
    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.classList.add(log.allowed ? "is-safe" : "is-flagged");
    badge.textContent = log.allowed ? "Allowed" : "Blocked";
    head.append(headText, badge);

    const reason = document.createElement("p");
    reason.className = "claim-history-reason";
    reason.textContent = log.input_text;

    const info = document.createElement("dl");
    info.className = "info-list";
    addInfo(info, "Feature", log.feature || "");
    addInfo(info, "Decision", log.allowed ? "Allowed" : "Blocked");
    addInfo(info, "Reason", log.reason || "");
    addInfo(info, "Model", `${log.model_name || "Unknown"} ${log.model_size ? `(${log.model_size})` : ""}`.trim());
    addInfo(info, "Fallback", log.fallback_triggered ? "Yes" : "No");
    addInfo(info, "Tags", (log.tags || []).join(", "));
    addInfo(info, "Confidence", `${Math.round((log.confidence || 0) * 100)}%`);
    addInfo(info, "Metadata", JSON.stringify(log.request_metadata || {}));

    const promptBlock = document.createElement("div");
    promptBlock.className = "admin-debug-block";
    const promptLabel = document.createElement("strong");
    promptLabel.textContent = "Raw AI prompt";
    const promptText = document.createElement("pre");
    promptText.textContent = log.prompt_text || log.input_text || "";
    promptBlock.append(promptLabel, promptText);

    const outputBlock = document.createElement("div");
    outputBlock.className = "admin-debug-block";
    const outputLabel = document.createElement("strong");
    outputLabel.textContent = "Raw AI output";
    const outputText = document.createElement("pre");
    outputText.textContent = log.output_text || log.raw_output || "";
    outputBlock.append(outputLabel, outputText);

    card.append(head, reason, info, promptBlock, outputBlock);
    adminInspectionList.append(card);
  });
}

async function loadAdminData() {
  if (!currentUserCanAdmin()) {
    return;
  }

  setLoadingLine(adminLoading, true);
  setMessage(adminMessage, "");
  try {
    const [usersData, itemsData, claimsData, inspectionData] = await Promise.all([
      apiFetch("/admin/users"),
      apiFetch("/admin/items"),
      apiFetch("/admin/claims"),
      apiFetch("/admin/ai-inspection"),
    ]);
    state.adminUsers = usersData.users || [];
    state.adminItems = itemsData.items || [];
    state.adminClaims = claimsData.claims || [];
    state.aiInspectionLogs = inspectionData.logs || [];
    renderAdminUsers(state.adminUsers);
    renderAdminItems(state.adminItems);
    renderAdminClaims(state.adminClaims);
    renderAIInspection(state.aiInspectionLogs);
    updateAdminSummary();
  } catch (error) {
    state.adminUsers = [];
    state.adminItems = [];
    state.adminClaims = [];
    state.aiInspectionLogs = [];
    setMessage(adminMessage, error.message, true);
    renderAdminUsers([]);
    renderAdminItems([]);
    renderAdminClaims([]);
    renderAIInspection([]);
    updateAdminSummary();
    logClientError("loading admin data failed", error);
  } finally {
    setLoadingLine(adminLoading, false);
  }
}

async function handleAdminClaimDecision(claimId, action, button) {
  const verb = action === "approve" ? "approve" : "reject";
  if (!window.confirm(currentLanguage() === "zh-CN"
    ? `${action === "approve" ? "通过" : "拒绝"}这条认领？`
    : `${titleCase(verb)} this claim?`)) {
    return;
  }

  setButtonLoading(button, true);
  setMessage(adminMessage, currentLanguage() === "zh-CN"
    ? `${action === "approve" ? "正在通过" : "正在拒绝"}认领...`
    : `${titleCase(verb)}ing claim...`);
  try {
    const data = await apiFetch(`/admin/claims/${claimId}/${action}`, {
      method: "POST",
    });
    setMessage(adminMessage, data.message || (currentLanguage() === "zh-CN"
      ? `认领已${action === "approve" ? "通过" : "拒绝"}。`
      : `Claim ${verb}d.`));
    await Promise.all([loadAdminData(), loadItems(), loadClaims()]);
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError("admin claim action failed", error, { claimId, action });
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleAdminDelete(path, confirmationMessage) {
  if (!window.confirm(confirmationMessage)) {
    return;
  }

  setMessage(adminMessage, currentLanguage() === "zh-CN" ? "正在删除..." : "Deleting...");
  try {
    const data = await apiFetch(path, { method: "DELETE" });
    setMessage(adminMessage, data.message || (currentLanguage() === "zh-CN" ? "已删除。" : "Deleted."));
    await Promise.all([loadAdminData(), loadItems(), loadClaims()]);
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError("admin delete failed", error, { path });
  }
}

async function handleAdminUserRoleAction(user, action) {
  const verb = action === "promote" ? "promote" : "demote";
  if (!window.confirm(currentLanguage() === "zh-CN"
    ? `${action === "promote" ? "提升" : "取消"}用户 #${user.id} 的管理员权限？`
    : `${titleCase(verb)} user #${user.id}?`)) {
    return;
  }

  setMessage(adminMessage, currentLanguage() === "zh-CN"
    ? `${action === "promote" ? "正在提升" : "正在降级"}用户...`
    : `${titleCase(verb)}ing user...`);
  try {
    const data = await apiFetch(`/admin/users/${user.id}/${action}`, { method: "POST" });
    setMessage(adminMessage, data.message || (currentLanguage() === "zh-CN"
      ? `用户已${action === "promote" ? "提升" : "降级"}。`
      : `User ${verb}d.`));
    await loadAdminData();
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError("admin user role action failed", error, { userId: user.id, action });
  }
}

async function handleAdminItemReview(itemId, status) {
  const notes = window.prompt(
    currentLanguage() === "zh-CN"
      ? `将该物品标记为 ${status} 的可选备注：`
      : `Optional notes for marking this item as ${status}:`,
    "",
  ) || "";
  setMessage(adminMessage, currentLanguage() === "zh-CN" ? `正在更新审核状态为 ${status}...` : `Updating item review to ${status}...`);
  try {
    const data = await apiFetch(`/admin/items/${itemId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    setMessage(adminMessage, data.message || (currentLanguage() === "zh-CN" ? "物品审核已更新。" : "Item review updated."));
    await Promise.all([loadAdminData(), loadItems()]);
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError("admin item review failed", error, { itemId, status });
  }
}

async function handleAdminAbuseOverride(itemId, status) {
  const notes = window.prompt(
    currentLanguage() === "zh-CN"
      ? "可选：填写管理员覆盖备注"
      : "Optional notes for this abuse-risk override",
    "",
  ) || "";
  setMessage(adminMessage, currentLanguage() === "zh-CN" ? "正在更新风险覆盖..." : "Updating abuse override...");
  try {
    const data = await apiFetch(`/admin/items/${itemId}/abuse-override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    setMessage(adminMessage, data.message || (currentLanguage() === "zh-CN" ? "风险覆盖已更新。" : "Abuse override updated."));
    await Promise.all([loadAdminData(), loadItems()]);
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError("admin abuse override failed", error, { itemId, status });
  }
}

function setQueryComposerEnabled(enabled, placeholder = "Ask about the selected item") {
  queryInput.disabled = !enabled;
  querySubmitButton.disabled = !enabled;
  queryInput.placeholder = placeholder;
}

function renderQueryItemSelector(selectedItemId = null) {
  const previousValue = selectedItemId ? String(selectedItemId) : "";
  queryItemSelect.replaceChildren(new Option(t("query.generalInquiry"), ""));
  state.queryItems.forEach((item) => {
    const label = [item.title, localizeValue(item.category), localizeValue(item.location)].filter(Boolean).join(" • ");
    queryItemSelect.append(new Option(label || (currentLanguage() === "zh-CN" ? "未命名报告" : "Untitled report"), String(item.id)));
  });
  queryItemSelect.value = previousValue;
}

function setCurrentQueryItem(item) {
  state.currentQueryItem = item || null;
  persistCurrentItemId(item?.id || null);
  console.log("[Query] selected item", state.currentQueryItem);
}

function clearQueryState() {
  state.queryRequestToken = null;
  setCurrentQueryItem(null);
  state.queryMessages = [];
  state.querySuggestions = [];
  queryInput.value = "";
  queryMessages.replaceChildren();
  queryItemTags.replaceChildren();
  querySuggestions.replaceChildren();
  querySuggestions.classList.add("is-hidden");
  setWarningCard(queryWarningCard, "");
  setMessage(queryMessage, "");
  setLoadingLine(queryLoading, false);
}

function renderQuerySelectionState() {
  clearQueryState();
  queryItemSelect.value = "";
  queryItemTitle.textContent = t("query.generalInquiry");
  queryItemMeta.textContent = currentLanguage() === "zh-CN"
    ? "你可以咨询尚未上报的失物。"
    : "Ask about a lost item that hasn't been reported yet.";
  queryItemDescription.textContent = currentLanguage() === "zh-CN"
    ? "你可以在不选择物品的情况下提一般问题，或选择某条报告进行物品相关聊天。"
    : "You can ask general questions without selecting an item, or choose a specific report for item-aware chat.";
  queryItemStatus.textContent = currentLanguage() === "zh-CN" ? "一般" : "General";
  queryItemStatus.className = "status-badge is-lost";
  queryItemContextLabel.textContent = currentLanguage() === "zh-CN" ? "一般对话" : "General conversation";
  queryEmptyState.textContent = currentLanguage() === "zh-CN" ? "选择一个物品开始咨询" : "Select an item to inquire about";
  queryEmptyState.classList.remove("is-hidden");
  setQueryComposerEnabled(
    true,
    currentLanguage() === "zh-CN" ? "询问最近的报告、地点或失物" : "Ask about recent reports, locations, or lost items",
  );
}

function renderQueryErrorState(message) {
  clearQueryState();
  queryItemTitle.textContent = currentLanguage() === "zh-CN" ? "物品不可用" : "Item unavailable";
  queryItemMeta.textContent = currentLanguage() === "zh-CN" ? "无法加载所选物品。" : "The selected item could not be loaded.";
  queryItemDescription.textContent = "";
  queryItemStatus.textContent = currentLanguage() === "zh-CN" ? "错误" : "Error";
  queryItemStatus.className = "status-badge is-flagged";
  queryItemContextLabel.textContent = currentLanguage() === "zh-CN" ? "对话" : "Conversation";
  queryEmptyState.textContent = currentLanguage() === "zh-CN" ? "请选择其他物品继续。" : "Select another item to continue.";
  queryEmptyState.classList.remove("is-hidden");
  setWarningCard(queryWarningCard, message);
  setMessage(queryMessage, message, true);
  setQueryComposerEnabled(false, currentLanguage() === "zh-CN" ? "该物品不可用" : "This item is unavailable");
}

function fallbackQuerySuggestions(item = null) {
  if (state.chatMode === "free") {
    return [];
  }
  if (!item) {
    return currentLanguage() === "zh-CN"
      ? ["今天有哪些新上报的物品？", "有人上报丢失手机吗？", "哪些地点最近报告最多？", "我该怎么认领物品？"]
      : ["What items were found today?", "Has anyone reported a lost phone?", "Which locations have the most recent reports?", "How do I claim an item?"];
  }

  return currentLanguage() === "zh-CN"
    ? [`${item.title || "这个物品"}是在哪里发现的？`, "它是什么时候上报的？", "这份报告附带了什么证据？", "我该怎么认领这个物品？"]
    : [`Where was ${item.title || "this item"} found?`, "When was it reported?", "What evidence was included with this report?", "How can I claim this item?"];
}

function renderQuerySuggestions(suggestions = [], item = null) {
  const nextSuggestions = Array.isArray(suggestions) && suggestions.length
    ? suggestions
    : fallbackQuerySuggestions(item);
  state.querySuggestions = nextSuggestions;
  querySuggestions.replaceChildren();

  if (!nextSuggestions.length) {
    querySuggestions.classList.add("is-hidden");
    return;
  }

  nextSuggestions.forEach((suggestion) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button small-button";
    button.textContent = suggestion;
    button.addEventListener("click", () => {
      if (queryInput.disabled) return;
      queryInput.value = suggestion;
      queryInput.focus();
      queryInput.setSelectionRange(queryInput.value.length, queryInput.value.length);
    });
    querySuggestions.append(button);
  });

  querySuggestions.classList.remove("is-hidden");
}

function renderQueryContext(item) {
  if (!item) {
    renderQuerySelectionState();
    return;
  }
  if (!item.id || !item.title || !item.category || !item.location) {
    throw new Error("This item is missing required data for the query page.");
  }

  setCurrentQueryItem(item);
  queryItemSelect.value = String(item.id);

  queryItemTitle.textContent = item.title;
  queryItemMeta.textContent = `${localizeValue(item.category)} • ${localizeValue(item.location)} • ${formatDateTime(item.created_at)}`;
  queryItemDescription.textContent = item.evidence_summary || item.description || "";
  queryItemStatus.textContent = itemStatusLabel(item);
  queryItemStatus.className = "status-badge";
  queryItemStatus.classList.add(itemStatusClass(item));
  queryItemContextLabel.textContent = currentLanguage() === "zh-CN" ? `${item.title} 的对话` : `Conversation for ${item.title}`;
  queryEmptyState.textContent = t("query.noMessages");
  renderTags(queryItemTags, item.tags || []);
  setQueryComposerEnabled(true, t("query.askAboutItem"));
}

function renderQueryMessages(messages) {
  queryMessages.replaceChildren();
  queryEmptyState.classList.toggle("is-hidden", messages.length > 0);

  messages.forEach((entry) => {
    const bubble = document.createElement("article");
    const isSystem = entry.role === "system";
    bubble.className = `query-bubble ${isSystem ? "is-system" : "is-user"}`;

    const metaRow = document.createElement("div");
    metaRow.className = "query-meta-row";
    metaRow.append(createMiniAvatar(entry.user_identity || (isSystem ? "System" : "User"), entry.avatar_url || ""));

    const meta = document.createElement("p");
    meta.className = "query-meta";
    meta.textContent = `${entry.user_identity || (isSystem ? "System" : "User")} • ${formatDateTime(entry.created_at)}`;
    metaRow.append(meta);

    const text = document.createElement("p");
    text.className = "query-text";
    text.textContent = entry.message || "";

    bubble.append(metaRow, text);
    queryMessages.append(bubble);
  });

  window.requestAnimationFrame(() => {
    queryMessages.scrollTop = queryMessages.scrollHeight;
  });
}

function handleQueryItemSelection() {
  const nextItemId = Number(queryItemSelect.value) || null;
  const nextItem = nextItemId ? findItemById(nextItemId) : null;
  state.currentQueryItem = nextItem;
  persistCurrentItemId(nextItemId);
  console.log("[Query] selector changed", { nextItemId, nextItem });
  navigateTo("query", nextItemId);
}

async function loadQueryPage(itemId) {
  const requestToken = {};
  state.queryRequestToken = requestToken;
  setLoadingLine(queryLoading, true);
  setMessage(queryMessage, "");
  setWarningCard(queryWarningCard, "");
  await loadQueryItemOptions();
  renderQueryItemSelector(itemId);
  queryMessages.replaceChildren();
  queryEmptyState.classList.add("is-hidden");
  querySuggestions.replaceChildren();
  querySuggestions.classList.add("is-hidden");
  queryInput.value = "";

  try {
    const hasItem = Boolean(itemId);
    console.log("[Query] loading page", { selectedItemId: itemId || null, mode: hasItem ? "item" : "general" });
    const [itemData, queryData] = await Promise.all(hasItem
      ? [
          apiFetch(`/items/${itemId}`),
          apiFetch(`/items/${itemId}/queries?${new URLSearchParams({ language: currentLanguage(), chat_mode: currentChatMode() }).toString()}`),
        ]
      : [
          Promise.resolve({ item: null }),
          apiFetch(`/query?${new URLSearchParams({ language: currentLanguage(), chat_mode: currentChatMode() }).toString()}`),
        ]);
    if (state.queryRequestToken !== requestToken || state.currentView !== "query") {
      return;
    }
    const item = itemData?.item || null;
    const messages = Array.isArray(queryData?.queries) ? queryData.queries : [];
    renderQueryContext(item);
    state.queryMessages = messages;
    renderQueryMessages(messages);
    renderQuerySuggestions(queryData?.suggestions || [], item);
    setLoadingLine(queryLoading, false);
  } catch (error) {
    if (state.queryRequestToken !== requestToken || state.currentView !== "query") {
      return;
    }
    renderQueryErrorState(error.message);
    logClientError("loading query page failed", error, { itemId });
    setLoadingLine(queryLoading, false);
  }
}

async function submitQuery(event) {
  event.preventDefault();
  const itemId = state.currentQueryItem?.id || null;

  const value = queryInput.value.trim();
  if (value.length < 6) {
    const shortMessage = currentLanguage() === "zh-CN" ? "消息至少需要 6 个字符。" : "Message must be at least 6 characters.";
    setMessage(queryMessage, shortMessage, true);
    setWarningCard(queryWarningCard, shortMessage);
    return;
  }

  setButtonLoading(querySubmitButton, true);
  setMessage(queryMessage, currentLanguage() === "zh-CN" ? "正在发送消息..." : "Sending message...");
  setWarningCard(queryWarningCard, "");
  try {
    const path = itemId ? `/items/${itemId}/query` : "/query";
    console.log("[Query] submitting", { selectedItem: state.currentQueryItem, itemId, path });
    const data = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: value, language: currentLanguage(), chat_mode: currentChatMode() }),
    });
    queryInput.value = "";
    state.queryMessages = Array.isArray(data.queries) ? data.queries : [];
    renderQueryMessages(state.queryMessages);
    renderQuerySuggestions(data.suggestions || [], state.currentQueryItem);
    setMessage(queryMessage, data.response?.message || data.message || (currentLanguage() === "zh-CN" ? "消息已发送。" : "Message sent."));
    await loadItems();
  } catch (error) {
    setMessage(queryMessage, error.message, true);
    setWarningCard(queryWarningCard, error.message);
    logClientError("submitting query failed", error, { itemId });
  } finally {
    setButtonLoading(querySubmitButton, false);
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const registerError = validateRegisterFields();
  if (registerError) {
    setMessage(authMessage, registerError, true);
    return;
  }

  setButtonLoading(authSubmitButton, true);
  setMessage(authMessage, currentLanguage() === "zh-CN"
    ? `${state.authView === "login" ? "正在登录" : "正在注册"}...`
    : `${titleCase(state.authView)} in progress...`);

  try {
    const payload = state.authView === "register"
      ? {
          username: authUsername.value.trim(),
          password: authPassword.value,
          initials: authInitials.value.trim(),
          class_of: Number(authClassOf.value),
        }
      : {
          username: authUsername.value.trim(),
          password: authPassword.value,
        };

    const data = await apiFetch(state.authView === "login" ? "/login" : "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    persistSession(data.token);
    state.user = data.user;
    authForm.reset();
    setMessage(authMessage, state.authView === "login"
      ? (currentLanguage() === "zh-CN" ? "已登录。" : "Logged in.")
      : (currentLanguage() === "zh-CN" ? "账号已创建。" : "Account created."));
    await enterAuthenticatedApp();
  } catch (error) {
    setMessage(authMessage, error.message, true);
    logClientError("authentication failed", error, { view: state.authView });
  } finally {
    setButtonLoading(authSubmitButton, false);
  }
}

async function restoreSession() {
  if (!state.token) {
    showAuthScreen();
    return;
  }

  try {
    const data = await apiFetch("/session");
    state.user = data.user;
    await enterAuthenticatedApp();
  } catch (error) {
    clearSession();
    showAuthScreen();
    logClientError("restoring session failed", error);
  }
}

async function enterAuthenticatedApp() {
  showAppShell();
  accountName.textContent = userDisplayName(state.user);
  accountMeta.textContent = currentUserCanAdmin()
    ? (currentLanguage() === "zh-CN" ? "管理员权限" : "Admin access")
    : `@${state.user.username}`;
  showAdminButton.classList.toggle("is-hidden", !currentUserCanAdmin());
  prefillReporter();
  dateInput.value = todayIso();
  updateLocationUi();
  renderAccount();
  await Promise.all([
    loadFilters(),
    loadItems(),
    loadClaims(),
    currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
  ]);
  await activateRoute(readRoute());
}

async function submitReport(event) {
  event.preventDefault();
  setWarningCard(reportWarningCard, "");
  const validationMessage = validateReportForm();
  if (validationMessage) {
    setMessage(uploadMessage, validationMessage, true);
    setWarningCard(reportWarningCard, validationMessage);
    return;
  }

  const location = currentLocation();

  setButtonLoading(submitButton, true);
  setMessage(uploadMessage, currentLanguage() === "zh-CN" ? "正在保存报告..." : "Saving report...");
  try {
    const imagePayload = state.selectedFile
      ? {
          filename: state.selectedFile.name,
          content_type: state.selectedFile.type || "application/octet-stream",
          data: await readFileAsDataUrl(state.selectedFile),
        }
      : null;
    const requestBody = {
      reporter_name: reporterInput.value.trim(),
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
      evidence_details: evidenceDetailsInput.value.trim(),
      location: location.value,
      secondary_location: location.meta,
      category: categoryInput.value,
      event_date: dateInput.value,
      time_slot: "Unknown",
      student_id: "",
      contact_info: "",
      color: "",
      image: imagePayload,
    };

    const response = await fetch(ensureApiBase("/items/report"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(extractApiMessage(data, "Report submission failed."));
    }

    const item = data.item;
    if (state.selectedFile && item?.id) {
      state.previewUrls.set(item.id, URL.createObjectURL(state.selectedFile));
    }
    form.reset();
    state.selectedFile = null;
    dropTitle.textContent = t("report.dropTitle");
    dropHint.textContent = t("report.dropHint");
    dateInput.value = todayIso();
    prefillReporter();
    updateLocationUi();
    updateReportSubmitState();
    const successMessage = extractApiMessage(data, "Report saved successfully");
    setMessage(uploadMessage, data.reason ? `${successMessage}. ${data.reason}` : successMessage);
    setWarningCard(reportWarningCard, "");
    await loadItems();
  } catch (error) {
    setMessage(uploadMessage, error.message, true);
    setWarningCard(reportWarningCard, error.message);
    logClientError("submitting report failed", error);
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function uploadProfileImage() {
  const file = profileImageInput.files?.[0];
  if (!file) {
    setMessage(profileImageMessage, currentLanguage() === "zh-CN" ? "请先选择图片。" : "Choose an image first.", true);
    return;
  }

  setButtonLoading(profileImageButton, true);
  setMessage(profileImageMessage, currentLanguage() === "zh-CN" ? "正在上传头像..." : "Uploading profile image...");
  try {
    const data = await apiFetch("/account/profile-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        data: await readFileAsDataUrl(file),
      }),
    });
    state.user = data.user || state.user;
    renderAccount();
    accountName.textContent = userDisplayName(state.user);
    accountMeta.textContent = currentUserCanAdmin()
      ? (currentLanguage() === "zh-CN" ? "管理员权限" : "Admin access")
      : `@${state.user.username}`;
    setMessage(profileImageMessage, data.message || (currentLanguage() === "zh-CN" ? "头像已更新。" : "Profile image updated."));
    await Promise.all([loadItems(), currentUserCanAdmin() ? loadAdminData() : Promise.resolve()]);
  } catch (error) {
    setMessage(profileImageMessage, error.message, true);
    logClientError("uploading profile image failed", error);
  } finally {
    setButtonLoading(profileImageButton, false);
  }
}

function openClaimDialog(item) {
  if (item.claimed) {
    setMessage(uploadMessage, currentLanguage() === "zh-CN" ? "该物品已被认领。" : "This item is already claimed.", true);
    return;
  }

  state.activeClaimItem = item;
  claimForm.reset();
  setMessage(claimMessage, "");
  claimItemLabel.textContent = `${item.title} • ${item.location}`;
  claimDialog.showModal();
}

function closeClaimModal() {
  state.activeClaimItem = null;
  if (claimDialog.open) {
    claimDialog.close();
  }
}

async function submitClaim(event) {
  event.preventDefault();
  if (!state.activeClaimItem) return;

  const validationMessage = validateClaimForm();
  if (validationMessage) {
    setMessage(claimMessage, validationMessage, true);
    return;
  }
  if (!window.confirm(currentLanguage() === "zh-CN" ? "提交这条认领以供审核？" : "Submit this claim for review?")) {
    return;
  }

  setButtonLoading(claimSubmitButton, true);
  setMessage(claimMessage, currentLanguage() === "zh-CN" ? "正在提交认领..." : "Submitting claim...");

  try {
    await apiFetch(`/items/${state.activeClaimItem.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim_reason: claimReasonInput.value.trim(),
        item_description: claimDescriptionInput.value.trim(),
        lost_location: claimLocationInput.value.trim(),
        identifying_info: claimIdentifyingInput.value.trim(),
      }),
    });
    setMessage(claimMessage, currentLanguage() === "zh-CN" ? "认领已提交。" : "Claim submitted.");
    await loadClaims();
    window.setTimeout(closeClaimModal, 450);
  } catch (error) {
    setMessage(claimMessage, error.message, true);
    logClientError("submitting claim failed", error, { itemId: state.activeClaimItem.id });
  } finally {
    setButtonLoading(claimSubmitButton, false);
  }
}

async function markItemClaimed(itemId, button) {
  setButtonLoading(button, true);
  try {
    await apiFetch(`/items/${itemId}/mark-claimed`, { method: "POST" });
    await Promise.all([loadItems(), loadClaims(), currentUserCanAdmin() ? loadAdminData() : Promise.resolve()]);
  } catch (error) {
    setMessage(uploadMessage, error.message, true);
    logClientError("marking item claimed failed", error, { itemId });
  } finally {
    setButtonLoading(button, false);
  }
}

function selectFile(file) {
  if (!file) return;
  state.selectedFile = file;
  dropTitle.textContent = file.name;
  dropHint.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB selected`;
}

function debounceLoadItems() {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(loadItems, 120);
}

function resetPreviewUrls() {
  state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  state.previewUrls.clear();
}

function logout() {
  clearSession();
  resetPreviewUrls();
  state.items = [];
  state.queryItems = [];
  state.claims = [];
  state.adminUsers = [];
  state.adminItems = [];
  state.adminClaims = [];
  state.aiInspectionLogs = [];
  state.adminTab = "users";
  state.currentQueryItem = null;
  state.queryMessages = [];
  gallery.replaceChildren();
  claimsList.replaceChildren();
  adminUsersBody.replaceChildren();
  adminItemsList.replaceChildren();
  adminClaimsList.replaceChildren();
  adminInspectionList.replaceChildren();
  queryMessages.replaceChildren();
  showAdminButton.classList.add("is-hidden");
  setMessage(adminMessage, "");
  setWarningCard(reportWarningCard, "");
  setWarningCard(searchWarningCard, "");
  setWarningCard(queryWarningCard, "");
  setMessage(queryMessage, "");
  setMessage(profileImageMessage, "");
  form.reset();
  updateReportSubmitState();
  switchAdminTab("users");
  persistCurrentItemId(null);
  showAuthScreen();
  setAuthView("login");
  navigateTo("reports");
}

function bindEvents() {
  authForm.addEventListener("submit", submitAuth);
  loginTab.addEventListener("click", () => setAuthView("login"));
  registerTab.addEventListener("click", () => setAuthView("register"));

  showReportsButton.addEventListener("click", () => navigateTo("reports"));
  showQueryButton.addEventListener("click", () => navigateTo("query"));
  showClaimsButton.addEventListener("click", () => navigateTo("claims"));
  showAccountButton.addEventListener("click", () => navigateTo("account"));
  showAdminButton.addEventListener("click", () => navigateTo("admin"));
  queryBackButton.addEventListener("click", () => navigateTo("reports"));
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  languageSelect.addEventListener("change", async () => {
    setLanguage(languageSelect.value);
    if (state.user) {
      await Promise.all([
        loadFilters(),
        loadItems(),
        state.currentView === "claims" ? loadClaims() : Promise.resolve(),
        currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
      ]);
      if (state.currentView === "query") {
        await loadQueryPage(state.currentQueryItem?.id || null);
      } else if (state.currentView === "account") {
        renderAccount();
      }
    }
  });
  logoutButton.addEventListener("click", logout);

  form.addEventListener("submit", submitReport);
  imageInput.addEventListener("change", () => selectFile(imageInput.files[0]));
  refreshButton.addEventListener("click", loadItems);
  refreshQueryItemsButton.addEventListener("click", loadQueryItemOptions);
  chatModeSelect.addEventListener("change", async () => {
    setChatMode(chatModeSelect.value);
    if (state.user && state.currentView === "query") {
      await loadQueryPage(state.currentQueryItem?.id || null);
    }
  });
  refreshClaimsButton.addEventListener("click", loadClaims);
  refreshAdminButton.addEventListener("click", loadAdminData);
  adminUsersTab.addEventListener("click", () => switchAdminTab("users"));
  adminItemsTab.addEventListener("click", () => switchAdminTab("items"));
  adminClaimsTab.addEventListener("click", () => switchAdminTab("claims"));
  adminInspectionTab.addEventListener("click", () => switchAdminTab("inspection"));
  searchInput.addEventListener("input", debounceLoadItems);
  categoryFilter.addEventListener("change", loadItems);
  statusFilter.addEventListener("change", loadItems);
  locationFilter.addEventListener("change", loadItems);
  predefinedLocation.addEventListener("change", updateLocationUi);
  roomCodeInput.addEventListener("input", updateLocationUi);
  queryItemSelect.addEventListener("change", handleQueryItemSelection);
  queryForm.addEventListener("submit", submitQuery);
  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      queryForm.requestSubmit();
    }
  });

  claimForm.addEventListener("submit", submitClaim);
  cancelClaimButton.addEventListener("click", closeClaimModal);
  closeClaimDialog.addEventListener("click", closeClaimModal);
  profileImageButton.addEventListener("click", uploadProfileImage);

  window.addEventListener("hashchange", () => {
    if (state.user) {
      void activateRoute(readRoute());
    }
  });

  document.querySelectorAll("input[name='locationMode']").forEach((input) => {
    input.addEventListener("change", updateLocationUi);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    selectFile(event.dataTransfer.files[0]);
  });
}

async function init() {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "dark");
  setLanguage(state.language);
  setChatMode(state.chatMode);
  setAuthView("login");
  switchAdminTab("users");
  bindEvents();
  updateReportSubmitState();
  dateInput.value = todayIso();
  await checkBackend();
  await restoreSession();
}

init();
