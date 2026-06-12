function normalizeApiBaseUrl(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue || rawValue === "null") return "";
  return rawValue.replace(/\/+$/, "");
}

function sameOriginApiBase() {
  return normalizeApiBaseUrl(window.location?.origin || "");
}

const RUNTIME_CONFIG = window.LOSTFOUND_CONFIG || {};
const API_BASE = normalizeApiBaseUrl(RUNTIME_CONFIG.apiBaseUrl) || sameOriginApiBase();
const API_DEBUG_ENABLED = RUNTIME_CONFIG.apiDebug !== false;
const SESSION_STORAGE_KEY = "lostfound_session";
const THEME_STORAGE_KEY = "theme";
const CURRENT_ITEM_STORAGE_KEY = "lostfound_current_item";
const LANGUAGE_STORAGE_KEY = "lostfound_language";
const SIDEBAR_MODE_STORAGE_KEY = "lostfound_sidebar_mode";
const SIDEBAR_WIDTH_STORAGE_KEY = "lostfound_sidebar_width";
const ADVANCED_MODE_STORAGE_KEY = "lostfound_advanced_mode";
const TUTORIAL_STORAGE_KEY = "lostfound_tutorial_seen";
const ACTIVITY_STORAGE_KEY = "lostfound_activity_tracker";
const ACTIVITY_DISMISSED_STORAGE_KEY = "lostfound_activity_dismissed";
const INITIALS_PATTERN = /^[a-z]+(?:\.[a-z]+)+$/;
const THEME_MODES = ["dark", "light"];
const SUPPORTED_LANGUAGES = ["en", "zh-CN", "th"];
const SIDEBAR_MODES = ["left", "top", "bottom", "minimal"];
const CHAT_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const CHAT_ALLOWED_FILE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const CHAT_ALLOWED_FILE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
];
const REPORT_ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif"];
const REPORT_ALLOWED_IMAGE_MIME_TYPES = [
  "application/octet-stream",
  "image/heic",
  "image/heif",
  "image/jpg",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const SERVER_SIDE_IMAGE_CONVERSION_EXTENSIONS = [".heic", ".heif"];
const REPORT_IMAGE_MAX_DIMENSION = 800;
const REPORT_IMAGE_JPEG_QUALITY = 0.65;
const ADMIN_MONITOR_POLL_INTERVAL_MS = 5000;
const NOTIFICATION_POLL_INTERVAL_MS = 25000;
const SEARCH_DEBOUNCE_MS = 400;
const QUERY_SUGGESTION_LIMIT = 6;
const LOGIN_BACKGROUND_URL = "/uploads/background.png";
const LOGIN_LOADING_VIDEO_URL = "/uploads/loading.mp4";
const LOGIN_LOADING_FALLBACK_MS = 20000;
const EMAIL_VERIFICATION_CODE_LENGTH = 6;
const LOGIN_BUBBLE_COUNT = 8;
const TUTORIAL_CARD_MARGIN = 16;
const TUTORIAL_VIEWPORT_PADDING = 12;
const UI_DEBUG_PREFIX = "[LostFound UI]";
const CHATBOT_DEBUG_PREFIX = "[CHATBOT DEBUG]";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const STABLE_SIDEBAR_WIDTH = SIDEBAR_DEFAULT_WIDTH;
const MODAL_CLOSE_ANIMATION_MS = 180;
const HAPTIC_THROTTLE_MS = 140;
const HAPTIC_PATTERNS = {
  press: 6,
  light: 8,
  selection: 7,
  open: 10,
  close: 8,
  success: [10, 24, 14],
  notification: [10, 34, 10],
};
const ROOM_SELECTION_MIN_DISTANCE = 0.004;
const ROOM_SELECTION_SMOOTHING_EPSILON = 0.006;
const ROOM_SELECTION_MAX_POINTS = 240;
const ACTIVITY_HISTORY_LIMIT = 12;
const ACTIVITY_COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVITY_STALE_RUNNING_MS = 90 * 60 * 1000;
const MAP_IMAGE_URL = "/uploads/map.png";
const MAP_IMAGE_RELOAD_PARAM = "v";
const MAP_IMAGE_SOURCE_WIDTH = 4484;
const MAP_IMAGE_SOURCE_HEIGHT = 3036;
const MAP_CAMERA_TRANSITION_MS = 620;
const MAP_WRAPPER_MIN_GAP = 0.008;
const MAP_WRAPPER_MIN_SIZE = 0.045;
const DEFAULT_ROOM_LABELS = [];
const DEFAULT_SUB_LOCATION_LABELS = DEFAULT_ROOM_LABELS;
const DEFAULT_SUB_LOCATIONS = DEFAULT_SUB_LOCATION_LABELS.map((label) => ({
  id: label.toLowerCase(),
  label,
}));
const ACADEMIC_ROOMS = [];
const SPORTS_BUILDING_ROOMS = [
  { id: "new-sports-hall", label: "New Sports Hall" },
  { id: "sports-hall", label: "Sports Hall" },
];
const SPORTS_COMPLEX_ROOMS = [
  { id: "changing-rooms", label: "Changing Rooms" },
  { id: "strength-conditioning-room", label: "Strength & Conditioning Room" },
];
const ACADEMIC_FLOOR_COUNTS_BY_LOCATION_ID = {
  "innovation-building": 5,
  "senior-school": 4,
  "prep-school": 4,
  "pre-prep-school": 4,
};
const INVALID_LOCATION_CODE_MESSAGE = "Invalid location code for selected zone";

function mapTextRegionFromPixels(x, y, width, height) {
  return {
    x: x / MAP_IMAGE_SOURCE_WIDTH,
    y: y / MAP_IMAGE_SOURCE_HEIGHT,
    width: width / MAP_IMAGE_SOURCE_WIDTH,
    height: height / MAP_IMAGE_SOURCE_HEIGHT,
  };
}

function createAcademicFloors(locationId) {
  const floorCount = ACADEMIC_FLOOR_COUNTS_BY_LOCATION_ID[locationId] || 0;
  return Array.from({ length: floorCount }, (_, index) => {
    const floorNumber = index + 1;
    const label = `Floor ${floorNumber}`;
    return {
      id: `floor-${floorNumber}`,
      label,
      subLocations: ACADEMIC_ROOMS,
    };
  });
}

const SCHOOL_MAP_STRUCTURE = [
  {
    id: "innovation-building",
    name: "Innovation Building",
    label: "Innovation Building",
    x: 25,
    y: 42,
    metadata: { areaType: "Academic building", navigation: "floors" },
    region: {
      x: 0.069,
      y: 0.257,
      width: 0.219,
      height: 0.043,
      points: [],
    },
    floors: createAcademicFloors("innovation-building"),
  },
  {
    id: "senior-school",
    name: "Senior School",
    label: "Senior School",
    x: 49,
    y: 32,
    metadata: { areaType: "Academic building", navigation: "floors" },
    region: {
      x: 0.353,
      y: 0.162,
      width: 0.164,
      height: 0.043,
      points: [],
    },
    floors: createAcademicFloors("senior-school"),
  },
  {
    id: "prep-school",
    name: "Prep School",
    label: "Prep School",
    x: 63,
    y: 32,
    metadata: { areaType: "Academic building", navigation: "floors" },
    region: {
      ...mapTextRegionFromPixels(2391, 500, 564, 101),
      points: [],
    },
    floors: createAcademicFloors("prep-school"),
  },
  {
    id: "pre-prep-school",
    name: "Pre-Prep School",
    label: "Pre-Prep School",
    x: 62,
    y: 57,
    metadata: { areaType: "Academic building", navigation: "floors" },
    region: {
      x: 0.565,
      y: 0.515,
      width: 0.170,
      height: 0.045,
      points: [],
    },
    floors: createAcademicFloors("pre-prep-school"),
  },
  {
    id: "sports-building",
    name: "Sports Building",
    label: "Sports Building",
    x: 50,
    y: 57,
    metadata: { areaType: "Sports building", navigation: "areas" },
    subLocations: SPORTS_BUILDING_ROOMS,
    region: {
      ...mapTextRegionFromPixels(1637, 1533, 542, 100),
      points: [],
    },
    floors: [],
  },
  {
    id: "sports-complex",
    name: "Sports Complex",
    label: "Sports Complex",
    x: 34,
    y: 48,
    metadata: { areaType: "Sports complex", navigation: "areas" },
    subLocations: SPORTS_COMPLEX_ROOMS,
    region: {
      ...mapTextRegionFromPixels(864, 1336, 752, 88),
      points: [],
    },
    floors: [],
  },
  {
    id: "sports-fields-running-track",
    name: "Sports Fields & Running Track",
    label: "Sports Fields & Running Track",
    x: 31,
    y: 9,
    metadata: { areaType: "Sports field", navigation: "standalone" },
    subLocations: [],
    region: {
      x: 0.164,
      y: 0.070,
      width: 0.262,
      height: 0.043,
      points: [],
    },
    floors: [],
  },
  {
    id: "morris-forum",
    name: "Morris Forum",
    label: "Morris Forum",
    x: 60,
    y: 44,
    metadata: { areaType: "Forum", navigation: "standalone" },
    subLocations: [],
    region: {
      x: 0.530,
      y: 0.352,
      width: 0.145,
      height: 0.043,
      points: [],
    },
    floors: [],
  },
];
const SCHOOL_LOCATIONS = [
  ...SCHOOL_MAP_STRUCTURE.map((location) => ({
    ...location,
    interactionRegions: [
      {
        id: `${location.id}-region`,
        label: location.label || location.name,
        x: location.region.x,
        y: location.region.y,
        width: location.region.width,
        height: location.region.height,
        points: [],
        shape: "box",
        type: "zone",
      },
    ],
  })),
];
const SCHOOL_ZONES = SCHOOL_LOCATIONS.map((location) => location.name);
const MANUAL_LOCATION_CODE_RULES = [
  { prefix: "A", locationId: "innovation-building", minFloor: 1, maxFloor: 5, label: "Innovation" },
  { prefix: "S", locationId: "senior-school", minFloor: 1, maxFloor: 4, label: "Senior" },
  { prefix: "P", locationId: "pre-prep-school", minFloor: 1, maxFloor: 2, label: "Pre-Prep" },
  { prefix: "P", locationId: "prep-school", minFloor: 3, maxFloor: 4, label: "Prep" },
];
const savedSidebarMode = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
const savedSidebarWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) || "");
const initialSidebarWidth = Number.isFinite(savedSidebarWidth)
  ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(savedSidebarWidth)))
  : SIDEBAR_DEFAULT_WIDTH;

const LUCIDE_ICON_PATHS = {
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>',
  "badge-check": '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.75Z"></path><path d="m9 12 2 2 4-4"></path>',
  bell: '<path d="M10.27 21a2 2 0 0 0 3.46 0"></path><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>',
  "circle-plus": '<circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path>',
  "clipboard-list": '<rect width="8" height="4" x="8" y="2" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path>',
  "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>',
  map: '<path d="M14.1 5.55a2 2 0 0 1 1.8 0l3.65 1.83A2 2 0 0 1 21 9.17v8.66a2 2 0 0 1-2.9 1.79l-3.65-1.83a2 2 0 0 0-1.8 0l-3.3 1.66a2 2 0 0 1-1.8 0L3.9 17.62A2 2 0 0 1 3 15.83V7.17a2 2 0 0 1 2.9-1.79l3.65 1.83a2 2 0 0 0 1.8 0Z"></path><path d="M9 6.5v13"></path><path d="M15 4.5v13"></path>',
  "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"></path>',
  user: '<path d="M19 21a7 7 0 0 0-14 0"></path><circle cx="12" cy="7" r="4"></circle>',
};

const NAV_ICON_BY_BUTTON_ID = {
  showDashboardButton: "layout-dashboard",
  showMapButton: "map",
  showReportsButton: "clipboard-list",
  showReportItemButton: "circle-plus",
  showRoomButton: "archive",
  showReturnedButton: "rotate-ccw",
  showQueryButton: "message-circle",
  showClaimsButton: "badge-check",
  showNotificationsButton: "bell",
  showAccountButton: "user",
  showAdminButton: "shield",
  logoutButton: "log-out",
};

function safeParseStoredJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return fallback;
    const parsed = JSON.parse(rawValue);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function loadStoredActivities() {
  const stored = safeParseStoredJson(ACTIVITY_STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  const now = Date.now();
  return stored
    .filter((activity) => activity && typeof activity === "object")
    .map((activity) => {
      const updatedAt = Date.parse(activity.updatedAt || activity.createdAt || "") || now;
      if (activity.status === "running" && now - updatedAt > ACTIVITY_STALE_RUNNING_MS) {
        return {
          ...activity,
          status: "warning",
          stage: activity.stage || "Paused",
          detail: activity.detail || "This task was still running when the page was reopened.",
          completedAt: activity.completedAt || new Date(updatedAt).toISOString(),
        };
      }
      return activity;
    })
    .filter((activity) => {
      if (!activity.completedAt) return true;
      const completedAt = Date.parse(activity.completedAt);
      return Number.isNaN(completedAt) || now - completedAt <= ACTIVITY_COMPLETED_RETENTION_MS;
    })
    .slice(0, ACTIVITY_HISTORY_LIMIT);
}

function loadDismissedActivityKeys() {
  const stored = safeParseStoredJson(ACTIVITY_DISMISSED_STORAGE_KEY, []);
  return new Set(Array.isArray(stored) ? stored.filter((value) => typeof value === "string") : []);
}

const translations = {
  en: {
    "page.title": "School Lost and Found",
    "app.name": "Lost and Found",
    "brand.title": "SHR Lost & Found System",
    "brand.footer": "For Shrewsbury international school riverside",
    "status.checkingBackend": "Checking backend...",
    "status.checkingOllama": "Checking Ollama...",
    "status.checkingSystem": "Checking system...",
    "status.backendOnline": "Backend online on port 8000",
    "status.backendOffline": "Backend offline",
    "status.ollamaOnline": "Ollama online",
    "status.ollamaUnavailable": "Ollama unavailable",
    "status.systemHealthy": "All systems OK",
    "status.systemWarning": "Ollama down",
    "status.systemCritical": "Backend or database down",
    "auth.eyebrow": "School account",
    "auth.hero": "Sign in to report lost items, track claims, and ask structured item lookup questions.",
    "auth.tabs": "Authentication tabs",
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.email": "Email",
    "auth.emailVerified": "Email verified",
    "auth.emailUnverified": "Email not verified",
    "auth.sendCode": "Send code",
    "auth.resendCode": "Resend code",
    "auth.code": "Verification code",
    "auth.verifyCode": "Verify",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.showPassword": "Show password",
    "auth.hidePassword": "Hide password",
    "auth.initials": "Initials",
    "auth.classOf": "Class of",
    "topbar.eyebrow": "Local campus desk",
    "topbar.hero": "Reports stay local, admin actions stay guarded, and item questions return structured matches.",
    "topbar.theme": "Theme",
    "topbar.language": "Language",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "theme.aurora": "Aurora",
    "theme.transparent": "Transparent",
    "nav.reports": "Reports",
    "nav.dashboard": "Dashboard",
    "nav.room": "Lost & Found Room",
    "nav.returned": "Recently Returned",
    "nav.query": "Question Board",
    "nav.claims": "My Claims",
    "nav.account": "Account",
    "nav.admin": "Admin Panel",
    "nav.newWindow": "New window",
    "nav.logout": "Logout",
    "report.eyebrow": "New report",
    "report.title": "Upload a lost item",
    "report.lostOnly": "Lost only",
    "report.dropTitle": "Drop image here",
    "report.dropHint": "or choose a JPG, PNG, WEBP, HEIC, or HEIF file",
    "report.itemTitle": "Item title",
    "report.itemTitlePlaceholder": "Blue water bottle",
    "report.displayName": "Display name",
    "report.displayNamePlaceholder": "How this report should display",
    "report.predefinedLocation": "Predefined location",
    "report.roomCode": "Room code",
    "report.chooseLocation": "Choose location",
    "report.descriptionPlaceholder": "Add color, brand, markings, or details that would help someone confirm it.",
    "report.descriptionHelper": "Include color, brand, or unique marks",
    "report.supportingEvidence": "Supporting evidence",
    "report.evidencePlaceholder": "Optional: ownership clues, identifying marks, timeline, or extra evidence.",
    "report.evidenceHelper": "Optional but improves claim accuracy",
    "report.save": "Submit Report",
    "reports.eyebrow": "Reports",
    "reports.title": "Live search",
    "reports.searchPlaceholder": "Search description, tags, or location",
    "reports.emptyAll": "No reports yet. Submit the first report to get the board started.",
    "reports.emptyFiltered": "No reports match these filters yet. Try another search or clear a filter.",
    "claims.refresh": "Refresh claims",
    "claims.empty": "No claims yet. When you submit a claim, it will appear here for tracking.",
    "admin.eyebrow": "Admin tools",
    "admin.title": "Admin Panel",
    "admin.refresh": "Refresh admin data",
    "admin.users": "Users",
    "admin.items": "Items",
    "admin.claims": "Claims",
    "admin.inspection": "Inspection Log",
    "admin.monitor": "System Monitor",
    "admin.monitorCpu": "CPU",
    "admin.monitorRam": "RAM",
    "admin.monitorGpu": "GPU",
    "admin.monitorGpuTemp": "GPU temp",
    "admin.monitorUptime": "Uptime",
    "admin.monitorStatus": "Processing status",
    "admin.monitorWaiting": "Waiting for live data...",
    "admin.identity": "Identity",
    "admin.role": "Role",
    "admin.created": "Created",
    "admin.actions": "Actions",
    "query.eyebrow": "Public lookup",
    "query.title": "Question Board",
    "query.back": "Back to reports",
    "query.selectItem": "Select item",
    "query.generalInquiry": "General inquiry",
    "query.generalNote": "Use general inquiry for questions without a selected item.",
    "query.messagingNote": "Questions are saved with any image context and return structured item matches.",
    "query.refreshItems": "Refresh item list",
    "query.selectAnItem": "Select an item",
    "query.selectOrGeneral": "Select a report or use general lookup mode.",
    "query.noMessages": "No lookup results yet.",
    "query.emptyGeneral": "Ask about a missing item to see structured matches.",
    "query.emptyItem": "Ask a question about this item to see structured matches.",
    "query.askAboutItem": "Did anyone see my blue bottle?",
    "query.send": "Ask Question",
    "tutorial.stepOf": "Step {current} of {total}",
    "tutorial.welcomeTitle": "Welcome to Lost and Found",
    "tutorial.welcomeBody": "This walkthrough points to the live interface so you can see where reports, claims, messaging, and admin tools live.",
    "tutorial.reportsTitle": "Use the + Button",
    "tutorial.reportsBody": "Tap the floating + button to open the only report form. Clear titles, locations, and identifying details make matching much easier.",
    "tutorial.browseTitle": "Browse Reports",
    "tutorial.browseBody": "Use the report board to scan recent items, filter by category or location, and open a report before taking action.",
    "tutorial.claimsTitle": "Claim an Item",
    "tutorial.claimsBody": "Claim buttons live on report cards. Share specific details like color, brand, and unique marks so admins can review accurately.",
    "tutorial.messagingTitle": "Ask Questions",
    "tutorial.messagingBody": "Use the question box to look up lost items with text, image upload, or a camera photo.",
    "tutorial.adminTitle": "Admin Overview",
    "tutorial.adminBody": "Admins can review users, items, claims, inspection logs, and system health from one place without exposing those tools to students.",
    "tutorial.back": "Back",
    "tutorial.next": "Next",
    "tutorial.finish": "Finish",
    "tutorial.skip": "Skip",
    "tutorial.dontShowAgain": "Don't show again",
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
    "brand.title": "SHR Lost & Found System",
    "brand.footer": "For Shrewsbury international school riverside",
    "status.checkingBackend": "正在检查后端...",
    "status.checkingOllama": "正在检查 Ollama...",
    "status.checkingSystem": "正在检查系统...",
    "status.backendOnline": "后端已连接，端口 8000",
    "status.backendOffline": "后端离线",
    "status.ollamaOnline": "Ollama 已连接",
    "status.ollamaUnavailable": "Ollama 不可用",
    "status.systemHealthy": "系统正常",
    "status.systemWarning": "Ollama 离线",
    "status.systemCritical": "后端或数据库异常",
    "auth.eyebrow": "校园账号",
    "auth.hero": "登录后即可提交失物报告、追踪认领记录，并提出结构化物品查询问题。",
    "auth.tabs": "身份验证标签",
    "auth.login": "登录",
    "auth.register": "注册",
    "auth.email": "邮箱",
    "auth.emailVerified": "邮箱已验证",
    "auth.emailUnverified": "邮箱未验证",
    "auth.sendCode": "发送验证码",
    "auth.resendCode": "重新发送",
    "auth.code": "验证码",
    "auth.verifyCode": "验证",
    "auth.username": "用户名",
    "auth.password": "密码",
    "auth.showPassword": "显示密码",
    "auth.hidePassword": "隐藏密码",
    "auth.initials": "姓名缩写",
    "auth.classOf": "毕业年份",
    "topbar.eyebrow": "校园服务台",
    "topbar.hero": "报告仅保存在本地，管理员操作受到保护，物品问题会返回结构化匹配结果。",
    "topbar.theme": "主题",
    "topbar.language": "语言",
    "theme.dark": "深色",
    "theme.light": "浅色",
    "theme.aurora": "极光",
    "theme.transparent": "透明",
    "nav.reports": "报告",
    "nav.dashboard": "仪表盘",
    "nav.room": "失物招领室",
    "nav.returned": "最近归还",
    "nav.query": "问题板",
    "nav.claims": "我的认领",
    "nav.account": "账号",
    "nav.admin": "管理面板",
    "nav.newWindow": "新窗口",
    "nav.logout": "退出登录",
    "report.eyebrow": "新报告",
    "report.title": "上传失物报告",
    "report.lostOnly": "仅限遗失",
    "report.dropTitle": "将图片拖到这里",
    "report.dropHint": "或选择 JPG、PNG、WEBP、HEIC 或 HEIF 文件",
    "report.itemTitle": "物品标题",
    "report.itemTitlePlaceholder": "蓝色水瓶",
    "report.displayName": "显示名称",
    "report.displayNamePlaceholder": "报告展示给他人的名称",
    "report.predefinedLocation": "预设地点",
    "report.roomCode": "教室代码",
    "report.chooseLocation": "选择地点",
    "report.descriptionPlaceholder": "补充颜色、品牌、标记或其他便于确认物品的信息。",
    "report.descriptionHelper": "请包含颜色、品牌或独特标记",
    "report.supportingEvidence": "补充证据",
    "report.evidencePlaceholder": "可选：所有权线索、识别标记、时间线或其他证据。",
    "report.evidenceHelper": "可选，但能提高认领核验准确度",
    "report.save": "提交报告",
    "reports.eyebrow": "报告",
    "reports.title": "实时搜索",
    "reports.searchPlaceholder": "搜索描述、标签或地点",
    "reports.emptyAll": "暂时还没有报告。你可以先提交第一条报告。",
    "reports.emptyFiltered": "当前筛选条件下还没有结果。可以换个搜索词或清除筛选。",
    "claims.refresh": "刷新认领记录",
    "claims.empty": "还没有认领记录。提交认领后会显示在这里，方便追踪进度。",
    "admin.eyebrow": "管理工具",
    "admin.title": "管理面板",
    "admin.refresh": "刷新管理数据",
    "admin.users": "用户",
    "admin.items": "物品",
    "admin.claims": "认领",
    "admin.inspection": "检查日志",
    "admin.monitor": "系统监控",
    "admin.monitorCpu": "CPU",
    "admin.monitorRam": "内存",
    "admin.monitorGpu": "GPU",
    "admin.monitorGpuTemp": "GPU 温度",
    "admin.monitorUptime": "运行时间",
    "admin.monitorStatus": "处理状态",
    "admin.monitorWaiting": "等待实时数据...",
    "admin.identity": "身份",
    "admin.role": "角色",
    "admin.created": "创建时间",
    "admin.actions": "操作",
    "query.eyebrow": "公开查询",
    "query.title": "问题板",
    "query.back": "返回报告",
    "query.selectItem": "选择物品",
    "query.generalInquiry": "一般咨询",
    "query.generalNote": "未选择具体物品时可使用一般咨询。",
    "query.messagingNote": "问题会与图片上下文一起保存，并返回结构化匹配结果。",
    "query.refreshItems": "刷新物品列表",
    "query.selectAnItem": "选择一个物品",
    "query.selectOrGeneral": "选择一条报告，或使用一般查询模式。",
    "query.noMessages": "还没有查询结果。",
    "query.emptyGeneral": "输入遗失物品问题即可查看结构化匹配结果。",
    "query.emptyItem": "围绕这个物品提问即可查看结构化匹配结果。",
    "query.askAboutItem": "有人看到我的蓝色水瓶吗？",
    "query.send": "提交问题",
    "tutorial.stepOf": "第 {current} / {total} 步",
    "tutorial.welcomeTitle": "欢迎使用失物招领",
    "tutorial.welcomeBody": "这个引导会直接指向真实界面，帮助你快速找到报告、认领、消息和管理员工具的位置。",
    "tutorial.reportsTitle": "使用 + 按钮",
    "tutorial.reportsBody": "需要登记失物时，请点击右下角浮动的 + 按钮。报告表单只有这一个入口。标题、地点和识别细节越清晰，匹配就越容易。",
    "tutorial.browseTitle": "浏览报告",
    "tutorial.browseBody": "使用报告看板查看最新物品，并按分类或地点筛选，再决定是否继续操作。",
    "tutorial.claimsTitle": "认领物品",
    "tutorial.claimsBody": "认领按钮就在报告卡片上。尽量提供颜色、品牌和独特标记等具体信息，方便管理员核验。",
    "tutorial.messagingTitle": "提交问题",
    "tutorial.messagingBody": "使用问题框通过文字、图片上传或相机照片查询遗失物品。",
    "tutorial.adminTitle": "管理员总览",
    "tutorial.adminBody": "管理员可以在这里查看用户、物品、认领、检查日志和系统状态，普通用户不会看到这些工具。",
    "tutorial.back": "上一步",
    "tutorial.next": "下一步",
    "tutorial.finish": "完成",
    "tutorial.skip": "跳过",
    "tutorial.dontShowAgain": "不再显示",
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

let uiInitialized = false;
const uiBindingStats = {
  attached: 0,
  missing: 0,
};
const chatbotDebugState = {
  clickHandlerAttached: false,
  modalStateChanged: false,
};

const translationEnhancements = {
  en: {
    "notifications.button": "Notifications",
    "notifications.title": "Notifications",
    "notifications.empty": "No notifications yet.",
    "notifications.markRead": "Mark as read",
    "nav.map": "School Map",
    "nav.mapShort": "Map",
    "nav.report": "Report",
    "nav.mode": "Nav",
    "nav.left": "Left",
    "nav.top": "Top",
    "nav.bottom": "Bottom",
    "nav.minimal": "Minimal",
    "nav.navigation": "Navigation",
    "nav.workspace": "Workspace",
    "nav.currentLocation": "Current location",
    "common.help": "Help",
    "dashboard.refresh": "Refresh dashboard",
    "dashboard.adminTools": "Admin Tools",
    "account.profile": "Profile",
    "account.chooseProfileImage": "Choose profile image",
    "account.uploadPhoto": "Upload photo",
    "account.details": "Details",
    "account.changeEmail": "Change email",
    "account.verifyNewEmail": "Verify new email",
    "account.experience": "Experience",
    "admin.audit": "Audit log",
    "admin.auditTitle": "Sensitive activity",
    "claim.eyebrow": "Private draft",
    "claim.title": "Claim Draft Builder",
    "claim.close": "Close claim form",
    "claim.reason": "Why are you claiming this item?",
    "claim.description": "Description of item",
    "claim.location": "Where did you lose it?",
    "claim.identifying": "Additional identifying info",
    "claim.submit": "Save Draft",
    "confirm.eyebrow": "Confirm action",
    "confirm.title": "Please confirm",
    "confirm.close": "Close confirmation",
    "confirm.notes": "Notes",
    "common.cancel": "Cancel",
    "common.back": "Back",
    "common.confirm": "Confirm",
    "common.undo": "Undo",
    "common.close": "Close",
    "report.claimRequirement": "Claim requirement",
    "report.claimRequired": "Claim Required",
    "report.noClaimRequired": "No Claim Required",
    "report.claimStatus": "Claim Status",
    "report.uploadImage": "Upload Image",
    "report.takePhoto": "Take Photo",
    "report.usePhoto": "Use Photo",
    "report.locationHelper": "Use room codes like A504, S312, P308, or P201.",
    "tutorial.searchTitle": "How Search Works",
    "tutorial.searchBody": "Use the search bar to find reports with typo-tolerant matching across titles, tags, categories, and locations.",
    "tutorial.claimFlowTitle": "How Claims Work",
    "tutorial.claimFlowBody": "Use the claim button on a report and add specific identifying details so admins can review ownership safely.",
    "tutorial.chatTitle": "How Lookup Works",
    "tutorial.chatBody": "The question box saves lookup context and shows structured report matches.",
  },
  "zh-CN": {
    "notifications.button": "通知",
    "notifications.title": "通知中心",
    "notifications.empty": "暂时没有通知。",
    "notifications.markRead": "标记为已读",
    "nav.map": "校园地图",
    "nav.mapShort": "地图",
    "nav.report": "报告",
    "nav.mode": "导航",
    "nav.left": "左侧",
    "nav.top": "顶部",
    "nav.bottom": "底部",
    "nav.minimal": "精简",
    "nav.navigation": "导航",
    "nav.workspace": "工作区",
    "nav.currentLocation": "当前位置",
    "common.help": "帮助",
    "dashboard.refresh": "刷新仪表盘",
    "dashboard.adminTools": "管理工具",
    "account.profile": "个人资料",
    "account.chooseProfileImage": "选择头像",
    "account.uploadPhoto": "上传照片",
    "account.details": "详情",
    "account.changeEmail": "更改邮箱",
    "account.verifyNewEmail": "验证新邮箱",
    "account.experience": "体验",
    "admin.audit": "审计日志",
    "admin.auditTitle": "敏感操作记录",
    "claim.eyebrow": "私人草稿",
    "claim.title": "认领草稿构建器",
    "claim.close": "关闭认领表单",
    "claim.reason": "你为什么认领这件物品？",
    "claim.description": "物品描述",
    "claim.location": "你在哪里丢失的？",
    "claim.identifying": "补充识别信息",
    "claim.submit": "保存草稿",
    "confirm.eyebrow": "确认操作",
    "confirm.title": "请确认",
    "confirm.close": "关闭确认窗口",
    "confirm.notes": "备注",
    "common.cancel": "取消",
    "common.back": "返回",
    "common.confirm": "确认",
    "common.undo": "撤销",
    "common.close": "关闭",
    "report.claimRequirement": "认领要求",
    "report.claimRequired": "需要认领",
    "report.noClaimRequired": "不需要认领",
    "report.claimStatus": "认领状态",
    "report.uploadImage": "上传图片",
    "report.takePhoto": "拍照",
    "report.usePhoto": "使用照片",
    "report.locationHelper": "可使用 A504、S312、P308 或 P201 等房间代码。",
    "tutorial.searchTitle": "搜索方式",
    "tutorial.searchBody": "使用搜索栏时，系统会按标题、标签、分类和地点进行容错匹配，支持轻微拼写错误。",
    "tutorial.claimFlowTitle": "认领流程",
    "tutorial.claimFlowBody": "在报告卡片上点击认领，并填写具体识别信息，管理员才能更安全地核验所有权。",
    "tutorial.chatTitle": "查询说明",
    "tutorial.chatBody": "问题框会保存查询上下文，并显示结构化报告匹配结果。",
  },
  th: {
    "page.title": "ระบบของหายและของพบในโรงเรียน",
    "app.name": "ของหายและของพบ",
    "brand.title": "SHR Lost & Found System",
    "brand.footer": "For Shrewsbury international school riverside",
    "status.checkingBackend": "กำลังตรวจสอบระบบหลังบ้าน...",
    "status.checkingOllama": "กำลังตรวจสอบ Ollama...",
    "status.checkingSystem": "กำลังตรวจสอบระบบ...",
    "status.backendOnline": "ระบบหลังบ้านพร้อมใช้งานที่พอร์ต 8000",
    "status.backendOffline": "ระบบหลังบ้านไม่พร้อมใช้งาน",
    "status.ollamaOnline": "Ollama พร้อมใช้งาน",
    "status.ollamaUnavailable": "Ollama ไม่พร้อมใช้งาน",
    "status.systemHealthy": "ระบบทำงานปกติ",
    "status.systemWarning": "Ollama ไม่พร้อมใช้งาน",
    "status.systemCritical": "ระบบหลังบ้านหรือฐานข้อมูลมีปัญหา",
    "auth.eyebrow": "บัญชีโรงเรียน",
    "auth.hero": "ลงชื่อเข้าใช้เพื่อส่งรายงานของหาย ติดตามคำขอรับคืน และถามคำถามค้นหาสิ่งของแบบมีโครงสร้าง",
    "auth.tabs": "แท็บยืนยันตัวตน",
    "auth.login": "เข้าสู่ระบบ",
    "auth.register": "สมัครสมาชิก",
    "auth.email": "อีเมล",
    "auth.emailVerified": "ยืนยันอีเมลแล้ว",
    "auth.emailUnverified": "ยังไม่ได้ยืนยันอีเมล",
    "auth.sendCode": "ส่งรหัส",
    "auth.resendCode": "ส่งอีกครั้ง",
    "auth.code": "รหัสยืนยัน",
    "auth.verifyCode": "ยืนยัน",
    "auth.username": "ชื่อผู้ใช้",
    "auth.password": "รหัสผ่าน",
    "auth.showPassword": "แสดงรหัสผ่าน",
    "auth.hidePassword": "ซ่อนรหัสผ่าน",
    "auth.initials": "ชื่อย่อ",
    "auth.classOf": "รุ่นจบ",
    "topbar.eyebrow": "จุดบริการภายในโรงเรียน",
    "topbar.hero": "รายงานจะอยู่ภายในระบบท้องถิ่น การดำเนินการของผู้ดูแลจะถูกควบคุม และคำถามเกี่ยวกับสิ่งของจะแสดงผลลัพธ์แบบโครงสร้าง",
    "topbar.theme": "ธีม",
    "topbar.language": "ภาษา",
    "theme.dark": "เข้ม",
    "theme.light": "สว่าง",
    "theme.aurora": "ออโรรา",
    "theme.transparent": "โปร่งใส",
    "nav.reports": "รายงาน",
    "nav.map": "แผนที่โรงเรียน",
    "nav.mapShort": "แผนที่",
    "nav.report": "รายงาน",
    "nav.mode": "นำทาง",
    "nav.left": "ซ้าย",
    "nav.top": "บน",
    "nav.bottom": "ล่าง",
    "nav.minimal": "ย่อ",
    "nav.navigation": "การนำทาง",
    "nav.workspace": "พื้นที่ทำงาน",
    "nav.currentLocation": "ตำแหน่งปัจจุบัน",
    "nav.dashboard": "แดชบอร์ด",
    "nav.room": "ห้องของหายและของพบ",
    "nav.returned": "เพิ่งถูกรับคืน",
    "nav.query": "กระดานคำถาม",
    "nav.claims": "คำขอของฉัน",
    "nav.account": "บัญชี",
    "nav.admin": "แผงผู้ดูแล",
    "nav.newWindow": "หน้าต่างใหม่",
    "nav.logout": "ออกจากระบบ",
    "report.eyebrow": "รายงานใหม่",
    "report.title": "ส่งรายงานของหาย",
    "report.lostOnly": "เฉพาะของหาย",
    "report.dropTitle": "วางรูปภาพที่นี่",
    "report.dropHint": "หรือเลือกไฟล์ JPG, PNG, WEBP, HEIC หรือ HEIF",
    "report.itemTitle": "ชื่อสิ่งของ",
    "report.itemTitlePlaceholder": "ขวดน้ำสีน้ำเงิน",
    "report.displayName": "ชื่อที่แสดง",
    "report.displayNamePlaceholder": "ชื่อที่ต้องการให้แสดงในรายงาน",
    "report.predefinedLocation": "สถานที่ที่กำหนดไว้",
    "report.roomCode": "รหัสห้อง",
    "report.chooseLocation": "เลือกสถานที่",
    "report.descriptionPlaceholder": "เพิ่มสี ยี่ห้อ รอยตำหนิ หรือรายละเอียดที่ช่วยยืนยันสิ่งของได้",
    "report.descriptionHelper": "ควรระบุสี ยี่ห้อ หรือจุดสังเกตสำคัญ",
    "report.supportingEvidence": "ข้อมูลประกอบ",
    "report.evidencePlaceholder": "ไม่บังคับ: หลักฐานความเป็นเจ้าของ จุดสังเกต ลำดับเวลา หรือข้อมูลเพิ่มเติม",
    "report.evidenceHelper": "ไม่บังคับ แต่ช่วยให้ตรวจสอบคำขอได้แม่นยำขึ้น",
    "report.save": "ส่งรายงาน",
    "reports.eyebrow": "รายงาน",
    "reports.title": "ค้นหาแบบสด",
    "reports.searchPlaceholder": "ค้นหาจากคำอธิบาย แท็ก หรือสถานที่",
    "reports.emptyAll": "ยังไม่มีรายงานในระบบ เริ่มส่งรายงานแรกได้เลย",
    "reports.emptyFiltered": "ยังไม่พบรายงานที่ตรงกับตัวกรองนี้ ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง",
    "claims.refresh": "รีเฟรชคำขอ",
    "claims.empty": "ยังไม่มีคำขอรับคืน เมื่อส่งคำขอแล้วจะแสดงที่นี่เพื่อให้ติดตามได้",
    "admin.eyebrow": "เครื่องมือผู้ดูแล",
    "admin.title": "แผงผู้ดูแล",
    "admin.refresh": "รีเฟรชข้อมูลผู้ดูแล",
    "admin.users": "ผู้ใช้",
    "admin.items": "สิ่งของ",
    "admin.claims": "คำขอ",
    "admin.inspection": "บันทึกการตรวจสอบ",
    "admin.monitor": "สถานะระบบ",
    "admin.monitorCpu": "CPU",
    "admin.monitorRam": "RAM",
    "admin.monitorGpu": "GPU",
    "admin.monitorGpuTemp": "อุณหภูมิ GPU",
    "admin.monitorUptime": "เวลาทำงาน",
    "admin.monitorStatus": "สถานะการประมวลผล",
    "admin.monitorWaiting": "กำลังรอข้อมูลสด...",
    "admin.identity": "ข้อมูลประจำตัว",
    "admin.role": "บทบาท",
    "admin.created": "สร้างเมื่อ",
    "admin.actions": "การดำเนินการ",
    "admin.audit": "บันทึกตรวจสอบ",
    "admin.auditTitle": "กิจกรรมที่มีความอ่อนไหว",
    "query.eyebrow": "ค้นหาสาธารณะ",
    "query.title": "กระดานคำถาม",
    "query.back": "กลับสู่รายงาน",
    "query.selectItem": "เลือกสิ่งของ",
    "query.generalInquiry": "สอบถามทั่วไป",
    "query.generalNote": "ใช้การสอบถามทั่วไปเมื่อยังไม่ได้เลือกสิ่งของ",
    "query.messagingNote": "คำถามจะถูกบันทึกพร้อมบริบทรูปภาพ และแสดงผลลัพธ์แบบโครงสร้าง",
    "query.refreshItems": "รีเฟรชรายการสิ่งของ",
    "query.selectAnItem": "เลือกสิ่งของ",
    "query.selectOrGeneral": "เลือกหนึ่งรายงาน หรือใช้โหมดค้นหาทั่วไป",
    "query.noMessages": "ยังไม่มีผลการค้นหา",
    "query.emptyGeneral": "ถามเกี่ยวกับสิ่งของที่หายเพื่อดูรายการที่ตรงกัน",
    "query.emptyItem": "ถามเกี่ยวกับสิ่งของนี้เพื่อดูรายการที่ตรงกัน",
    "query.askAboutItem": "มีใครเห็นขวดน้ำสีน้ำเงินของฉันไหม",
    "query.send": "ส่งคำถาม",
    "tutorial.stepOf": "ขั้นตอน {current} จาก {total}",
    "tutorial.welcomeTitle": "ยินดีต้อนรับสู่ระบบของหายและของพบ",
    "tutorial.welcomeBody": "คู่มือนี้จะชี้ไปยังหน้าจอจริง เพื่อให้เห็นว่ารายงาน คำขอ ข้อความ และเครื่องมือผู้ดูแลอยู่ตรงไหน",
    "tutorial.reportsTitle": "ใช้ปุ่ม +",
    "tutorial.reportsBody": "เมื่อต้องการส่งรายงานของหาย ให้กดปุ่ม + แบบลอยที่มุมขวาล่าง แบบฟอร์มรายงานมีทางเข้าเพียงจุดเดียวนี้เท่านั้น รายละเอียดยิ่งชัดก็ยิ่งจับคู่ได้ง่าย",
    "tutorial.searchTitle": "การค้นหา",
    "tutorial.searchBody": "แถบค้นหารองรับการค้นหาแบบยืดหยุ่น โดยให้ความสำคัญกับชื่อ แท็ก หมวดหมู่ และคำสำคัญของสถานที่",
    "tutorial.claimFlowTitle": "การยื่นคำขอ",
    "tutorial.claimFlowBody": "ปุ่มยื่นคำขออยู่บนการ์ดรายงาน โปรดให้รายละเอียดเฉพาะเพื่อให้ผู้ดูแลตรวจสอบได้อย่างปลอดภัย",
    "tutorial.chatTitle": "การค้นหา",
    "tutorial.chatBody": "กล่องคำถามจะบันทึกบริบทการค้นหาและแสดงรายงานที่ตรงกันแบบโครงสร้าง",
    "tutorial.adminTitle": "ภาพรวมผู้ดูแล",
    "tutorial.adminBody": "ผู้ดูแลสามารถตรวจสอบผู้ใช้ สิ่งของ คำขอ บันทึก และสถานะระบบได้จากที่เดียว โดยไม่เปิดเผยเครื่องมือให้ผู้ใช้ทั่วไป",
    "tutorial.back": "ย้อนกลับ",
    "tutorial.next": "ถัดไป",
    "tutorial.finish": "เสร็จสิ้น",
    "tutorial.skip": "ข้าม",
    "tutorial.dontShowAgain": "ไม่ต้องแสดงอีก",
    "notifications.button": "การแจ้งเตือน",
    "notifications.title": "การแจ้งเตือน",
    "notifications.empty": "ยังไม่มีการแจ้งเตือน",
    "notifications.markRead": "ทำเครื่องหมายว่าอ่านแล้ว",
    "claim.eyebrow": "แบบร่างส่วนตัว",
    "claim.title": "ตัวสร้างแบบร่างคำขอ",
    "claim.close": "ปิดแบบฟอร์มคำขอ",
    "claim.reason": "เหตุใดคุณจึงขอรับสิ่งของนี้คืน",
    "claim.description": "คำอธิบายสิ่งของ",
    "claim.location": "คุณทำหายที่ไหน",
    "claim.identifying": "ข้อมูลระบุตัวตนเพิ่มเติม",
    "claim.submit": "บันทึกแบบร่าง",
    "confirm.eyebrow": "ยืนยันการดำเนินการ",
    "confirm.title": "กรุณายืนยัน",
    "confirm.close": "ปิดหน้าต่างยืนยัน",
    "confirm.notes": "บันทึก",
    "common.category": "หมวดหมู่",
    "common.date": "วันที่",
    "common.location": "สถานที่",
    "common.description": "คำอธิบาย",
    "common.status": "สถานะ",
    "common.search": "ค้นหา",
    "common.refresh": "รีเฟรช",
    "common.all": "ทั้งหมด",
    "common.yes": "ใช่",
    "common.no": "ไม่ใช่",
    "common.cancel": "ยกเลิก",
    "common.back": "ย้อนกลับ",
    "common.help": "ช่วยเหลือ",
    "common.confirm": "ยืนยัน",
    "common.undo": "เลิกทำ",
    "common.close": "ปิด",
    "dashboard.refresh": "รีเฟรชแดชบอร์ด",
    "dashboard.adminTools": "เครื่องมือผู้ดูแล",
    "account.profile": "โปรไฟล์",
    "account.chooseProfileImage": "เลือกรูปโปรไฟล์",
    "account.uploadPhoto": "อัปโหลดรูป",
    "account.details": "รายละเอียด",
    "account.changeEmail": "เปลี่ยนอีเมล",
    "account.verifyNewEmail": "ยืนยันอีเมลใหม่",
    "account.experience": "ประสบการณ์ใช้งาน",
    "report.claimRequirement": "เงื่อนไขการรับคืน",
    "report.claimRequired": "ต้องยื่นคำขอ",
    "report.noClaimRequired": "ไม่ต้องยื่นคำขอ",
    "report.claimStatus": "สถานะคำขอ",
    "report.uploadImage": "อัปโหลดรูปภาพ",
    "report.takePhoto": "ถ่ายรูป",
    "report.usePhoto": "ใช้รูปภาพ",
    "report.locationHelper": "ใช้รหัสห้อง เช่น A504, S312, P308 หรือ P201",
  },
};

Object.entries(translationEnhancements).forEach(([language, values]) => {
  translations[language] = {
    ...(translations.en || {}),
    ...(translations[language] || {}),
    ...values,
  };
});

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
    "Sports Building": "体育楼",
    "Sports Complex": "体育中心",
    "Sports Fields & Running Track": "运动场和跑道",
    "Long Court": "长球场",
    Library: "图书馆",
    "Morris Forum": "Morris 论坛",
    "Senior Building": "高中部大楼",
    "Primary Building": "小学部大楼",
    "Innovation Building": "创新楼",
    "Lost & Found Room": "失物招领室",
  },
  th: {
    Electronics: "อุปกรณ์อิเล็กทรอนิกส์",
    "ID Card": "บัตรประจำตัว",
    Books: "หนังสือ",
    Stationery: "เครื่องเขียน",
    Uniform: "เครื่องแบบ",
    Bag: "กระเป๋า",
    Bottle: "ขวดน้ำ",
    Keys: "กุญแจ",
    "Sports Gear": "อุปกรณ์กีฬา",
    Other: "อื่น ๆ",
    Open: "เปิดอยู่",
    Matched: "จับคู่แล้ว",
    Claimed: "รับคืนแล้ว",
    Archived: "เก็บถาวร",
    "New Sports Hall": "โรงยิมใหม่",
    "Sports Hall": "โรงยิม",
    "Sports Building": "อาคารกีฬา",
    "Sports Complex": "ศูนย์กีฬา",
    "Sports Fields & Running Track": "สนามกีฬาและลู่วิ่ง",
    "Long Court": "สนามลองคอร์ต",
    Library: "ห้องสมุด",
    "Morris Forum": "มอร์ริสฟอรัม",
    "Senior Building": "อาคารมัธยม",
    "Primary Building": "อาคารประถม",
    "Innovation Building": "อาคารนวัตกรรม",
    "Lost & Found Room": "ห้องของหายและของพบ",
  },
};

const campusLocationTree = SCHOOL_LOCATIONS.map((location) => {
  const directSubLocations = directSubLocationsForLocation(location);
  return {
    value: location.name,
    children: directSubLocations.length
      ? directSubLocations.map((subLocation) => `${location.name} > ${subLocation.label}`)
      : [
          ...(location.floors || []).flatMap((floor) => [
            `${location.name} > ${floor.label}`,
            ...(floor.subLocations || []).map((subLocation) => `${location.name} > ${floor.label} > ${subLocation.label}`),
          ]),
        ],
  };
});

function flattenLocationTree(nodes = []) {
  return nodes.reduce((locations, node) => {
    if (!node?.value) return locations;
    locations.push(node.value);
    (node.children || []).forEach((child) => locations.push(child));
    return locations;
  }, []);
}

const predefinedLocations = flattenLocationTree(campusLocationTree);
const locationBrowserLocations = predefinedLocations;

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

const buildings = {
  S: "Senior School",
  P: "Prep School",
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
  locations: uniqueValues([
    ...locationBrowserLocations,
    ...predefinedLocations,
  ]),
};

const state = {
  authView: "login",
  emailVerificationToken: "",
  emailVerificationEmail: "",
  emailVerificationPurpose: "",
  emailVerificationSentAt: 0,
  emailVerificationExpiresAt: 0,
  accountEmailChangeEmail: "",
  accountEmailChangeSentAt: 0,
  user: null,
  token: localStorage.getItem(SESSION_STORAGE_KEY) || "",
  items: [],
  roomItems: [],
  returnedItems: [],
  notifications: [],
  notificationsLoadedOnce: false,
  unreadNotifications: 0,
  activities: loadStoredActivities(),
  dismissedActivityKeys: loadDismissedActivityKeys(),
  activityCollapsed: true,
  claims: [],
  adminUsers: [],
  adminItems: [],
  adminClaims: [],
  adminAudits: [],
  aiInspectionLogs: [],
  adminTab: "users",
  mapImageUrl: MAP_IMAGE_URL,
  mapImageVersion: Date.now(),
  loadingVideoUrl: LOGIN_LOADING_VIDEO_URL,
  locations: normalizeSchoolLocations(SCHOOL_LOCATIONS),
  mapZones: [...SCHOOL_ZONES],
  mapRegions: [],
  mapStats: { regions: {}, zones: {} },
  selectedZone: null,
  selectedBox: null,
  expandedBox: null,
  selectedFloor: null,
  selectedSubLocation: null,
  heatmapEnabled: true,
  cameraZoomState: { scale: 1, x: 0.5, y: 0.5 },
  activeReportFormContext: false,
  selectedLocation: null,
  hoverLocation: null,
  hoverState: null,
  expandedMapTarget: null,
  filters: fallbackFilters,
  selectedFile: null,
  selectedQueryFile: null,
  selectedQuestionReplyFile: null,
  profilePreviewUrl: "",
  previewUrls: new Map(),
  searchCache: new Map(),
  queryCache: new Map(),
  queryResultCache: new Map(),
  avatarVersion: Date.now(),
  searchTimer: null,
  activeClaimItem: null,
  currentView: "dashboard",
  currentItemId: Number(localStorage.getItem(CURRENT_ITEM_STORAGE_KEY) || "") || null,
  currentQueryItem: null,
  queryItems: [],
  queryMessages: [],
  queryStructuredResults: [],
  querySuggestions: [],
  queryRequestToken: null,
  queryCameraStream: null,
  reportCameraStream: null,
  questionBoard: [],
  activeQuestionThread: null,
  pendingQuestionThreadId: null,
  assistantMessages: [],
  assistantMode: "chat",
  assistantLastQuery: "",
  assistantLastMessage: "",
  assistantRequestInFlight: false,
  assistantQueryLastQuery: "",
  assistantQueryResults: [],
  language: localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en",
  activeLocationFilter: "",
  locationFilterSource: "",
  locationDrawerOpen: false,
  sidebarMode: SIDEBAR_MODES.includes(savedSidebarMode)
    ? savedSidebarMode
    : "left",
  advancedMode: localStorage.getItem(ADVANCED_MODE_STORAGE_KEY) === "true",
  tutorialActive: false,
  tutorialStepIndex: 0,
  tutorialDismissedForSession: false,
  tutorialInteractionSatisfied: false,
  tutorialCleanup: null,
  adminMonitorTimer: null,
  adminMonitor: null,
  smtpStatus: null,
  adminMonitorRequestInFlight: false,
  confirmState: null,
  undoState: null,
  undoTimer: null,
  notificationTimer: null,
  statsSummary: {
    items_returned_this_week: 0,
  },
  activeRoomPreviewItem: null,
  roomPreviewAnalysis: null,
  roomPreviewDrag: null,
  roomPreviewTool: "draw",
  roomPreviewPathPoints: [],
  roomPreviewDraftPoints: [],
  roomPreviewUndoStack: [],
  roomPreviewRenderFrame: 0,
  roomPreviewLayerFrame: 0,
  pendingLayoutResize: null,
  layoutResizeFrame: 0,
  layoutSyncFrame: 0,
  lastHapticAt: 0,
  panelState: {},
  autoMinimizedReports: false,
  multitaskRequested: false,
  multitaskActive: false,
  activeClaimSuccessNotificationId: null,
  activeLayoutResize: null,
  layoutSizes: {
    sidebarWidth: initialSidebarWidth,
    secondaryHeight: 320,
    secondaryWidth: 420,
  },
  progressTimers: {
    report: null,
    query: null,
    profile: null,
    claim: null,
    room: null,
    analysis: null,
  },
  progressActivityIds: {
    report: null,
    query: null,
    profile: null,
    claim: null,
    room: null,
    analysis: null,
  },
  loginBubbleItems: [],
  loginBubbleIndex: 0,
  loginBubbleTimer: null,
  mascotUnlocked: false,
};

const authScreen = document.querySelector("#authScreen");
const loginBubbleSystem = document.querySelector("#loginBubbleSystem");
const appShell = document.querySelector("#appShell");
const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authVerificationPanel = document.querySelector("#authVerificationPanel");
const authVerificationStatus = document.querySelector("#authVerificationStatus");
const authSendCodeButton = document.querySelector("#authSendCodeButton");
const authVerificationCode = document.querySelector("#authVerificationCode");
const authVerifyCodeButton = document.querySelector("#authVerifyCodeButton");
const authVerificationMeta = document.querySelector("#authVerificationMeta");
const authUsernameField = document.querySelector("#authUsernameField");
const authUsername = document.querySelector("#authUsername");
const authPassword = document.querySelector("#authPassword");
const authPasswordToggle = document.querySelector("#authPasswordToggle");
const authConfirmPassword = document.querySelector("#authConfirmPassword");
const authConfirmPasswordToggle = document.querySelector("#authConfirmPasswordToggle");
const authInitials = document.querySelector("#authInitials");
const authClassOf = document.querySelector("#authClassOf");
const registerFields = document.querySelector("#registerFields");
const authMessage = document.querySelector("#authMessage");
const authSubmitButton = document.querySelector("#authSubmitButton");
const authSubmitLabel = document.querySelector("#authSubmitLabel");
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const loginLoadingScreen = document.querySelector("#loginLoadingScreen");
const loginLoadingVideo = document.querySelector("#loginLoadingVideo");

const showDashboardButton = document.querySelector("#showDashboardButton");
const showMapButton = document.querySelector("#showMapButton");
const showReportsButton = document.querySelector("#showReportsButton");
const showReportItemButton = document.querySelector("#showReportItemButton");
const showRoomButton = document.querySelector("#showRoomButton");
const showReturnedButton = document.querySelector("#showReturnedButton");
const showQueryButton = document.querySelector("#showQueryButton");
const showClaimsButton = document.querySelector("#showClaimsButton");
const showNotificationsButton = document.querySelector("#showNotificationsButton");
const showAccountButton = document.querySelector("#showAccountButton");
const showAdminButton = document.querySelector("#showAdminButton");
const newWindowButton = document.querySelector("#newWindowButton");
const newWindowMenu = document.querySelector("#newWindowMenu");
const newWindowMenuButtons = Array.from(document.querySelectorAll("[data-new-window-target]"));
const topbarCurrentSection = document.querySelector("#topbarCurrentSection");
const topbarBreadcrumbs = document.querySelector("#topbarBreadcrumbs");
const sidebarCurrentSection = document.querySelector("#sidebarCurrentSection");
const sidebarBreadcrumbs = document.querySelector("#sidebarBreadcrumbs");
const topbarReportButton = document.querySelector("#topbarReportButton");
const topbarRefreshButton = document.querySelector("#topbarRefreshButton");
const helpButton = document.querySelector("#helpButton");
const topbarAccountButton = document.querySelector("#topbarAccountButton");
const topbarAccountAvatar = document.querySelector("#topbarAccountAvatar");
const topbarAccountName = document.querySelector("#topbarAccountName");
let workspaceLayout = document.querySelector("#workspace");
let windowWorkspace = document.querySelector("#windowWorkspace");
let sidebarLauncherButton = document.querySelector("#sidebarLauncherButton");
let sidebarPanel = document.querySelector("#sidebarPanel");
let sidebarSplitter = document.querySelector("#sidebarSplitter");
const sidebarDrawerBackdrop = document.querySelector("#sidebarDrawerBackdrop");
let contentSplitter = document.querySelector("#contentSplitter");
let secondaryStack = document.querySelector("#secondaryStack");
const sidebarCollapseButton = document.querySelector("#sidebarCollapseButton");
const themeToggleButton = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");
const sidebarModeSelect = document.querySelector("#sidebarModeSelect");
const languageSelect = document.querySelector("#languageSelect");
const logoutButton = document.querySelector("#logoutButton");
const accountName = document.querySelector("#accountName");
const accountMeta = document.querySelector("#accountMeta");
const accountChipAvatar = document.querySelector("#accountChipAvatar");
const notificationButton = document.querySelector("#notificationButton");
const notificationBadge = document.querySelector("#notificationBadge");
const notificationDropdown = document.querySelector("#notificationDropdown");
const notificationList = document.querySelector("#notificationList");
const notificationPageList = document.querySelector("#notificationPageList");
const notificationPageCount = document.querySelector("#notificationPageCount");
const notificationPageLoading = document.querySelector("#notificationPageLoading");
const refreshNotificationsButton = document.querySelector("#refreshNotificationsButton");
const notificationWrap = notificationButton?.closest(".notification-wrap") || null;
const notificationHome = notificationWrap
  ? {
      parent: notificationWrap.parentNode,
      nextSibling: notificationWrap.nextSibling,
    }
  : null;
const mobileNotificationSlot = document.querySelector("#mobileNotificationSlot");
const weeklyReturnedCount = document.querySelector("#weeklyReturnedCount");
let dashboardSection = document.querySelector("#dashboardSection");
let reportsSection = document.querySelector("#reportsSection");
let reportsPanel = document.querySelector("#reportsPanel");
let mapSection = document.querySelector("#mapSection");
let roomSection = document.querySelector("#roomSection");
let returnedSection = document.querySelector("#returnedSection");
let claimsSection = document.querySelector("#claimsSection");
let notificationsSection = document.querySelector("#notificationsSection");
let accountSection = document.querySelector("#accountSection");
let adminSection = document.querySelector("#adminSection");
let querySection = document.querySelector("#querySection");

const openReportModalButton = document.querySelector("#openReportModalButton");
const openAssistantButton = document.querySelector("#openAssistantButton");
const assistantLauncherButtons = [openAssistantButton].filter(Boolean);
const assistantPanel = document.querySelector("#assistantPanel");
const assistantCloseButton = document.querySelector("#assistantCloseButton");
const assistantChatModeButton = document.querySelector("#assistantChatModeButton");
const assistantQueryModeButton = document.querySelector("#assistantQueryModeButton");
const assistantChatModePanel = document.querySelector("#assistantChatModePanel");
const assistantQueryModePanel = document.querySelector("#assistantQueryModePanel");
const assistantMessages = document.querySelector("#assistantMessages");
const assistantForm = document.querySelector("#assistantForm");
const assistantInput = document.querySelector("#assistantInput");
const assistantClaimDraftButton = document.querySelector("#assistantClaimDraftButton");
const assistantSubmitButton = document.querySelector("#assistantSubmitButton");
const assistantStatus = document.querySelector("#assistantStatus");
const assistantQueryForm = document.querySelector("#assistantQueryForm");
const assistantQueryInput = document.querySelector("#assistantQueryInput");
const assistantQuerySubmitButton = document.querySelector("#assistantQuerySubmitButton");
const assistantQueryStatus = document.querySelector("#assistantQueryStatus");
const assistantQueryResults = document.querySelector("#assistantQueryResults");
const reportDialog = document.querySelector("#reportDialog");
const closeReportDialog = document.querySelector("#closeReportDialog");
const form = document.querySelector("#itemForm");
const dropZone = document.querySelector("#dropZone");
const imageInput = document.querySelector("#imageInput");
const reportCameraInput = document.querySelector("#reportCameraInput");
const reportCameraButton = document.querySelector("#reportCameraButton");
const reportCameraPanel = document.querySelector("#reportCameraPanel");
const reportCameraPreview = document.querySelector("#reportCameraPreview");
const reportCameraCaptureButton = document.querySelector("#reportCameraCaptureButton");
const reportCameraCancelButton = document.querySelector("#reportCameraCancelButton");
const dropTitle = document.querySelector("#dropTitle");
const dropHint = document.querySelector("#dropHint");
const reporterInput = document.querySelector("#reporterInput");
const titleInput = document.querySelector("#titleInput");
const categoryInput = document.querySelector("#categoryInput");
const categoryFilter = document.querySelector("#categoryFilter");
const statusFilter = document.querySelector("#statusFilter");
const locationFilter = document.querySelector("#locationFilter");
const locationFilterBanner = document.querySelector("#locationFilterBanner");
const locationFilterBannerText = document.querySelector("#locationFilterBannerText");
const locationBackButton = document.querySelector("#locationBackButton");
const clearLocationFilterButton = document.querySelector("#clearLocationFilterButton");
const optionalLocationInput = document.querySelector("#optionalLocationInput");
const locationHelperText = document.querySelector("#locationHelperText");
const dateInput = document.querySelector("#dateInput");
const descriptionInput = document.querySelector("#descriptionInput");
const evidenceDetailsInput = document.querySelector("#evidenceDetailsInput");
const claimRequiredInput = document.querySelector("#claimRequiredInput");
const noClaimRequiredInput = document.querySelector("#noClaimRequiredInput");
const reportClaimStatusLabel = document.querySelector("[data-report-claim-status-label]");
const uploadMessage = document.querySelector("#uploadMessage");
const reportWarningCard = document.querySelector("#reportWarningCard");
const submitButton = document.querySelector("#submitButton");
const reportProgress = document.querySelector("#reportProgress");
const reportProgressFill = document.querySelector("#reportProgressFill");
const reportProgressLabel = document.querySelector("#reportProgressLabel");
const reportProgressValue = document.querySelector("#reportProgressValue");

const gallery = document.querySelector("#gallery");
const itemTemplate = document.querySelector("#itemTemplate");
const resultCount = document.querySelector("#resultCount");
const searchInput = document.querySelector("#searchInput");
const searchLoading = document.querySelector("#searchLoading");
const searchWarningCard = document.querySelector("#searchWarningCard");
const refreshButton = document.querySelector("#refreshButton");

const dashboardReportsToday = document.querySelector("#dashboardReportsToday");
const dashboardReportsTodayMeta = document.querySelector("#dashboardReportsTodayMeta");
const dashboardPendingClaims = document.querySelector("#dashboardPendingClaims");
const dashboardReturnedWeek = document.querySelector("#dashboardReturnedWeek");
const dashboardRecoveredTotal = document.querySelector("#dashboardRecoveredTotal");
const dashboardActiveQueries = document.querySelector("#dashboardActiveQueries");
const dashboardNotifications = document.querySelector("#dashboardNotifications");
const dashboardApprovalRate = document.querySelector("#dashboardApprovalRate");
const dashboardActiveReports = document.querySelector("#dashboardActiveReports");
const dashboardActivityList = document.querySelector("#dashboardActivityList");
const dashboardRecentReportsList = document.querySelector("#dashboardRecentReportsList");
const dashboardRecentReturnsList = document.querySelector("#dashboardRecentReturnsList");
const dashboardReportButton = document.querySelector("#dashboardReportButton");
const dashboardRefreshButton = document.querySelector("#dashboardRefreshButton");
const dashboardLinkButtons = Array.from(document.querySelectorAll("[data-dashboard-target]"));
const dashboardAdvancedButtons = Array.from(document.querySelectorAll("[data-dashboard-advanced]"));
const dashboardTeacherButtons = Array.from(document.querySelectorAll(".dashboard-teacher-action"));
const locationBrowserTree = document.querySelector("#locationBrowserTree");
let locationBrowserButtons = Array.from(document.querySelectorAll("[data-location-filter]"));
let locationTreeGroups = Array.from(document.querySelectorAll("[data-location-group]"));
const mapResetButton = document.querySelector("#mapResetButton");
const mapSelectionBreadcrumb = document.querySelector("#mapSelectionBreadcrumb");
const schoolMapShell = document.querySelector("#schoolMapShell");
const schoolMapCamera = document.querySelector("#schoolMapCamera");
const schoolMapImage = document.querySelector("#schoolMapImage");
const schoolMapTextLayer = document.querySelector("#schoolMapTextLayer");
const schoolMapTooltip = document.querySelector("#schoolMapTooltip");
const mapSelectionPanel = document.querySelector("#mapSelectionPanel");
const locationViewPanel = document.querySelector("#locationViewPanel");
const mapBackButton = document.querySelector("#mapBackButton");

const roomAdminPanel = document.querySelector("#roomAdminPanel");
const roomLabelInput = document.querySelector("#roomLabelInput");
const roomUploadInput = document.querySelector("#roomUploadInput");
const uploadRoomButton = document.querySelector("#uploadRoomButton");
const roomUploadMessage = document.querySelector("#roomUploadMessage");
const roomGallery = document.querySelector("#roomGallery");
const roomCount = document.querySelector("#roomCount");
const roomLoading = document.querySelector("#roomLoading");
const roomWarningCard = document.querySelector("#roomWarningCard");
const refreshRoomButton = document.querySelector("#refreshRoomButton");

const returnedList = document.querySelector("#returnedList");
const returnedCount = document.querySelector("#returnedCount");
const returnedLoading = document.querySelector("#returnedLoading");
const returnedMessage = document.querySelector("#returnedMessage");
const returnedWarningCard = document.querySelector("#returnedWarningCard");
const refreshReturnedButton = document.querySelector("#refreshReturnedButton");

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
const accountEmailForm = document.querySelector("#accountEmailForm");
const accountEmailInput = document.querySelector("#accountEmailInput");
const accountEmailSendCodeButton = document.querySelector("#accountEmailSendCodeButton");
const accountEmailCodeInput = document.querySelector("#accountEmailCodeInput");
const accountEmailConfirmButton = document.querySelector("#accountEmailConfirmButton");
const accountEmailMessage = document.querySelector("#accountEmailMessage");
const advancedModeToggle = document.querySelector("#advancedModeToggle");
const advancedModeTitle = document.querySelector("#advancedModeTitle");
const advancedModeStatus = document.querySelector("#advancedModeStatus");
const accountLogoutButton = document.querySelector("#accountLogoutButton");
const profileImageInput = document.querySelector("#profileImageInput");
const profileImageButton = document.querySelector("#profileImageButton");
const profileImageMessage = document.querySelector("#profileImageMessage");
const profileProgress = document.querySelector("#profileProgress");
const profileProgressFill = document.querySelector("#profileProgressFill");
const profileProgressLabel = document.querySelector("#profileProgressLabel");
const profileProgressValue = document.querySelector("#profileProgressValue");

const refreshAdminButton = document.querySelector("#refreshAdminButton");
const adminUsersTab = document.querySelector("#adminUsersTab");
const adminItemsTab = document.querySelector("#adminItemsTab");
const adminClaimsTab = document.querySelector("#adminClaimsTab");
const adminInspectionTab = document.querySelector("#adminInspectionTab");
const adminMonitorTab = document.querySelector("#adminMonitorTab");
const startOllamaButton = document.querySelector("#startOllamaButton");
const stopOllamaButton = document.querySelector("#stopOllamaButton");
const adminSummary = document.querySelector("#adminSummary");
const adminLoading = document.querySelector("#adminLoading");
const adminMessage = document.querySelector("#adminMessage");
const adminUsersPanel = document.querySelector("#adminUsersPanel");
const adminItemsPanel = document.querySelector("#adminItemsPanel");
const adminClaimsPanel = document.querySelector("#adminClaimsPanel");
const adminInspectionPanel = document.querySelector("#adminInspectionPanel");
const adminMonitorPanel = document.querySelector("#adminMonitorPanel");
const adminUsersBody = document.querySelector("#adminUsersBody");
const adminItemsList = document.querySelector("#adminItemsList");
const adminClaimsList = document.querySelector("#adminClaimsList");
const adminAuditList = document.querySelector("#adminAuditList");
const adminInspectionList = document.querySelector("#adminInspectionList");
const adminMonitorUptime = document.querySelector("#adminMonitorUptime");
const adminMonitorStatus = document.querySelector("#adminMonitorStatus");
const adminOllamaStatus = document.querySelector("#adminOllamaStatus");
const adminOllamaModels = document.querySelector("#adminOllamaModels");
const adminMonitorUpdated = document.querySelector("#adminMonitorUpdated");
const adminMonitorWarning = document.querySelector("#adminMonitorWarning");
const adminSmtpStatus = document.querySelector("#adminSmtpStatus");
const adminSmtpDeliveryMode = document.querySelector("#adminSmtpDeliveryMode");
const adminSmtpHostConfigured = document.querySelector("#adminSmtpHostConfigured");
const adminSmtpUsernameConfigured = document.querySelector("#adminSmtpUsernameConfigured");
const adminSmtpPasswordConfigured = document.querySelector("#adminSmtpPasswordConfigured");
const adminSmtpSender = document.querySelector("#adminSmtpSender");
const adminSmtpLastError = document.querySelector("#adminSmtpLastError");
const adminSmtpWarning = document.querySelector("#adminSmtpWarning");
const adminSmtpTestForm = document.querySelector("#adminSmtpTestForm");
const adminSmtpTestEmail = document.querySelector("#adminSmtpTestEmail");
const adminSmtpTestButton = document.querySelector("#adminSmtpTestButton");
const adminSmtpTestMessage = document.querySelector("#adminSmtpTestMessage");
const queryBackButton = document.querySelector("#queryBackButton");
const queryItemSelect = document.querySelector("#queryItemSelect");
const refreshQueryItemsButton = document.querySelector("#refreshQueryItemsButton");
const queryModeNote = document.querySelector("#queryModeNote");
const queryItemTitle = document.querySelector("#queryItemTitle");
const queryItemMeta = document.querySelector("#queryItemMeta");
const queryItemStatus = document.querySelector("#queryItemStatus");
const queryItemDescription = document.querySelector("#queryItemDescription");
const queryItemTags = document.querySelector("#queryItemTags");
const queryItemImageButton = document.querySelector("#queryItemImageButton");
const queryItemImage = document.querySelector("#queryItemImage");
const queryItemImageFallback = document.querySelector("#queryItemImageFallback");
const queryItemContextLabel = document.querySelector("#queryItemContextLabel");
const queryMessages = document.querySelector("#queryMessages");
const queryForm = document.querySelector("#queryForm");
const queryTypeSelect = document.querySelector("#queryTypeSelect");
const queryLocationInput = document.querySelector("#queryLocationInput");
const queryFileInput = document.querySelector("#queryFileInput");
const queryCameraInput = document.querySelector("#queryCameraInput");
const queryCameraButton = document.querySelector("#queryCameraButton");
const queryCameraPanel = document.querySelector("#queryCameraPanel");
const queryCameraPreview = document.querySelector("#queryCameraPreview");
const queryCameraCaptureButton = document.querySelector("#queryCameraCaptureButton");
const queryCameraCancelButton = document.querySelector("#queryCameraCancelButton");
const queryFileInfo = document.querySelector("#queryFileInfo");
const queryFileName = document.querySelector("#queryFileName");
const queryFileSize = document.querySelector("#queryFileSize");
const queryFileRemoveButton = document.querySelector("#queryFileRemoveButton");
const queryInput = document.querySelector("#queryInput");
const querySubmitButton = document.querySelector("#querySubmitButton");
const queryMessage = document.querySelector("#queryMessage");
const queryLoading = document.querySelector("#queryLoading");
const queryProgress = document.querySelector("#queryProgress");
const queryProgressFill = document.querySelector("#queryProgressFill");
const queryProgressLabel = document.querySelector("#queryProgressLabel");
const queryProgressValue = document.querySelector("#queryProgressValue");
const queryWarningCard = document.querySelector("#queryWarningCard");
const queryEmptyState = document.querySelector("#queryEmptyState");
const querySuggestions = document.querySelector("#querySuggestions");
const queryAdminActions = document.querySelector("#queryAdminActions");
const queryClearThreadButton = document.querySelector("#queryClearThreadButton");
const refreshQuestionBoardButton = document.querySelector("#refreshQuestionBoardButton");
const questionBoardList = document.querySelector("#questionBoardList");
const questionThreadPanel = document.querySelector("#questionThreadPanel");
const questionThreadMeta = document.querySelector("#questionThreadMeta");
const questionThreadTitle = document.querySelector("#questionThreadTitle");
const questionThreadBody = document.querySelector("#questionThreadBody");
const closeQuestionThreadButton = document.querySelector("#closeQuestionThreadButton");
const questionReplyForm = document.querySelector("#questionReplyForm");
const questionReplyTypeSelect = document.querySelector("#questionReplyTypeSelect");
const questionReplyFileInput = document.querySelector("#questionReplyFileInput");
const questionReplyFileInfo = document.querySelector("#questionReplyFileInfo");
const questionReplyFileName = document.querySelector("#questionReplyFileName");
const questionReplyFileRemoveButton = document.querySelector("#questionReplyFileRemoveButton");
const questionReplyInput = document.querySelector("#questionReplyInput");
const questionReplySubmitButton = document.querySelector("#questionReplySubmitButton");
const questionReplyMessage = document.querySelector("#questionReplyMessage");

const claimDialog = document.querySelector("#claimDialog");
const roomClaimPreviewDialog = document.querySelector("#roomClaimPreviewDialog");
const closeRoomClaimPreviewDialog = document.querySelector("#closeRoomClaimPreviewDialog");
const roomPreviewCancelButton = document.querySelector("#roomPreviewCancelButton");
const roomClaimPreviewLabel = document.querySelector("#roomClaimPreviewLabel");
const roomPreviewImage = document.querySelector("#roomPreviewImage");
const roomPreviewStage = document.querySelector("#roomPreviewStage");
const roomPreviewSelectionLayer = document.querySelector("#roomPreviewSelectionLayer");
const roomPreviewSelectionPath = document.querySelector("#roomPreviewSelectionPath");
const roomPreviewCircle = document.querySelector("#roomPreviewCircle");
const roomPreviewHandle = document.querySelector("#roomPreviewHandle");
const roomPreviewHint = document.querySelector("#roomPreviewHint");
const roomPreviewResult = document.querySelector("#roomPreviewResult");
const roomPreviewTags = document.querySelector("#roomPreviewTags");
const roomPreviewMessage = document.querySelector("#roomPreviewMessage");
const roomAnalyzeButton = document.querySelector("#roomAnalyzeButton");
const roomConfirmButton = document.querySelector("#roomConfirmButton");
const roomDrawButton = document.querySelector("#roomDrawButton");
const roomCircleToolButton = document.querySelector("#roomCircleToolButton");
const roomUndoSelectionButton = document.querySelector("#roomUndoSelectionButton");
const roomClearSelectionButton = document.querySelector("#roomClearSelectionButton");
const claimForm = document.querySelector("#claimForm");
const claimItemLabel = document.querySelector("#claimItemLabel");
const claimItemSelect = document.querySelector("#claimItemSelect");
const claimDraftTitleInput = document.querySelector("#claimDraftTitleInput");
const claimReasonInput = document.querySelector("#claimReasonInput");
const claimDescriptionInput = document.querySelector("#claimDescriptionInput");
const claimLocationInput = document.querySelector("#claimLocationInput");
const claimIdentifyingInput = document.querySelector("#claimIdentifyingInput");
const claimMessage = document.querySelector("#claimMessage");
const claimSubmitButton = document.querySelector("#claimSubmitButton");
const cancelClaimButton = document.querySelector("#cancelClaimButton");
const closeClaimDialog = document.querySelector("#closeClaimDialog");
const claimSuccessBanner = document.querySelector("#claimSuccessBanner");
const claimSuccessEyebrow = document.querySelector("#claimSuccessEyebrow");
const claimSuccessTitle = document.querySelector("#claimSuccessTitle");
const claimSuccessMessage = document.querySelector("#claimSuccessMessage");
const claimSuccessViewButton = document.querySelector("#claimSuccessViewButton");
const claimSuccessDismissButton = document.querySelector("#claimSuccessDismissButton");
const activityTracker = document.querySelector("#activityTracker");
const activityTrackerToggle = document.querySelector("#activityTrackerToggle");
const activityTrackerSummary = document.querySelector("#activityTrackerSummary");
const activityTrackerCount = document.querySelector("#activityTrackerCount");
const activityClearButton = document.querySelector("#activityClearButton");
const activityList = document.querySelector("#activityList");
const confirmDialog = document.querySelector("#confirmDialog");
const confirmForm = document.querySelector("#confirmForm");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmBody = document.querySelector("#confirmBody");
const confirmMessage = document.querySelector("#confirmMessage");
const confirmNotesWrap = document.querySelector("#confirmNotesWrap");
const confirmNotesLabel = document.querySelector("#confirmNotesLabel");
const confirmNotesInput = document.querySelector("#confirmNotesInput");
const confirmActionButton = document.querySelector("#confirmActionButton");
const confirmActionLabel = document.querySelector("#confirmActionLabel");
const closeConfirmDialog = document.querySelector("#closeConfirmDialog");
const cancelConfirmButton = document.querySelector("#cancelConfirmButton");
const imagePreviewDialog = document.querySelector("#imagePreviewDialog");
const imagePreviewImage = document.querySelector("#imagePreviewImage");
const imagePreviewTitle = document.querySelector("#imagePreviewTitle");
const imagePreviewCaption = document.querySelector("#imagePreviewCaption");
const closeImagePreviewDialog = document.querySelector("#closeImagePreviewDialog");
const tutorialOverlay = document.querySelector("#tutorialOverlay");
const tutorialBackdropPanes = Array.from(document.querySelectorAll("[data-tutorial-backdrop]"));
const tutorialSpotlight = document.querySelector("#tutorialSpotlight");
const tutorialCard = document.querySelector("#tutorialCard");
const tutorialStepLabel = document.querySelector("#tutorialStepLabel");
const tutorialTitle = document.querySelector("#tutorialTitle");
const tutorialBody = document.querySelector("#tutorialBody");
const tutorialDontShowAgain = document.querySelector("#tutorialDontShowAgain");
const tutorialDontShowAgainLabel = document.querySelector("#tutorialDontShowAgainLabel");
const tutorialBackButton = document.querySelector("#tutorialBackButton");
const tutorialNextButton = document.querySelector("#tutorialNextButton");
const tutorialNextLabel = document.querySelector("#tutorialNextLabel");
const tutorialSkipButton = document.querySelector("#tutorialSkipButton");
const tutorialCloseButton = document.querySelector("#tutorialCloseButton");
const undoToast = document.querySelector("#undoToast");
const undoToastText = document.querySelector("#undoToastText");
const undoToastButton = document.querySelector("#undoToastButton");
const undoToastClose = document.querySelector("#undoToastClose");
let tutorialActiveTarget = null;
let tutorialSpotlightFrame = 0;

const progressHandles = {
  report: {
    root: reportProgress,
    fill: reportProgressFill,
    label: reportProgressLabel,
    value: reportProgressValue,
  },
  query: {
    root: queryProgress,
    fill: queryProgressFill,
    label: queryProgressLabel,
    value: queryProgressValue,
  },
  profile: {
    root: profileProgress,
    fill: profileProgressFill,
    label: profileProgressLabel,
    value: profileProgressValue,
  },
};

let panelElements = {};

function refreshPanelElements() {
  panelElements = {
    sidebar: sidebarPanel,
    dashboard: dashboardSection,
    reports: reportsPanel,
    report: reportDialog,
    map: mapSection,
    room: roomSection,
    returned: returnedSection,
    claims: claimsSection,
    notifications: notificationsSection,
    account: accountSection,
    admin: adminSection,
    query: querySection,
  };
}

function cacheLayoutDomReferences() {
  workspaceLayout = document.querySelector("#workspace");
  windowWorkspace = document.querySelector("#windowWorkspace");
  sidebarLauncherButton = document.querySelector("#sidebarLauncherButton");
  sidebarPanel = document.querySelector("#sidebarPanel");
  sidebarSplitter = document.querySelector("#sidebarSplitter");
  contentSplitter = document.querySelector("#contentSplitter");
  secondaryStack = document.querySelector("#secondaryStack");
  dashboardSection = document.querySelector("#dashboardSection");
  reportsSection = document.querySelector("#reportsSection");
  reportsPanel = document.querySelector("#reportsPanel");
  mapSection = document.querySelector("#mapSection");
  roomSection = document.querySelector("#roomSection");
  returnedSection = document.querySelector("#returnedSection");
  claimsSection = document.querySelector("#claimsSection");
  notificationsSection = document.querySelector("#notificationsSection");
  accountSection = document.querySelector("#accountSection");
  adminSection = document.querySelector("#adminSection");
  querySection = document.querySelector("#querySection");
  refreshPanelElements();
}

function logUiInfo(message, details = "") {
  if (details) {
    console.info(`${UI_DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.info(`${UI_DEBUG_PREFIX} ${message}`);
}

function logMissingElement(label) {
  uiBindingStats.missing += 1;
  console.error(`${UI_DEBUG_PREFIX} Missing element: ${label}`);
}

function bindListener(target, eventName, handler, { label = "", options } = {}) {
  if (!(target instanceof EventTarget)) {
    logMissingElement(label || `${eventName} target`);
    return false;
  }
  target.addEventListener(eventName, handler, options);
  uiBindingStats.attached += 1;
  logUiInfo(`Attached ${eventName} listener`, label || target.id || target.tagName);
  return true;
}

function createFallbackPanelShell({ id, panelName, title, eyebrow, sectionClass = "panel page-panel surface-card glass window-panel" }) {
  const panel = document.createElement("section");
  panel.id = id;
  panel.dataset.panel = panelName;
  panel.className = sectionClass;
  panel.innerHTML = `
    <div class="window-header">
      <div class="window-title-group">
        <p class="eyebrow">${eyebrow}</p>
        <h3>${title}</h3>
      </div>
    </div>
    <div class="window-body">
      <p class="item-summary">This panel was recreated during UI initialization.</p>
    </div>
  `;
  return panel;
}

function ensureLayoutStructure() {
  const shell = appShell || document.body;
  const footer = shell.querySelector(".app-footer");
  let workspace = document.querySelector("#workspace");
  if (!workspace) {
    logMissingElement("workspace");
    workspace = document.createElement("div");
    workspace.id = "workspace";
    workspace.className = "workspace-layout";
    shell.insertBefore(workspace, footer || null);
  }

  workspace.classList.add("workspace-layout");
  workspace.style.display = "flex";

  let sidebar = document.querySelector("#sidebarPanel");
  if (!sidebar) {
    logMissingElement("sidebarPanel");
    sidebar = createFallbackPanelShell({
      id: "sidebarPanel",
      panelName: "sidebar",
      title: "Workspace",
      eyebrow: "Navigation",
      sectionClass: "topbar navbar glass window-panel sidebar-window",
    });
    workspace.prepend(sidebar);
  }

  let sidebarResize = document.querySelector("#sidebarSplitter");
  if (!sidebarResize) {
    logMissingElement("sidebarSplitter");
    sidebarResize = document.createElement("div");
    sidebarResize.id = "sidebarSplitter";
    sidebarResize.className = "layout-divider is-vertical";
    sidebarResize.dataset.layoutResize = "sidebar";
    sidebarResize.setAttribute("role", "separator");
    sidebarResize.setAttribute("aria-orientation", "vertical");
    sidebarResize.setAttribute("aria-label", "Resize navigation");
    sidebar.after(sidebarResize);
  }

  let workspaceMain = document.querySelector("#windowWorkspace");
  if (!workspaceMain) {
    logMissingElement("windowWorkspace");
    workspaceMain = document.createElement("main");
    workspaceMain.id = "windowWorkspace";
    workspaceMain.className = "page-stack main-content";
    workspace.append(workspaceMain);
  }

  let reports = document.querySelector("#reportsSection");
  if (!reports) {
    logMissingElement("reportsSection");
    reports = document.createElement("section");
    reports.id = "reportsSection";
    const reportsPanelFallback = createFallbackPanelShell({
      id: "reportsPanel",
      panelName: "reports",
      title: "Live search",
      eyebrow: "Reports",
      sectionClass: "panel browse-panel surface-card glass window-panel",
    });
    reports.append(reportsPanelFallback);
    workspaceMain.prepend(reports);
  }

  let contentResize = document.querySelector("#contentSplitter");
  if (!contentResize) {
    logMissingElement("contentSplitter");
    contentResize = document.createElement("div");
    contentResize.id = "contentSplitter";
    contentResize.className = "layout-divider is-horizontal";
    contentResize.dataset.layoutResize = "content";
    contentResize.setAttribute("role", "separator");
    contentResize.setAttribute("aria-orientation", "horizontal");
    contentResize.setAttribute("aria-label", "Resize content panels");
    workspaceMain.append(contentResize);
  }

  let secondary = document.querySelector("#secondaryStack");
  if (!secondary) {
    logMissingElement("secondaryStack");
    secondary = document.createElement("div");
    secondary.id = "secondaryStack";
    secondary.className = "secondary-stack";
    const queryFallback = createFallbackPanelShell({
      id: "querySection",
      panelName: "query",
      title: "Activity",
      eyebrow: "Logs",
    });
    secondary.append(queryFallback);
    workspaceMain.append(secondary);
  }

  cacheLayoutDomReferences();
}

const secondaryPanelNames = ["report", "map", "room", "returned", "claims", "notifications", "account", "admin", "query"];
const primaryPanelNames = ["dashboard", "reports"];
const simpleModeSections = new Set(["dashboard", "reports", "report", "map", "room", "returned", "query", "claims", "notifications", "account"]);
const advancedModeSections = new Set(["admin"]);
const LAYOUT_BREAKPOINT = 900;
const PHONE_LAYOUT_BREAKPOINT = 600;
const REPORTS_MIN_HEIGHT = 260;
const SECONDARY_MIN_HEIGHT = 220;
const REPORTS_MIN_WIDTH = 360;
const SECONDARY_MIN_WIDTH = 420;
const SPLITTER_SIZE = 14;

function currentResponsiveMode() {
  if (window.innerWidth < PHONE_LAYOUT_BREAKPOINT) return "mobile";
  if (window.innerWidth < LAYOUT_BREAKPOINT) return "tablet";
  return "desktop";
}

function currentSidebarMode() {
  return "left";
}

function isPrimaryPanel(section) {
  return primaryPanelNames.includes(section);
}

function sidebarParticipatesInSideLayout() {
  return isDesktopWindowLayout() && ["left", "minimal"].includes(currentSidebarMode());
}

function applySidebarMode() {
  const mode = currentSidebarMode();
  if (appShell) {
    appShell.dataset.sidebarMode = mode;
  }
  if (workspaceLayout) {
    workspaceLayout.dataset.sidebarMode = mode;
  }
  document.body.dataset.sidebarMode = mode;
  if (sidebarModeSelect) {
    sidebarModeSelect.value = mode;
  }
}

function setSidebarMode(mode) {
  state.sidebarMode = "left";
  localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, state.sidebarMode);
  const sidebarState = ensurePanelState("sidebar");
  sidebarState.closed = false;
  sidebarState.collapsed = false;
  applyPanelLayout("sidebar");
  syncWorkspaceLayout();
}

function renderDefaultLayout() {
  cacheLayoutDomReferences();
  if (!workspaceLayout) {
    logMissingElement("workspace");
    return;
  }

  workspaceLayout.classList.add("workspace-layout");
  workspaceLayout.style.display = "flex";
  state.layoutSizes.sidebarWidth = STABLE_SIDEBAR_WIDTH;
  sidebarSplitter?.setAttribute("aria-valuemin", String(SIDEBAR_MIN_WIDTH));
  sidebarSplitter?.setAttribute("aria-valuemax", String(SIDEBAR_MAX_WIDTH));
  sidebarSplitter?.setAttribute("aria-valuenow", String(state.layoutSizes.sidebarWidth));
  applySidebarMode();

  syncAllPanels(Object.keys(state.panelState).length === 0);
  openPanel("sidebar");
  openPanel("dashboard");
  openPanel("reports");

  syncWorkspaceLayout();
  logUiInfo("Rendered default layout", {
    currentView: state.currentView,
    secondaryPanel: currentSecondaryPanelName() || "none",
  });
}

function isDesktopWindowLayout() {
  return window.innerWidth >= LAYOUT_BREAKPOINT;
}

function isPhoneWindowLayout() {
  return currentResponsiveMode() === "mobile";
}

function isTabletWindowLayout() {
  return currentResponsiveMode() === "tablet";
}

function syncResponsiveNavigationSlots(mode = currentResponsiveMode()) {
  if (!notificationWrap || !notificationHome?.parent || !mobileNotificationSlot) return;

  const shouldUseTopbarSlot = mode !== "desktop";
  if (shouldUseTopbarSlot) {
    if (notificationWrap.parentNode !== mobileNotificationSlot) {
      mobileNotificationSlot.append(notificationWrap);
    }
    return;
  }

  if (notificationWrap.parentNode !== notificationHome.parent) {
    notificationHome.parent.insertBefore(notificationWrap, notificationHome.nextSibling);
  }
}

function normalizedLocationFilter(value = "") {
  return String(value || "").trim();
}

const LOCATION_PART_ALIASES = {
  "Senior School": ["Senior Building", "Senior"],
  "Prep School": ["Junior School", "Junior Area", "Junior"],
  "Pre-Prep School": ["Pre Prep School", "Pre-Prep", "Pre Prep"],
  "DT & Art Building": ["DT and Art Building", "DT Art Building", "Design Technology Building"],
  "Sports Building": ["PE Building"],
  "Sports Complex": [],
  "Sports Fields & Running Track": ["Sports Fields", "Running Track", "Sports Field", "Track", "Long Court"],
  "Administration Block": ["Administration", "Admin Office", "Admin Block"],
  "Junior Area": ["Prep School", "Junior School", "Junior"],
  "Strength & Conditioning": ["Strength and Conditioning", "Strength & Conditioning Room", "Strength and Conditioning Room", "S&C Room", "Weights Room"],
  "Strength & Conditioning Room": ["Strength and Conditioning", "Strength and Conditioning Room", "S&C Room", "Weights Room"],
  "New Sports Hall": ["New Hall"],
  "Sports Hall": ["Old Sports Hall"],
  "Changing Rooms": ["PE Changing Rooms", "PE Changing Room"],
  "Junior Playground": ["Playground"],
  "Junior DT Room": ["Junior Design Technology Room"],
};

const LOCATION_VALUE_ALIASES = {
  "Innovation Building > Floor 1": ["Innovation Building Level 1", "Innovation Building Floor 1", "A1"],
  "Innovation Building > Floor 2": ["Innovation Building Level 2", "Innovation Building Floor 2", "A2"],
  "Innovation Building > Floor 3": ["Innovation Building Level 3", "Innovation Building Floor 3", "A3"],
  "Innovation Building > Floor 4": ["Innovation Building Level 4", "Innovation Building Floor 4", "A4"],
  "Innovation Building > Floor 5": ["Innovation Building Level 5", "Innovation Building Floor 5", "A5"],
  "Senior School > Floor 1": ["Senior School Level 1", "Senior School Floor 1", "S1"],
  "Senior School > Floor 2": ["Senior School Level 2", "Senior School Floor 2", "S2"],
  "Senior School > Floor 3": ["Senior School Level 3", "Senior School Floor 3", "S3"],
  "Senior School > Floor 4": ["Senior School Level 4", "Senior School Floor 4", "S4"],
  "Prep School > Floor 1": ["Prep School Level 1", "Prep School Floor 1", "P1"],
  "Prep School > Floor 2": ["Prep School Level 2", "Prep School Floor 2", "P2"],
  "Prep School > Floor 3": ["Prep School Level 3", "Prep School Floor 3", "P3"],
  "Prep School > Floor 4": ["Prep School Level 4", "Prep School Floor 4", "P4"],
  "Pre-Prep School > Floor 1": ["Pre Prep School Level 1", "Pre-Prep School Floor 1", "Pre-Prep P1"],
  "Pre-Prep School > Floor 2": ["Pre Prep School Level 2", "Pre-Prep School Floor 2", "Pre-Prep P2"],
  "Pre-Prep School > Floor 3": ["Pre Prep School Level 3", "Pre-Prep School Floor 3", "Pre-Prep P3"],
  "Pre-Prep School > Floor 4": ["Pre Prep School Level 4", "Pre-Prep School Floor 4", "Pre-Prep P4"],
  "DT & Art Building > DT Room": ["DT Room", "Design Technology Room"],
  "DT & Art Building > Art Room": ["Art Room"],
  "Sports Building > New Sports Hall": ["New Sports Hall", "New Hall"],
  "Sports Building > Sports Hall": ["Sports Hall", "Old Sports Hall"],
  "Sports Complex > Changing Rooms": ["PE Changing Rooms", "PE Changing Room", "Changing Rooms"],
  "Sports Complex > Strength & Conditioning Room": ["Strength and Conditioning Room", "Strength and Conditioning", "S&C Room", "Weights Room"],
  "Junior Area > Junior Playground": ["Junior Playground", "Playground"],
  "Junior Area > Junior DT Room": ["Junior DT Room", "Junior Design Technology Room"],
};

const LOCATION_LEAVES_REQUIRING_PARENT = new Set([
  "new sports hall",
  "sports hall",
  "changing rooms",
  "strength and conditioning room",
]);

function locationPathParts(value = "") {
  return normalizedLocationFilter(value)
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
}

function locationPathLabel(value = "") {
  const parts = locationPathParts(value);
  return parts.length ? parts.map((part) => localizeValue(part)).join(" > ") : "";
}

function normalizeLocationText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function locationAliasesForPart(part = "") {
  return uniqueValues([part, ...(LOCATION_PART_ALIASES[part] || [])])
    .map(normalizeLocationText)
    .filter(Boolean);
}

function locationAliasesForValue(value = "") {
  return uniqueValues([value, ...(LOCATION_VALUE_ALIASES[value] || [])])
    .map(normalizeLocationText)
    .filter(Boolean);
}

function locationPartMatchesText(part = "", source = "") {
  return locationAliasesForPart(part).some((alias) => source.includes(alias));
}

function locationLeafNeedsParent(leaf = "") {
  return /^floor\s+\d+$/i.test(leaf)
    || /^[asp][1-5]$/i.test(leaf)
    || LOCATION_LEAVES_REQUIRING_PARENT.has(normalizeLocationText(leaf));
}

function floorNumberFromValue(value = "") {
  const label = String(value || "").trim();
  if (!label) return 0;
  const floorMatch = label.match(/\bfloor\s*([1-9])\b/i) || label.match(/\blevel\s*([1-9])\b/i);
  if (floorMatch) return Number(floorMatch[1]);
  const idMatch = label.match(/^floor-([1-9])$/i);
  if (idMatch) return Number(idMatch[1]);
  const legacyCodeMatch = label.match(/^[ASP]([1-9])$/i);
  if (legacyCodeMatch) return Number(legacyCodeMatch[1]);
  const roomCode = parseManualLocationCode(label);
  return roomCode?.floorNumber || 0;
}

function floorNumberForFloor(floor = {}) {
  return floorNumberFromValue(floor.label) || floorNumberFromValue(floor.id);
}

function academicFloorCountForLocation(location = {}, fallback = {}) {
  const id = stableElementId(location.id || fallback.id || location.name || fallback.name || location.label || fallback.label || "");
  return ACADEMIC_FLOOR_COUNTS_BY_LOCATION_ID[id] || 0;
}

function floorLabelForNumber(floorNumber) {
  return `Floor ${floorNumber}`;
}

function activeLocationLabel() {
  const location = normalizedLocationFilter(state.activeLocationFilter);
  return location ? locationPathLabel(location) : "";
}

function locationBrowserDefaultLabel() {
  return langText({
    en: "All locations",
    "zh-CN": "所有地点",
    th: "ทุกพื้นที่",
  });
}

function stableElementId(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "zone";
}

function coordinatePercent(value, fallback = 50) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(100, Math.max(0, numberValue));
}

function coordinateUnit(value, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    const fallbackNumber = Number(fallback);
    const normalizedFallback = fallbackNumber > 1 ? fallbackNumber / 100 : fallbackNumber;
    return Number.isFinite(normalizedFallback) ? Math.min(1, Math.max(0, normalizedFallback)) : 0;
  }
  const normalized = numberValue > 1 ? numberValue / 100 : numberValue;
  return Math.min(1, Math.max(0, normalized));
}

function normalizeSubLocationsForLocation(location = {}, fallback = {}) {
  let source = DEFAULT_SUB_LOCATIONS;
  [
    location.subLocations,
    location.sub_locations,
    location.directSubLocations,
    location.direct_sub_locations,
    fallback.subLocations,
    fallback.sub_locations,
    fallback.directSubLocations,
    fallback.direct_sub_locations,
  ].some((candidate) => {
    if (!Array.isArray(candidate)) return false;
    source = candidate;
    return true;
  });
  return source
    .map((subLocation, index) => {
      const label = String(subLocation?.label || subLocation?.name || subLocation?.id || DEFAULT_SUB_LOCATION_LABELS[index] || "").trim();
      if (!label) return null;
      return {
        id: stableElementId(subLocation?.id || label),
        label,
      };
    })
    .filter(Boolean);
}

function cleanFloorLabel(value = "", { academic = false } = {}) {
  const label = String(value || "").trim();
  if (!label || /^(?:undefined|null|\?)$/i.test(label)) return "";
  if (!academic) return label;
  const floorNumber = floorNumberFromValue(label);
  return floorNumber ? floorLabelForNumber(floorNumber) : label;
}

function defaultSubLocationsForFloor(location = {}, label = "") {
  return DEFAULT_SUB_LOCATIONS;
}

function normalizeFloorDefinitions(location = {}, fallback = {}) {
  const source = Array.isArray(location.floors)
    ? location.floors
    : Array.isArray(location.floor_definitions)
      ? location.floor_definitions
      : Array.isArray(fallback.floors)
        ? fallback.floors
        : Array.isArray(fallback.floor_definitions)
          ? fallback.floor_definitions
          : [];
  const requiredFloorCount = academicFloorCountForLocation(location, fallback);
  const normalizedFloors = source
    .map((floor, index) => {
      const label = cleanFloorLabel(floor?.label || floor?.name || floor?.id || "", { academic: Boolean(requiredFloorCount) });
      if (!label) return null;
      const floorNumber = floorNumberFromValue(label) || index + 1;
      return {
        id: requiredFloorCount ? `floor-${floorNumber}` : stableElementId(floor?.id || label || `floor-${index + 1}`),
        label,
        subLocations: normalizeSubLocationsForLocation(floor, {
          subLocations: defaultSubLocationsForFloor({ ...fallback, ...location }, label),
        }),
      };
    })
    .filter(Boolean);

  if (!requiredFloorCount) return normalizedFloors;

  const floorByNumber = new Map(
    normalizedFloors
      .filter((floor) => {
        const floorNumber = floorNumberForFloor(floor);
        return floorNumber >= 1 && floorNumber <= requiredFloorCount;
      })
      .map((floor) => [floorNumberForFloor(floor), floor]),
  );
  return Array.from({ length: requiredFloorCount }, (_, index) => {
    const floorNumber = index + 1;
    const label = floorLabelForNumber(floorNumber);
    return floorByNumber.get(floorNumber) || {
      id: `floor-${floorNumber}`,
      label,
      subLocations: defaultSubLocationsForFloor({ ...fallback, ...location }, label),
    };
  });
}

function normalizeRegionPoints(points = []) {
  if (!Array.isArray(points)) return [];
  return points
    .map((point) => {
      const x = Array.isArray(point) ? point[0] : point?.x;
      const y = Array.isArray(point) ? point[1] : point?.y;
      const normalizedX = Number(x);
      const normalizedY = Number(y);
      if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) return null;
      return [
        Math.min(1, Math.max(0, normalizedX)),
        Math.min(1, Math.max(0, normalizedY)),
      ];
    })
    .filter(Boolean);
}

function normalizeLocationInteractionRegion(region = {}, location = {}, index = 0) {
  const type = "zone";
  const fallbackRegion = location.region || {};
  const fallbackWidth = coordinateUnit(fallbackRegion.width, 0.14);
  const fallbackHeight = coordinateUnit(fallbackRegion.height, 0.08);
  const x = coordinateUnit(region.x, coordinateUnit(fallbackRegion.x, coordinateUnit(location.x, 50)));
  const y = coordinateUnit(region.y, coordinateUnit(fallbackRegion.y, coordinateUnit(location.y, 50)));
  const width = Math.min(1 - x, Math.max(0.001, coordinateUnit(region.width, fallbackWidth)));
  const height = Math.min(1 - y, Math.max(0.001, coordinateUnit(region.height, fallbackHeight)));
  return {
    id: stableElementId(region.id || `${location.id || "location"}-${type}-${index + 1}`),
    locationId: location.id || "",
    label: String(region.label || location.label || location.name || "").trim(),
    x,
    y,
    width,
    height,
    points: [],
    shape: "box",
    type,
  };
}

function normalizeLocationInteractionRegions(location = {}, fallback = {}) {
  const source = Array.isArray(location.interactionRegions)
    ? location.interactionRegions
    : Array.isArray(location.interaction_regions)
      ? location.interaction_regions
      : Array.isArray(fallback.interactionRegions)
        ? fallback.interactionRegions
        : Array.isArray(fallback.interaction_regions)
          ? fallback.interaction_regions
          : [];
  const regions = source
    .map((region, index) => normalizeLocationInteractionRegion(region, location, index))
    .filter((region) => region.id && region.label);
  if (regions.length) return regions;
  const fallbackRegion = fallback.region || location.region || {};
  return [normalizeLocationInteractionRegion({
    id: `${location.id || "location"}-region`,
    label: location.name || location.label || "",
    x: coordinateUnit(fallbackRegion.x, coordinateUnit(location.x, 50)),
    y: coordinateUnit(fallbackRegion.y, coordinateUnit(location.y, 50)),
    width: coordinateUnit(fallbackRegion.width, 0.14),
    height: coordinateUnit(fallbackRegion.height, 0.08),
    type: "zone",
  }, location, 0)];
}

function normalizeSchoolLocation(location = {}, index = 0) {
  const fallback = SCHOOL_LOCATIONS[index] || {};
  const name = String(location.name || location.zone || fallback.name || location.label || "").trim();
  const id = stableElementId(location.id || name || fallback.id || `location-${index + 1}`);
  const locationWithId = { ...fallback, ...location, id, name };
  const region = {
    ...(fallback.region || {}),
    ...(location.region && typeof location.region === "object" ? location.region : {}),
  };
  return {
    id,
    name,
    label: String(location.label || fallback.label || name).trim(),
    x: coordinatePercent(location.x, fallback.x ?? 50),
    y: coordinatePercent(location.y, fallback.y ?? 50),
    region,
    metadata: {
      ...(fallback.metadata || {}),
      ...(location.metadata && typeof location.metadata === "object" ? location.metadata : {}),
    },
    floors: normalizeFloorDefinitions(location, fallback),
    subLocations: normalizeSubLocationsForLocation(location, fallback),
    interactionRegions: normalizeLocationInteractionRegions(locationWithId, fallback),
  };
}

function normalizeSchoolLocations(locations = []) {
  const normalizedInput = Array.isArray(locations)
    ? locations.map(normalizeSchoolLocation).filter((location) => location.id && location.name)
    : [];
  const byId = new Map(normalizedInput.map((location) => [location.id, location]));
  const byName = new Map(normalizedInput.map((location) => [normalizeLocationText(location.name), location]));
  return SCHOOL_LOCATIONS.map((fallback, index) => {
    const fallbackLocation = normalizeSchoolLocation(fallback, index);
    const match = byId.get(fallbackLocation.id) || byName.get(normalizeLocationText(fallbackLocation.name));
    return match ? normalizeSchoolLocation({ ...fallbackLocation, ...match }, index) : fallbackLocation;
  });
}

function schoolLocationById(locationId) {
  return state.locations.find((location) => location.id === locationId) || null;
}

function locationHasFloors(location) {
  return Array.isArray(location?.floors) && location.floors.length > 0;
}

function locationUsesDirectExpandedSubLocations(location) {
  return Boolean(locationHasFloors(location) && location?.metadata?.navigation === "direct-expanded-sub-locations");
}

function directSubLocationsForLocation(location) {
  if (locationUsesDirectExpandedSubLocations(location)) {
    return Array.isArray(location.floors?.[0]?.subLocations) ? location.floors[0].subLocations : [];
  }
  if (locationHasFloors(location)) return [];
  return Array.isArray(location?.subLocations) ? location.subLocations : [];
}

function floorById(location, floorId) {
  if (!locationHasFloors(location)) return null;
  return location.floors.find((floor) => floor.id === floorId) || null;
}

function validFloorLabelForLocation(location, floor) {
  const floorCount = academicFloorCountForLocation(location);
  const label = cleanFloorLabel(floor?.label || floor?.id || "", { academic: Boolean(floorCount) });
  if (!label) return "";
  if (floorCount) {
    const floorNumber = floorNumberFromValue(label);
    if (!floorNumber || floorNumber > floorCount) return "";
    return floorLabelForNumber(floorNumber);
  }
  return label;
}

function floorForLabel(location, label = "") {
  const normalized = normalizedLocationFilter(label);
  const requestedFloorNumber = floorNumberFromValue(label);
  const normalizedText = normalizeLocationText(normalized);
  if (!locationHasFloors(location) || !normalized) return null;
  return location.floors.find((floor) => (
    normalizedLocationFilter(floor.label) === normalized
      || normalizedLocationFilter(floor.id) === normalized
      || normalizeLocationText(floor.label) === normalizedText
      || normalizeLocationText(floor.id) === normalizedText
      || (requestedFloorNumber && floorNumberForFloor(floor) === requestedFloorNumber)
  )) || null;
}

function subLocationById(source = [], subLocationId = "") {
  return source.find((subLocation) => subLocation.id === subLocationId) || null;
}

function subLocationForLabel(source = [], label = "") {
  const normalized = normalizedLocationFilter(label);
  if (!normalized) return null;
  return source.find((subLocation) => (
    normalizedLocationFilter(subLocation.label) === normalized
      || normalizedLocationFilter(subLocation.id) === normalized
  )) || null;
}

function selectedSchoolLocation() {
  return schoolLocationById(state.selectedZone || state.selectedLocation);
}

function selectedSchoolFloor() {
  const location = selectedSchoolLocation();
  return floorById(location, state.selectedFloor?.id || "");
}

function selectedSchoolSubLocation() {
  const location = selectedSchoolLocation();
  if (!location || !state.selectedSubLocation?.id) return null;
  const floor = selectedSchoolFloor();
  const source = floor?.subLocations || directSubLocationsForLocation(location);
  return subLocationById(source, state.selectedSubLocation.id);
}

function schoolLocationForFilter(value = "") {
  const normalizedValue = normalizedLocationFilter(value);
  const source = normalizeLocationText(normalizedValue);
  if (!normalizedValue) return null;
  return state.locations.find((location) => (
    location.id === normalizedValue
      || normalizedLocationFilter(location.name) === normalizedValue
      || normalizedLocationFilter(location.label) === normalizedValue
      || normalizeLocationText(location.name) === source
      || normalizeLocationText(location.label) === source
  )) || null;
}

function schoolLocationFilterValue(location) {
  return location?.name || "";
}

function syncSelectedLocationFromFilter() {
  const active = currentLocationFilterValue();
  const parts = locationPathParts(active);
  const parentLocation = parts.length > 1 ? schoolLocationForFilter(parts[0]) : null;
  const location = parentLocation || schoolLocationForFilter(active);
  state.selectedZone = location?.id || null;
  state.selectedLocation = location?.id || null;
  state.selectedFloor = null;
  state.selectedSubLocation = null;

  if (location && parts.length > 1) {
    const floor = floorForLabel(location, parts[1]);
    if (floor) {
      state.selectedFloor = { locationId: location.id, id: floor.id, label: floor.label };
      const subLocation = parts.length > 2 ? subLocationForLabel(floor.subLocations, parts[2]) : null;
      state.selectedSubLocation = subLocation
        ? { locationId: location.id, floorId: floor.id, id: subLocation.id, label: subLocation.label }
        : null;
    } else {
      const subLocation = subLocationForLabel(directSubLocationsForLocation(location), parts[1]);
      state.selectedSubLocation = subLocation
        ? { locationId: location.id, id: subLocation.id, label: subLocation.label }
        : null;
    }
  }
  return location;
}

function currentSchoolLocation() {
  return selectedSchoolLocation() || schoolLocationForFilter(currentLocationFilterValue());
}

function regionPath(region) {
  return region?.zone && region?.label ? `${region.zone} > ${region.label}` : "";
}

function regionById(regionId) {
  return state.mapRegions.find((region) => region.id === regionId) || null;
}

function regionsForZone(zone) {
  return state.mapRegions
    .filter((region) => region.zone === zone)
    .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
}

function campusLocationsFromMap() {
  return uniqueValues(state.locations.flatMap((location) => {
    const directSubLocations = directSubLocationsForLocation(location);
    if (directSubLocations.length) {
      return [
        schoolLocationFilterValue(location),
        ...directSubLocations.map((subLocation) => `${location.name} > ${subLocation.label}`),
      ];
    }
    return [
      schoolLocationFilterValue(location),
      ...location.floors.flatMap((floor) => [
        `${location.name} > ${floor.label}`,
        ...floor.subLocations.map((subLocation) => `${location.name} > ${floor.label} > ${subLocation.label}`),
      ]),
    ];
  }));
}

function selectedMapZone() {
  const location = selectedSchoolLocation();
  if (location?.name) return location.name;
  const parts = locationPathParts(currentLocationFilterValue());
  return state.mapZones.includes(parts[0]) ? parts[0] : "";
}

function selectedMapRegion() {
  return null;
}

function mapRegionStats(region) {
  const localItems = itemsForMapRegion(region);
  const recentCount = localItems.filter(itemRecentForMap).length;
  return {
    item_count: localItems.length,
    lost_count: localItems.filter((item) => String(item.report_type || "").toLowerCase() === "lost").length,
    recent_count: recentCount,
    recent_activity: Boolean(recentCount),
  };
}

function mapZoneStats(zone) {
  const localItems = state.items.filter((item) => itemMatchesMapZone(item, zone));
  const recentCount = localItems.filter(itemRecentForMap).length;
  return {
    item_count: localItems.length,
    lost_count: localItems.filter((item) => String(item.report_type || "").toLowerCase() === "lost").length,
    recent_count: recentCount,
    recent_activity: Boolean(recentCount),
  };
}

function itemsForSchoolLocation(location) {
  if (!location?.name) return [];
  return state.items.filter((item) => !item.claimed && !item.returned_at && itemMatchesMapZone(item, location.name));
}

function recentItemsForSchoolLocation(location, limit = 3) {
  return itemsForSchoolLocation(location)
    .slice()
    .sort((a, b) => {
      const left = dateFromItem(a)?.getTime() || 0;
      const right = dateFromItem(b)?.getTime() || 0;
      return right - left;
    })
    .slice(0, limit);
}

function latestImageItemForItems(items = []) {
  return items
    .slice()
    .sort((a, b) => {
      const left = dateFromItem(a)?.getTime() || 0;
      const right = dateFromItem(b)?.getTime() || 0;
      return right - left;
    })
    .find((item) => canPreviewImage(state.previewUrls.get(item.id) || resolveImageUrl(item))) || null;
}

function schoolLocationStats(location) {
  const localItems = itemsForSchoolLocation(location);
  const recentItems = recentItemsForSchoolLocation(location);
  const localLostCount = localItems.filter((item) => String(item.report_type || "").toLowerCase() === "lost").length;
  return {
    item_count: localItems.length,
    lost_count: localLostCount,
    recent_count: recentItems.length,
    recent_activity: Boolean(recentItems.length),
    recent_items: recentItems,
    latest_image_item: latestImageItemForItems(localItems),
  };
}

function schoolLocationDisplayName(location) {
  return localizeValue(location?.label || location?.name || "");
}

function locationFloorPath(location, floor) {
  const floorLabel = validFloorLabelForLocation(location, floor);
  if (!location?.name || !floorLabel) return "";
  return `${location.name} > ${floorLabel}`;
}

function locationSubLocationPath(location, subLocation, floor = null) {
  if (!location?.name || !subLocation?.label) return "";
  const floorLabel = floor ? validFloorLabelForLocation(location, floor) : "";
  return floorLabel
    ? `${location.name} > ${floorLabel} > ${subLocation.label}`
    : `${location.name} > ${subLocation.label}`;
}

function itemMatchesFloor(item, location, floor) {
  if (!location?.name || !floor?.label) return false;
  const floorNumber = floorNumberForFloor(floor);
  if (floorNumber && itemRoomLocationInfos(item).some((info) => (
    info.locationId === location.id && info.floorNumber === floorNumber
  ))) {
    return true;
  }
  const sources = itemMapTextSources(item);
  const parentAliases = uniqueValues([location.name, location.label])
    .map(normalizeLocationText)
    .filter(Boolean);
  const floorAliases = locationAliasesForPart(floor.label);
  return sources.some((source) => {
    const floorMatches = floorAliases.some((alias) => source.includes(alias));
    if (!floorMatches) return false;
    const parentMatches = parentAliases.some((alias) => source.includes(alias));
    return parentMatches || !locationLeafNeedsParent(floor.label);
  });
}

function itemMatchesSubLocation(item, location, subLocation, floor = null) {
  if (!location?.name || !subLocation?.label) return false;
  const floorNumber = floor ? floorNumberForFloor(floor) : 0;
  if (itemRoomLocationInfos(item).some((info) => (
    info.locationId === location.id
      && info.subLocationId === subLocation.id
      && (!floorNumber || info.floorNumber === floorNumber)
  ))) {
    return true;
  }
  const sources = itemMapTextSources(item);
  const parentAliases = uniqueValues([location.name, location.label])
    .map(normalizeLocationText)
    .filter(Boolean);
  const leafAliases = locationAliasesForPart(subLocation.label);
  const floorAliases = floor?.label ? locationAliasesForPart(floor.label) : [];
  return sources.some((source) => {
    const leafMatches = leafAliases.some((alias) => source.includes(alias));
    if (!leafMatches) return false;
    const parentMatches = parentAliases.some((alias) => source.includes(alias));
    const floorMatches = floorAliases.length ? floorAliases.some((alias) => source.includes(alias)) : true;
    return (parentMatches || !locationLeafNeedsParent(subLocation.label)) && floorMatches;
  });
}

function itemsForFloor(location, floor) {
  if (!location || !floor) return [];
  return state.items.filter((item) => !item.claimed && !item.returned_at && itemMatchesFloor(item, location, floor));
}

function recentItemsForFloor(location, floor, limit = 3) {
  return itemsForFloor(location, floor)
    .slice()
    .sort((a, b) => {
      const left = dateFromItem(a)?.getTime() || 0;
      const right = dateFromItem(b)?.getTime() || 0;
      return right - left;
    })
    .slice(0, limit);
}

function schoolFloorStats(location, floor) {
  const localItems = itemsForFloor(location, floor);
  const recentItems = recentItemsForFloor(location, floor);
  const localLostCount = localItems.filter((item) => String(item.report_type || "").toLowerCase() === "lost").length;
  return {
    item_count: localItems.length,
    lost_count: localLostCount,
    recent_count: recentItems.length,
    recent_activity: Boolean(recentItems.length),
    recent_items: recentItems,
    latest_image_item: latestImageItemForItems(localItems),
  };
}

function itemsForSubLocation(location, subLocation, floor = null) {
  if (!location || !subLocation) return [];
  return state.items.filter((item) => !item.claimed && !item.returned_at && itemMatchesSubLocation(item, location, subLocation, floor));
}

function recentItemsForSubLocation(location, subLocation, limit = 3, floor = null) {
  return itemsForSubLocation(location, subLocation, floor)
    .slice()
    .sort((a, b) => {
      const left = dateFromItem(a)?.getTime() || 0;
      const right = dateFromItem(b)?.getTime() || 0;
      return right - left;
    })
    .slice(0, limit);
}

function schoolSubLocationStats(location, subLocation, floor = null) {
  const localItems = itemsForSubLocation(location, subLocation, floor);
  const recentItems = recentItemsForSubLocation(location, subLocation, 3, floor);
  const localLostCount = localItems.filter((item) => String(item.report_type || "").toLowerCase() === "lost").length;
  return {
    item_count: localItems.length,
    lost_count: localLostCount,
    recent_count: recentItems.length,
    recent_activity: Boolean(recentItems.length),
    recent_items: recentItems,
    latest_image_item: latestImageItemForItems(localItems),
  };
}

function currentLocationFilterValue() {
  return normalizedLocationFilter(state.activeLocationFilter);
}

function ensureLocationFilterOption(value) {
  if (!locationFilter || !value) return;
  const exists = Array.from(locationFilter.options).some((option) => option.value === value);
  if (!exists) {
    locationFilter.append(new Option(locationPathLabel(value), value));
  }
}

function syncLocationFilterSelect() {
  if (!locationFilter) return;
  const value = currentLocationFilterValue();
  ensureLocationFilterOption(value);
  locationFilter.value = value;
}

function syncLocationFilterBanner() {
  if (!locationFilterBanner || !locationFilterBannerText) return;
  const location = activeLocationLabel();
  const hasLocation = Boolean(location);
  locationFilterBanner.classList.toggle("is-hidden", !hasLocation);
  locationFilterBannerText.textContent = hasLocation
    ? `Showing reports for ${location}`
    : "Showing all campus locations";
}

function refreshLocationBrowserRefs() {
  locationBrowserButtons = Array.from(document.querySelectorAll("[data-location-filter]"));
  locationTreeGroups = Array.from(document.querySelectorAll("[data-location-group]"));
}

function renderLocationBrowserTree() {
  if (!locationBrowserTree) return;
  locationBrowserTree.replaceChildren();

  state.locations.forEach((location) => {
    const stats = schoolLocationStats(location);
    const button = document.createElement("button");
    button.className = "ghost-button location-browser-button location-mirror-button";
    button.type = "button";
    button.dataset.locationId = location.id;
    button.dataset.locationFilter = schoolLocationFilterValue(location);

    const label = document.createElement("span");
    label.className = "location-browser-name";
    label.textContent = localizeValue(location.name);

    const meta = document.createElement("span");
    meta.className = "location-browser-meta";
    meta.textContent = `${stats.lost_count}`;
    meta.setAttribute("aria-label", `${stats.lost_count} lost items`);

    button.append(label, meta);
    locationBrowserTree.append(button);
  });

  refreshLocationBrowserRefs();
  syncLocationBrowserState();
}

function syncLocationBrowserState() {
  refreshLocationBrowserRefs();
  const activeLocation = currentLocationFilterValue();
  locationTreeGroups.forEach((group) => group.classList.remove("has-active-descendant"));
  locationBrowserButtons.forEach((button) => {
    const buttonLocation = normalizedLocationFilter(button.dataset.locationFilter || "");
    const active = buttonLocation === activeLocation;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    if (active) {
      button.setAttribute("aria-current", "location");
      const group = button.closest("[data-location-group]");
      if (group && !button.hasAttribute("data-location-toggle")) setLocationGroupExpanded(group, true);
    } else {
      button.removeAttribute("aria-current");
    }
  });
  locationTreeGroups.forEach((group) => {
    const activeButton = group.querySelector(".location-browser-button.is-active");
    const parentButton = group.querySelector("[data-location-toggle]");
    group.classList.toggle("has-active-descendant", Boolean(activeButton && activeButton !== parentButton));
  });
  syncLocationFilterSelect();
}

function setLocationGroupExpanded(group, expanded) {
  if (!group) return;
  group.classList.toggle("is-expanded", Boolean(expanded));
  const toggleButton = group.querySelector("[data-location-toggle]");
  toggleButton?.setAttribute("aria-expanded", String(Boolean(expanded)));
}

function toggleLocationGroup(button) {
  const group = button?.closest("[data-location-group]");
  if (!group) return;
  setLocationGroupExpanded(group, !group.classList.contains("is-expanded"));
}

function handleLocationBrowserClick(button) {
  if (!button) return;
  const locationId = button.dataset.locationId || schoolLocationForFilter(button.dataset.locationFilter || "")?.id || "";
  if (locationId) {
    selectSchoolLocation(locationId, { openMap: true, closeDrawer: true });
    return;
  }
  setActiveLocationFilter(button.dataset.locationFilter || "", {
    focusDashboard: false,
    closeDrawer: true,
  });
}

function closeLocationDrawer() {
  state.locationDrawerOpen = false;
  syncWorkspaceLayout();
}

function openLocationDrawer() {
  state.locationDrawerOpen = true;
  openPanel("sidebar");
}

function setActiveLocationFilter(value = "", {
  updateSelect = true,
  load = true,
  focusDashboard = false,
  closeDrawer = true,
  source = "",
} = {}) {
  state.activeLocationFilter = normalizedLocationFilter(value);
  state.locationFilterSource = state.activeLocationFilter ? source : "";
  syncSelectedLocationFromFilter();
  syncMapSelectionFromFilter();
  if (updateSelect) {
    syncLocationFilterSelect();
  }
  invalidateSearchCache();
  syncLocationBrowserState();
  updateLocationBar();
  syncLocationFilterBanner();

  if (closeDrawer && currentResponsiveMode() !== "desktop") {
    state.locationDrawerOpen = false;
    syncWorkspaceLayout();
  }

  if (focusDashboard && state.user && state.currentView !== "dashboard") {
    navigateTo("dashboard");
  }

  renderLocationScopedSurfaces();

  if (load && state.user) {
    void loadItems();
  } else {
    syncWorkspaceLayout();
  }
}

function selectSchoolLocation(locationId, {
  openMap = true,
  closeDrawer = true,
  load = true,
} = {}) {
  const location = schoolLocationById(locationId);
  if (!location) return;
  state.selectedZone = location.id;
  state.selectedLocation = location.id;
  state.selectedFloor = null;
  state.selectedSubLocation = null;
  focusCameraOnRegion(primaryRegionForLocation(location));
  setActiveLocationFilter(schoolLocationFilterValue(location), {
    load,
    focusDashboard: false,
    closeDrawer,
    source: "map",
  });
  renderLocationViewPanel(location);
  renderSchoolMap();
  if (openMap && state.user && state.currentView !== "map") {
    navigateTo("map");
  } else {
    syncWorkspaceLayout();
  }
}

function sectionAvailableInCurrentMode(section) {
  if (currentUserIsStudent()) {
    return new Set(["dashboard", "map", "query", "reports", "account", "returned"]).has(section);
  }
  if (section === "admin") {
    return state.advancedMode && currentUserCanAdmin();
  }
  if (simpleModeSections.has(section)) return true;
  if (advancedModeSections.has(section)) return state.advancedMode;
  return isPrimaryPanel(section);
}

function syncModeLabels() {
  const setShortLabel = (button, value) => {
    if (button) button.dataset.shortLabel = value;
  };
  if (state.advancedMode) {
    showDashboardButton.textContent = t("nav.dashboard");
    if (showMapButton) showMapButton.textContent = t("nav.map");
    showReportsButton.textContent = t("nav.reports");
    showReportItemButton.textContent = langText({ en: "Report item", "zh-CN": "提交报告", th: "ส่งรายงาน" });
    showRoomButton.textContent = t("nav.room");
    showClaimsButton.textContent = t("nav.claims");
    showNotificationsButton.textContent = t("notifications.title");
    showAccountButton.textContent = t("nav.account");
    setShortLabel(showDashboardButton, t("nav.dashboard"));
    setShortLabel(showMapButton, t("nav.mapShort"));
    setShortLabel(showReportsButton, t("nav.reports"));
    setShortLabel(showReportItemButton, langText({ en: "Report", "zh-CN": "报告", th: "รายงาน" }));
    setShortLabel(showRoomButton, langText({ en: "Room", "zh-CN": "招领室", th: "ห้อง" }));
    setShortLabel(showClaimsButton, t("nav.claims"));
    setShortLabel(showNotificationsButton, t("notifications.title"));
    setShortLabel(showAccountButton, t("nav.account"));
    if (advancedModeTitle) advancedModeTitle.textContent = langText({ en: "Advanced Mode", "zh-CN": "高级模式", th: "โหมดขั้นสูง" });
    if (advancedModeStatus) advancedModeStatus.textContent = langText({ en: "On", "zh-CN": "已开启", th: "เปิด" });
    return;
  }

  if (currentUserIsStudent()) {
    showDashboardButton.textContent = t("nav.dashboard");
    if (showMapButton) showMapButton.textContent = t("nav.map");
    showQueryButton.textContent = t("nav.query");
    showReportsButton.textContent = t("nav.reports");
    showAccountButton.textContent = langText({ en: "Profile", "zh-CN": "个人资料", th: "โปรไฟล์" });
    showReturnedButton.textContent = langText({ en: "Recently Returned", "zh-CN": "最近归还", th: "เพิ่งถูกรับคืน" });
    setShortLabel(showDashboardButton, t("nav.dashboard"));
    setShortLabel(showMapButton, t("nav.mapShort"));
    setShortLabel(showQueryButton, t("nav.query"));
    setShortLabel(showReportsButton, t("nav.reports"));
    setShortLabel(showAccountButton, langText({ en: "Profile", "zh-CN": "资料", th: "โปรไฟล์" }));
    setShortLabel(showReturnedButton, langText({ en: "Returned", "zh-CN": "归还", th: "รับคืน" }));
    if (advancedModeTitle) advancedModeTitle.textContent = langText({ en: "Student Mode", "zh-CN": "学生模式", th: "โหมดนักเรียน" });
    if (advancedModeStatus) advancedModeStatus.textContent = langText({ en: "Focused", "zh-CN": "精简", th: "โฟกัส" });
    return;
  }

  showDashboardButton.textContent = t("nav.dashboard");
  if (showMapButton) showMapButton.textContent = t("nav.map");
  showReportsButton.textContent = langText({ en: "Claim item", "zh-CN": "认领物品", th: "รับของคืน" });
  showReportItemButton.textContent = langText({ en: "Report", "zh-CN": "报告", th: "รายงาน" });
  showRoomButton.textContent = langText({ en: "Lost & Found Room", "zh-CN": "失物招领室", th: "ห้องของหาย" });
  showClaimsButton.textContent = langText({ en: "Claims", "zh-CN": "认领", th: "คำขอ" });
  showNotificationsButton.textContent = t("notifications.title");
  showAccountButton.textContent = langText({ en: "Profile", "zh-CN": "个人资料", th: "โปรไฟล์" });
  setShortLabel(showDashboardButton, t("nav.dashboard"));
  setShortLabel(showMapButton, t("nav.mapShort"));
  setShortLabel(showReportsButton, langText({ en: "Claim", "zh-CN": "认领", th: "รับคืน" }));
  setShortLabel(showReportItemButton, langText({ en: "Report", "zh-CN": "报告", th: "รายงาน" }));
  setShortLabel(showRoomButton, langText({ en: "Room", "zh-CN": "招领室", th: "ห้อง" }));
  setShortLabel(showClaimsButton, langText({ en: "Claims", "zh-CN": "认领", th: "คำขอ" }));
  setShortLabel(showNotificationsButton, langText({ en: "Alerts", "zh-CN": "通知", th: "แจ้งเตือน" }));
  setShortLabel(showAccountButton, langText({ en: "Profile", "zh-CN": "资料", th: "โปรไฟล์" }));
  if (advancedModeTitle) advancedModeTitle.textContent = langText({ en: "Simple Mode", "zh-CN": "简单模式", th: "โหมดง่าย" });
  if (advancedModeStatus) advancedModeStatus.textContent = langText({ en: "Default", "zh-CN": "默认", th: "ค่าเริ่มต้น" });
}

function syncModeUi({ navigateIfNeeded = false } = {}) {
  if (currentUserIsStudent()) {
    state.advancedMode = false;
  }
  appShell?.classList.toggle("is-advanced-mode", state.advancedMode);
  appShell?.classList.toggle("is-simple-mode", !state.advancedMode);
  appShell?.classList.toggle("is-student-mode", currentUserIsStudent());
  document.body.dataset.experienceMode = state.advancedMode ? "advanced" : "simple";
  document.body.dataset.userRole = state.user ? currentUserRole() : "";

  if (advancedModeToggle) {
    advancedModeToggle.checked = state.advancedMode;
    advancedModeToggle.disabled = currentUserIsStudent();
    advancedModeToggle.setAttribute("aria-checked", String(state.advancedMode));
  }

  const showAdvancedNav = state.advancedMode;
  const isStudent = currentUserIsStudent();
  const canCreateContent = currentUserCanCreateContent();
  showDashboardButton?.classList.remove("is-hidden");
  showMapButton?.classList.remove("is-hidden");
  showReportItemButton?.classList.toggle("is-hidden", isStudent || showAdvancedNav || !canCreateContent);
  showRoomButton?.classList.toggle("is-hidden", isStudent);
  showReturnedButton?.classList.remove("is-hidden");
  showQueryButton?.classList.remove("is-hidden");
  showReportsButton?.classList.remove("is-hidden");
  showClaimsButton?.classList.toggle("is-hidden", isStudent);
  showNotificationsButton?.classList.toggle("is-hidden", isStudent);
  topbarReportButton?.classList.toggle("is-hidden", !canCreateContent);
  dashboardReportButton?.classList.toggle("is-hidden", !canCreateContent);
  openReportModalButton?.classList.toggle("is-hidden", !canCreateContent);
  showAdminButton?.classList.toggle("is-hidden", !(showAdvancedNav && currentUserCanAdmin()));
  logoutButton?.classList.remove("is-hidden");
  roomAdminPanel?.classList.toggle("is-hidden", !canCreateContent);
  dashboardAdvancedButtons.forEach((button) => {
    button.classList.toggle("is-hidden", !(showAdvancedNav && currentUserCanAdmin()));
  });
  dashboardTeacherButtons.forEach((button) => {
    button.classList.toggle("is-hidden", isStudent);
  });

  syncModeLabels();
  renderSidebarIcons();
  syncLocationBrowserState();
  syncNewWindowMenu();

  if (!state.advancedMode) {
    state.multitaskRequested = false;
    state.multitaskActive = false;
  }

  if (navigateIfNeeded && state.user && !sectionAvailableInCurrentMode(state.currentView)) {
    navigateTo("dashboard");
  }
}

function setAdvancedMode(enabled, { persist = true, navigateIfNeeded = true } = {}) {
  if (currentUserIsStudent()) {
    enabled = false;
  }
  state.advancedMode = Boolean(enabled);
  if (persist) {
    localStorage.setItem(ADVANCED_MODE_STORAGE_KEY, state.advancedMode ? "true" : "false");
  }
  if (!state.advancedMode) {
    closeNewWindowMenu();
  }
  setSidebarMode("left");
  syncModeUi({ navigateIfNeeded });
  applyNavigationLayoutPolicy(state.currentView);
  syncWorkspaceLayout();
}

function defaultPanelLayout(name) {
  return {
    closed: !["sidebar", "dashboard", "reports"].includes(name),
    minimized: false,
    collapsed: name === "sidebar" ? false : undefined,
  };
}

function ensurePanelState(name) {
  if (!state.panelState[name]) {
    state.panelState[name] = defaultPanelLayout(name);
  }
  return state.panelState[name];
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function currentSecondaryPanelName() {
  return secondaryPanelNames.includes(state.currentView) ? state.currentView : "";
}

function clampLayoutSizes() {
  const workspaceRect = windowWorkspace?.getBoundingClientRect();
  if (currentSidebarMode() !== "minimal") {
    state.layoutSizes.sidebarWidth = clampValue(
      Math.round(state.layoutSizes.sidebarWidth || SIDEBAR_DEFAULT_WIDTH),
      SIDEBAR_MIN_WIDTH,
      SIDEBAR_MAX_WIDTH,
    );
  }

  const secondaryMax = Math.max(
    SECONDARY_MIN_HEIGHT,
    Math.round((workspaceRect?.height || window.innerHeight) - REPORTS_MIN_HEIGHT - SPLITTER_SIZE),
  );
  state.layoutSizes.secondaryHeight = clampValue(
    Math.round(state.layoutSizes.secondaryHeight || 320),
    SECONDARY_MIN_HEIGHT,
    secondaryMax,
  );

  const availableWidth = Math.round(workspaceRect?.width || window.innerWidth);
  const secondaryWidthMax = Math.max(
    SECONDARY_MIN_WIDTH,
    availableWidth - REPORTS_MIN_WIDTH - SPLITTER_SIZE,
  );
  state.layoutSizes.secondaryWidth = clampValue(
    Math.round(state.layoutSizes.secondaryWidth || 420),
    SECONDARY_MIN_WIDTH,
    Math.max(SECONDARY_MIN_WIDTH, Math.min(560, secondaryWidthMax)),
  );
}

function applyPanelLayout(name) {
  const panel = panelElements[name];
  if (!panel) return;

  const panelState = ensurePanelState(name);
  panel.classList.toggle("is-minimized", panelState.minimized);
  if (name === "sidebar") {
    panel.classList.toggle("is-collapsed", Boolean(panelState.collapsed));
    sidebarCollapseButton?.setAttribute("aria-pressed", String(Boolean(panelState.collapsed)));
  }
}

function syncWorkspaceLayout() {
  if (!workspaceLayout || !windowWorkspace) {
    return;
  }

  clampLayoutSizes();

  const sidebarState = ensurePanelState("sidebar");
  const sidebarMode = currentSidebarMode();
  const reportsState = ensurePanelState("reports");
  const secondaryName = currentSecondaryPanelName();
  const secondaryPanel = secondaryName ? panelElements[secondaryName] : null;
  const secondaryState = secondaryName ? ensurePanelState(secondaryName) : null;
  const responsiveMode = currentResponsiveMode();
  const phoneLayout = responsiveMode === "mobile";
  const tabletLayout = responsiveMode === "tablet";
  const drawerLayout = responsiveMode !== "desktop";
  if (!drawerLayout) {
    state.locationDrawerOpen = false;
  }

  sidebarState.closed = drawerLayout ? !state.locationDrawerOpen : false;
  state.layoutSizes.sidebarWidth = sidebarState.collapsed ? SIDEBAR_COLLAPSED_WIDTH : STABLE_SIDEBAR_WIDTH;

  if (drawerLayout) {
    sidebarState.collapsed = false;
    reportsState.minimized = false;
    if (secondaryState) {
      secondaryState.minimized = false;
    }
  }

  const sidebarVisible = !sidebarState.closed;
  const primaryVisible = phoneLayout ? isPrimaryPanel(state.currentView) : !reportsState.closed;
  const dashboardVisible = primaryVisible && state.currentView === "dashboard";
  const reportsVisible = primaryVisible && !dashboardVisible;
  const secondaryVisible = phoneLayout
    ? Boolean(secondaryPanel && secondaryName && state.currentView !== "reports")
    : Boolean(secondaryPanel && secondaryState && !secondaryState.closed);
  const canResizeContent = isDesktopWindowLayout()
    && reportsVisible
    && secondaryVisible
    && !reportsState.minimized
    && !secondaryState.minimized;
  const splitContentSideBySide = canResizeContent && isDesktopWindowLayout();

  appShell?.classList.toggle("has-open-sidebar", sidebarVisible);
  appShell?.classList.toggle("is-location-drawer-open", drawerLayout && sidebarVisible);
  appShell?.classList.toggle("is-phone-layout", phoneLayout);
  appShell?.classList.toggle("is-tablet-layout", tabletLayout);
  appShell?.classList.toggle("is-desktop-layout", responsiveMode === "desktop");
  if (appShell) {
    appShell.dataset.layoutMode = responsiveMode;
  }
  workspaceLayout.classList.toggle("is-phone-layout", phoneLayout);
  workspaceLayout.classList.toggle("is-tablet-layout", tabletLayout);
  workspaceLayout.classList.toggle("is-desktop-layout", responsiveMode === "desktop");
  workspaceLayout.classList.toggle("is-drawer-layout", drawerLayout);
  workspaceLayout.dataset.layoutMode = responsiveMode;
  document.body.dataset.layoutMode = responsiveMode;
  syncResponsiveNavigationSlots(responsiveMode);
  applySidebarMode();
  sidebarPanel?.classList.toggle("is-top-mode", sidebarMode === "top");
  sidebarPanel?.classList.toggle("is-bottom-mode", sidebarMode === "bottom");
  sidebarPanel?.classList.toggle("is-minimal-mode", sidebarMode === "minimal");
  sidebarState.collapsed = !drawerLayout && sidebarMode === "left" ? Boolean(sidebarState.collapsed) : false;
  applyPanelLayout("sidebar");
  sidebarPanel?.classList.toggle("is-hidden", drawerLayout && !sidebarVisible);
  sidebarLauncherButton?.classList.toggle("is-hidden", !drawerLayout);
  sidebarDrawerBackdrop?.classList.toggle("is-hidden", !(drawerLayout && sidebarVisible));
  const canResizeSidebar = false;
  sidebarSplitter?.classList.toggle("is-hidden", !canResizeSidebar);
  contentSplitter?.classList.toggle("is-hidden", !(canResizeContent && state.advancedMode && state.multitaskActive));
  contentSplitter?.classList.toggle("is-vertical", splitContentSideBySide);
  contentSplitter?.classList.toggle("is-horizontal", !splitContentSideBySide);
  contentSplitter?.setAttribute("aria-orientation", splitContentSideBySide ? "vertical" : "horizontal");
  dashboardSection?.classList.toggle("is-hidden", !dashboardVisible);
  reportsSection?.classList.toggle("is-hidden", !reportsVisible);
  secondaryStack?.classList.toggle("is-hidden", !secondaryVisible);
  windowWorkspace.classList.toggle("has-secondary", secondaryVisible);
  windowWorkspace.classList.toggle("is-dashboard-view", dashboardVisible);
  windowWorkspace.classList.toggle("is-reports-hidden", !reportsVisible);
  windowWorkspace.classList.toggle("is-reports-minimized", !phoneLayout && reportsState.minimized);
  windowWorkspace.classList.toggle("is-secondary-minimized", !phoneLayout && Boolean(secondaryState?.minimized));

  secondaryPanelNames.forEach((name) => {
    const panel = panelElements[name];
    const isVisible = secondaryVisible && name === secondaryName;
    panel?.classList.toggle("is-hidden", !isVisible);
  });
  updatePanelActiveState();

  if (sidebarVisible && sidebarParticipatesInSideLayout()) {
    const sidebarWidth = sidebarState.collapsed ? SIDEBAR_COLLAPSED_WIDTH : STABLE_SIDEBAR_WIDTH;
    workspaceLayout.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
    sidebarSplitter?.setAttribute("aria-valuenow", String(sidebarWidth));
  } else {
    workspaceLayout.style.removeProperty("--sidebar-width");
  }

  if (canResizeContent) {
    secondaryStack?.style.setProperty("flex-basis", `${state.layoutSizes.secondaryWidth}px`);
  } else if (secondaryStack) {
    secondaryStack.style.removeProperty("flex-basis");
  }

  if (responsiveMode !== "desktop" && state.activeLayoutResize) {
    endLayoutResize();
  }
}

function syncAllPanels(forceReset = false) {
  Object.keys(panelElements).forEach((name) => {
    if (forceReset || !state.panelState[name]) {
      const previous = state.panelState[name] || {};
      state.panelState[name] = {
        ...defaultPanelLayout(name),
        minimized: Boolean(previous.minimized),
        closed: typeof previous.closed === "boolean" ? previous.closed : defaultPanelLayout(name).closed,
        collapsed: name === "sidebar" ? Boolean(previous.collapsed) : false,
      };
    }
    applyPanelLayout(name);
  });
  syncWorkspaceLayout();
}

function openPanel(name, { unminimize = true } = {}) {
  const panel = panelElements[name];
  if (!panel) return;
  const panelState = ensurePanelState(name);
  panelState.closed = false;
  if (unminimize) {
    panelState.minimized = false;
  }
  applyPanelLayout(name);
  syncWorkspaceLayout();
}

function updatePanelActiveState() {
  Object.entries(panelElements).forEach(([name, panel]) => {
    if (!panel) return;
    const active = name === state.currentView || (state.currentView === "reports" && name === "reports");
    panel.classList.toggle("is-active-panel", active);
    if (active) {
      panel.setAttribute("aria-current", "true");
    } else {
      panel.removeAttribute("aria-current");
    }
  });
}

function focusActivePanel() {
  const panelName = isPrimaryPanel(state.currentView) ? state.currentView : currentSecondaryPanelName();
  const panel = panelElements[panelName];
  if (!panel || panel.classList.contains("is-hidden")) return;
  if (!panel.hasAttribute("tabindex")) {
    panel.setAttribute("tabindex", "-1");
  }
  window.requestAnimationFrame(() => {
    if (!panel.isConnected || panel.classList.contains("is-hidden")) return;
    panel.focus({ preventScroll: true });
  });
}

function shouldMinimizeReportsForSecondary(section) {
  if (!secondaryPanelNames.includes(section) || !isDesktopWindowLayout()) return false;
  const workspaceWidth = Math.round(windowWorkspace?.getBoundingClientRect().width || window.innerWidth);
  return workspaceWidth < (REPORTS_MIN_WIDTH + SECONDARY_MIN_WIDTH + SPLITTER_SIZE + 80);
}

function applyNavigationLayoutPolicy(section) {
  const reportsState = ensurePanelState("reports");
  if (isPrimaryPanel(section)) {
    reportsState.closed = false;
    reportsState.minimized = false;
    state.autoMinimizedReports = false;
    state.multitaskActive = false;
    secondaryPanelNames.forEach((name) => {
      const panelState = ensurePanelState(name);
      panelState.closed = true;
      panelState.minimized = false;
    });
    return;
  }
  if (!secondaryPanelNames.includes(section)) return;

  const useMultitask = state.advancedMode && (state.multitaskRequested || state.multitaskActive);
  state.multitaskActive = useMultitask;
  reportsState.closed = !useMultitask;
  if (useMultitask && shouldMinimizeReportsForSecondary(section)) {
    reportsState.minimized = true;
    state.autoMinimizedReports = true;
  } else {
    reportsState.minimized = false;
    state.autoMinimizedReports = false;
  }

  secondaryPanelNames.forEach((name) => {
    const panelState = ensurePanelState(name);
    panelState.closed = name !== section;
    panelState.minimized = false;
  });
  state.multitaskRequested = false;
}

function closePanel(name) {
  const panel = panelElements[name];
  if (!panel) return;
  if (name === "sidebar") {
    if (currentResponsiveMode() !== "desktop") {
      closeLocationDrawer();
      return;
    }
    setSidebarMode("left");
    return;
  }
  if (name === "reports" && state.currentView === "reports") {
    return;
  }
  if (secondaryPanelNames.includes(name) && state.currentView === name) {
    if (name === "report") {
      resetReportModalState();
    }
    navigateTo("dashboard");
    return;
  }
  const panelState = ensurePanelState(name);
  panelState.closed = true;
  syncWorkspaceLayout();
}

function togglePanelMinimize(name) {
  const panel = panelElements[name];
  if (!panel) return;
  const panelState = ensurePanelState(name);
  panelState.minimized = !panelState.minimized;
  if (name === "reports") {
    state.autoMinimizedReports = false;
  }
  applyPanelLayout(name);
  syncWorkspaceLayout();
}

function toggleSidebarCollapse() {
  const sidebarState = ensurePanelState("sidebar");
  sidebarState.collapsed = !sidebarState.collapsed;
  applyPanelLayout("sidebar");
  syncWorkspaceLayout();
}

function beginLayoutResize(event) {
  if (!isDesktopWindowLayout() || event.button !== 0) return;
  const resizeType = event.currentTarget.dataset.layoutResize || "";
  if (!resizeType) return;
  if (resizeType === "sidebar") return;
  state.pendingLayoutResize = null;
  if (state.layoutResizeFrame) {
    window.cancelAnimationFrame(state.layoutResizeFrame);
    state.layoutResizeFrame = 0;
  }
  state.activeLayoutResize = {
    type: resizeType,
    startX: event.clientX,
    startY: event.clientY,
    startSidebarWidth: state.layoutSizes.sidebarWidth,
    startSecondaryHeight: state.layoutSizes.secondaryHeight,
    startSecondaryWidth: state.layoutSizes.secondaryWidth,
  };
  document.body.classList.add("is-resizing-layout");
  event.preventDefault();
}

function applyLayoutResize(clientX, clientY) {
  if (!state.activeLayoutResize || !isDesktopWindowLayout()) return;
  const interaction = state.activeLayoutResize;
  if (interaction.type === "sidebar") {
    state.layoutSizes.sidebarWidth = clampValue(
      Math.round(interaction.startSidebarWidth + (clientX - interaction.startX)),
      SIDEBAR_MIN_WIDTH,
      SIDEBAR_MAX_WIDTH,
    );
  }

  if (interaction.type === "content") {
    const workspaceRect = windowWorkspace?.getBoundingClientRect();
    const availableWidth = Math.round(workspaceRect?.width || window.innerWidth);
    const maxWidth = Math.max(
      SECONDARY_MIN_WIDTH,
      availableWidth - REPORTS_MIN_WIDTH - SPLITTER_SIZE,
    );
    state.layoutSizes.secondaryWidth = clampValue(
      Math.round(interaction.startSecondaryWidth - (clientX - interaction.startX)),
      SECONDARY_MIN_WIDTH,
      Math.max(SECONDARY_MIN_WIDTH, Math.min(560, maxWidth)),
    );
  }

  syncWorkspaceLayout();
}

function updateLayoutResize(clientX, clientY) {
  if (!state.activeLayoutResize || !isDesktopWindowLayout()) return;
  state.pendingLayoutResize = { clientX, clientY };
  if (state.layoutResizeFrame) return;

  state.layoutResizeFrame = window.requestAnimationFrame(() => {
    state.layoutResizeFrame = 0;
    const pendingResize = state.pendingLayoutResize;
    state.pendingLayoutResize = null;
    if (pendingResize) {
      applyLayoutResize(pendingResize.clientX, pendingResize.clientY);
    }
  });
}

function endLayoutResize() {
  if (!state.activeLayoutResize) return;
  if (state.layoutResizeFrame) {
    window.cancelAnimationFrame(state.layoutResizeFrame);
    state.layoutResizeFrame = 0;
  }
  if (state.pendingLayoutResize) {
    applyLayoutResize(state.pendingLayoutResize.clientX, state.pendingLayoutResize.clientY);
    state.pendingLayoutResize = null;
  }
  if (state.activeLayoutResize.type === "sidebar") {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(state.layoutSizes.sidebarWidth));
  }
  state.activeLayoutResize = null;
  document.body.classList.remove("is-resizing-layout");
}

function scheduleLayoutSync() {
  if (state.layoutSyncFrame) return;
  state.layoutSyncFrame = window.requestAnimationFrame(() => {
    state.layoutSyncFrame = 0;
    applyNavigationLayoutPolicy(state.currentView);
    syncAllPanels(false);
    if (state.tutorialActive) {
      scheduleTutorialSpotlightUpdate();
    }
  });
}

function bindWindowPanelEvents() {
  Array.from(document.querySelectorAll("[data-panel-close]")).forEach((button) => {
    const panelName = button.dataset.panelClose || "";
    bindListener(button, "click", () => closePanel(panelName), {
      label: `close panel ${panelName || "unknown"}`,
    });
  });
  Array.from(document.querySelectorAll("[data-panel-minimize]")).forEach((button) => {
    const panelName = button.dataset.panelMinimize || "";
    bindListener(button, "click", () => togglePanelMinimize(panelName), {
      label: `minimize panel ${panelName || "unknown"}`,
    });
  });
  bindListener(sidebarSplitter, "pointerdown", beginLayoutResize, { label: "sidebar splitter resize" });
  bindListener(contentSplitter, "pointerdown", beginLayoutResize, { label: "content splitter resize" });
}

function logClientError(context, error, details = {}) {
  console.error(`[LostFound] ${context}`, {
    message: error?.message || String(error),
    details,
    error,
  });
}

function logClientDebug(context, details = {}) {
  if (!API_DEBUG_ENABLED) return;
  console.info(`[LostFound] ${context}`, details);
}

function logProfileImage(status, source, details = {}) {
  const normalizedStatus = status === "loaded" ? "loaded" : "failed";
  const payload = { path: source, ...details };
  if (normalizedStatus === "loaded") {
    console.info(`[PROFILE IMAGE] loaded ${source}`, payload);
    return;
  }
  console.warn(`[PROFILE IMAGE] failed ${source}`, payload);
}

function truncateForApiLog(value, limit = 1200) {
  const text = String(value || "");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...<truncated ${text.length - limit} chars>`;
}

function sanitizeForApiLog(value, key = "") {
  const loweredKey = String(key || "").toLowerCase();
  if (["authorization", "content", "data", "image", "password", "raw", "secret", "token"].includes(loweredKey)) {
    if (typeof value === "string") return `<redacted ${value.length} chars>`;
    if (value instanceof Blob) return `<redacted ${value.size} bytes>`;
    return "<redacted>";
  }

  if (value instanceof Blob) {
    return {
      name: typeof File !== "undefined" && value instanceof File ? value.name : "",
      size: value.size,
      type: value.type || "application/octet-stream",
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeForApiLog(entry, key));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, sanitizeForApiLog(childValue, childKey)]),
    );
  }

  if (typeof value === "string") {
    return truncateForApiLog(value);
  }

  return value;
}

function summarizeRequestBodyForLog(body) {
  if (!body) return null;

  if (body instanceof FormData) {
    const entries = {};
    for (const [key, value] of body.entries()) {
      entries[key] = sanitizeForApiLog(value, key);
    }
    return entries;
  }

  if (body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries());
  }

  if (body instanceof Blob) {
    return sanitizeForApiLog(body);
  }

  if (typeof body === "string") {
    try {
      return sanitizeForApiLog(JSON.parse(body));
    } catch {
      return truncateForApiLog(body);
    }
  }

  return sanitizeForApiLog(body);
}

function parseApiResponsePayload(responseText, contentType) {
  if (String(contentType || "").includes("application/json")) {
    try {
      return JSON.parse(responseText || "{}");
    } catch {
      return {};
    }
  }
  return responseText;
}

function logApiDebug(context, details = {}) {
  if (!API_DEBUG_ENABLED) return;
  console.info(`[LostFound API] ${context}`, details);
}

function currentLanguage() {
  return SUPPORTED_LANGUAGES.includes(state.language) ? state.language : "en";
}

function langText(options) {
  return options[currentLanguage()] || options.en || options["zh-CN"] || "";
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

function createLucideIcon(iconName) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = LUCIDE_ICON_PATHS[iconName] || LUCIDE_ICON_PATHS["circle-plus"];
  return svg;
}

function renderSidebarIcons() {
  const buttons = Array.from(document.querySelectorAll(".sidebar-nav-group button[data-nav-icon]"));
  buttons.forEach((button) => {
    const iconName = NAV_ICON_BY_BUTTON_ID[button.id] || button.dataset.navIcon || "";
    const labelText = (button.textContent || button.dataset.navLabel || button.getAttribute("aria-label") || "").trim();
    button.replaceChildren();

    const iconWrap = document.createElement("span");
    iconWrap.className = "sidebar-nav-icon";
    iconWrap.append(createLucideIcon(iconName));

    const label = document.createElement("span");
    label.className = "sidebar-nav-label";
    label.textContent = labelText || titleCase(button.id.replace(/^show|Button$/g, ""));

    button.dataset.navLabel = label.textContent;
    button.dataset.shortLabel = label.textContent;
    button.dataset.navIcon = iconName;
    button.append(iconWrap, label);
  });
  logIconDebug();
}

function logIconDebug() {
  const buttons = Array.from(document.querySelectorAll(".sidebar-nav-group button[data-nav-icon]"));
  const visibleCount = buttons.filter((button) => !button.classList.contains("is-hidden") && button.querySelector("svg")).length;
  console.info(
    "[ICON DEBUG]",
    "visible=",
    `${visibleCount}/${buttons.length}`,
    "route=",
    state.currentView || "",
    "language=",
    currentLanguage(),
  );
}

function renderAssistantButtonIcon() {
  if (openAssistantButton) {
    openAssistantButton.replaceChildren(createLucideIcon("message-circle"));
    openAssistantButton.setAttribute("aria-label", langText({
      en: "Open AI helper",
      "zh-CN": "打开 AI 助手",
      th: "เปิดผู้ช่วย AI",
    }));
    openAssistantButton.setAttribute("title", langText({
      en: "AI helper",
      "zh-CN": "AI 助手",
      th: "ผู้ช่วย AI",
    }));
  }
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function chatbotButtonIsRendered() {
  if (!openAssistantButton?.isConnected) return false;
  if (typeof openAssistantButton.getClientRects !== "function") return true;
  return openAssistantButton.getClientRects().length > 0;
}

function logChatbotDebug(context = "status") {
  console.info(CHATBOT_DEBUG_PREFIX, context, {
    "component mounted": yesNo(Boolean(assistantPanel?.isConnected)),
    "button rendered": yesNo(chatbotButtonIsRendered()),
    "click handler attached": yesNo(chatbotDebugState.clickHandlerAttached),
    "modal state changes": yesNo(chatbotDebugState.modalStateChanged),
  });
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage();
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
  if (typeof queryEmptyState !== "undefined" && queryEmptyState) {
    updateQueryEmptyState();
  }
  if (state.tutorialActive) {
    void syncTutorialStep();
  }
  showRoomButton.textContent = langText({ en: "Lost & Found Room", "zh-CN": "失物招领室", th: "ห้องของหายและของพบ" });
  showReturnedButton.textContent = langText({ en: "Recently Returned", "zh-CN": "最近归还", th: "เพิ่งถูกรับคืน" });
  newWindowButton?.setAttribute("title", t("nav.newWindow"));
  refreshRoomButton.textContent = langText({ en: "Refresh room", "zh-CN": "刷新招领室", th: "รีเฟรชห้องของหาย" });
  refreshReturnedButton.textContent = langText({ en: "Refresh returned", "zh-CN": "刷新归还列表", th: "รีเฟรชรายการที่รับคืน" });
  uploadRoomButton.textContent = langText({ en: "Upload to Room", "zh-CN": "上传到招领室", th: "อัปโหลดเข้าห้องของหาย" });
  if (roomPreviewHint) {
    roomPreviewHint.textContent = langText({
      en: "Draw around the item with a finger or stylus, or use the circle tool for a quick selection.",
      "zh-CN": "用手指或触控笔圈出物品，也可以使用圆形工具快速选择。",
      th: "วาดรอบสิ่งของด้วยนิ้วหรือปากกา หรือใช้เครื่องมือวงกลมเพื่อเลือกอย่างรวดเร็ว",
    });
  }
  if (roomDrawButton) roomDrawButton.textContent = langText({ en: "Draw", "zh-CN": "手绘", th: "วาด" });
  if (roomCircleToolButton) roomCircleToolButton.textContent = langText({ en: "Circle", "zh-CN": "圆形", th: "วงกลม" });
  if (roomUndoSelectionButton) roomUndoSelectionButton.textContent = t("common.undo");
  if (roomClearSelectionButton) roomClearSelectionButton.textContent = langText({ en: "Clear", "zh-CN": "清除", th: "ล้าง" });
  roomAnalyzeButton.textContent = langText({ en: "Analyze selected area", "zh-CN": "分析选中区域", th: "วิเคราะห์บริเวณที่เลือก" });
  roomConfirmButton.textContent = langText({ en: "Yes, this is my item", "zh-CN": "是的，这是我的物品", th: "ใช่ นี่คือของของฉัน" });
  roomPreviewCancelButton.textContent = t("common.cancel");
  const statEyebrow = document.querySelector(".stat-card .eyebrow");
  const statCopy = document.querySelector(".stat-card p");
  if (statEyebrow) statEyebrow.textContent = langText({ en: "Trust builder", "zh-CN": "信任指标", th: "ตัวชี้วัดความน่าเชื่อถือ" });
  if (statCopy) statCopy.textContent = langText({ en: "Items returned this week", "zh-CN": "本周归还物品", th: "สิ่งของที่ส่งคืนสัปดาห์นี้" });
  syncModeLabels();
  updateReportClaimStatusUi();
  if (state.user) {
    renderLocationScopedSurfaces();
    renderRoomItems(state.roomItems || []);
    if (state.currentView === "account") {
      renderAccount();
    }
  }
  updateLocationBar();
  renderNotifications(state.notifications);
  renderSidebarIcons();
  renderAssistantButtonIcon();
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-success", Boolean(message) && !isError);
}

function setButtonLoading(button, isLoading) {
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
}

function triggerHaptic(kind = "light", { force = false } = {}) {
  const vibrate = window.navigator?.vibrate;
  if (typeof vibrate !== "function") return;

  const now = Date.now();
  if (!force && now - state.lastHapticAt < HAPTIC_THROTTLE_MS) return;
  state.lastHapticAt = now;

  try {
    vibrate.call(window.navigator, HAPTIC_PATTERNS[kind] || HAPTIC_PATTERNS.light);
  } catch (error) {
    logClientError("haptic feedback unavailable", error, { kind });
  }
}

function hapticKindForControl(control, eventName = "click") {
  const text = [
    control?.id,
    control?.getAttribute?.("aria-label"),
    control?.getAttribute?.("title"),
    control?.textContent,
  ].filter(Boolean).join(" ").toLowerCase();

  if (eventName === "submit") return "light";
  if (eventName === "change") return "selection";
  if (/\b(close|cancel|back|skip|logout|remove)\b/.test(text)) return "close";
  if (/\b(nav|tab|reports|room|returned|query|claims|account|admin|language|select|theme)\b/.test(text)) return "selection";
  if (/\b(open|preview|claim|details|notification|tutorial)\b/.test(text)) return "open";
  if (/\b(upload|submit|send|save|confirm|approve|reject|delete|promote|demote|refresh|move|mark|start|stop)\b/.test(text)) return "light";
  return "press";
}

function bindGlobalHapticFeedback() {
  bindListener(document, "click", (event) => {
    const control = event.target?.closest?.("button, label[for], .tab-button, .card-button, .notification-item");
    if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
    triggerHaptic(hapticKindForControl(control, "click"));
  }, { label: "global click haptics", options: { capture: true, passive: true } });

  bindListener(document, "change", (event) => {
    const control = event.target?.closest?.("select, input[type='file'], input[type='checkbox'], input[type='radio']");
    if (!control || control.disabled) return;
    triggerHaptic(hapticKindForControl(control, "change"));
  }, { label: "global change haptics", options: { capture: true, passive: true } });

  bindListener(document, "submit", (event) => {
    const formElement = event.target;
    if (!(formElement instanceof HTMLFormElement)) return;
    triggerHaptic(hapticKindForControl(formElement, "submit"));
  }, { label: "global submit haptics", options: { capture: true } });
}

function setLoadingLine(element, isLoading) {
  element.classList.toggle("is-active", isLoading);
}

function setWarningCard(element, message = "") {
  element.textContent = message;
  element.classList.toggle("is-hidden", !message);
}

function activityTimestamp() {
  return new Date().toISOString();
}

function activityStatusIsComplete(status) {
  return ["success", "error", "warning"].includes(String(status || ""));
}

function activityDismissKey(sourceKey, status) {
  return `${sourceKey || ""}:${String(status || "").toLowerCase()}`;
}

function persistDismissedActivityKeys() {
  localStorage.setItem(ACTIVITY_DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(state.dismissedActivityKeys).slice(-80)));
}

function hasDismissedActivity(sourceKey, status) {
  if (!sourceKey) return false;
  return state.dismissedActivityKeys.has(activityDismissKey(sourceKey, status));
}

function rememberDismissedActivity(activity) {
  if (!activity?.sourceKey) return;
  state.dismissedActivityKeys.add(activity.dismissKey || activityDismissKey(activity.sourceKey, activity.sourceStatus || activity.status));
  persistDismissedActivityKeys();
}

function activityTitleForType(type) {
  const labels = {
    report: langText({ en: "Report", "zh-CN": "报告", th: "รายงาน" }),
    claim: langText({ en: "Claim", "zh-CN": "认领", th: "คำขอ" }),
    query: langText({ en: "Query", "zh-CN": "咨询", th: "ข้อความ" }),
    upload: langText({ en: "Upload", "zh-CN": "上传", th: "อัปโหลด" }),
    analysis: langText({ en: "AI analysis", "zh-CN": "AI 分析", th: "วิเคราะห์ AI" }),
    notification: t("notifications.title"),
  };
  return labels[type] || langText({ en: "Activity", "zh-CN": "活动", th: "กิจกรรม" });
}

function activityStatusCopy(status) {
  const value = String(status || "running");
  const labels = {
    running: langText({ en: "Running", "zh-CN": "进行中", th: "กำลังทำงาน" }),
    waiting: langText({ en: "Waiting", "zh-CN": "等待中", th: "รออยู่" }),
    success: langText({ en: "Complete", "zh-CN": "完成", th: "เสร็จสิ้น" }),
    error: langText({ en: "Needs attention", "zh-CN": "需要处理", th: "ต้องตรวจสอบ" }),
    warning: langText({ en: "Paused", "zh-CN": "已暂停", th: "หยุดชั่วคราว" }),
  };
  return labels[value] || titleCase(value);
}

function normalizeActivity(activity) {
  const now = activityTimestamp();
  const status = activity.status || "running";
  return {
    id: activity.id || `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceKey: activity.sourceKey || "",
    sourceStatus: activity.sourceStatus || status,
    dismissKey: activity.dismissKey || (activity.sourceKey ? activityDismissKey(activity.sourceKey, activity.sourceStatus || status) : ""),
    type: activity.type || "activity",
    title: activity.title || activityTitleForType(activity.type),
    stage: activity.stage || activityStatusCopy(status),
    detail: activity.detail || "",
    progress: Math.max(0, Math.min(100, Math.round(Number(activity.progress) || 0))),
    status,
    target: activity.target || "dashboard",
    itemId: activity.itemId || null,
    claimId: activity.claimId || null,
    notificationId: activity.notificationId || null,
    createdAt: activity.createdAt || now,
    updatedAt: activity.updatedAt || now,
    completedAt: activity.completedAt || (activityStatusIsComplete(status) ? now : null),
    expanded: Boolean(activity.expanded),
    history: Array.isArray(activity.history) && activity.history.length
      ? activity.history.slice(-5)
      : [{ stage: activity.stage || activityStatusCopy(status), at: now }],
  };
}

function sortedActivities() {
  return [...state.activities].sort((first, second) => {
    const firstActive = activityStatusIsComplete(first.status) ? 0 : 1;
    const secondActive = activityStatusIsComplete(second.status) ? 0 : 1;
    if (firstActive !== secondActive) return secondActive - firstActive;
    return (Date.parse(second.updatedAt || second.createdAt || "") || 0)
      - (Date.parse(first.updatedAt || first.createdAt || "") || 0);
  });
}

function pruneActivities() {
  const now = Date.now();
  const active = [];
  const completed = [];
  state.activities.forEach((activity) => {
    const completedAt = Date.parse(activity.completedAt || "");
    if (activity.completedAt && !Number.isNaN(completedAt) && now - completedAt > ACTIVITY_COMPLETED_RETENTION_MS) {
      return;
    }
    if (activityStatusIsComplete(activity.status)) {
      completed.push(activity);
    } else {
      active.push(activity);
    }
  });
  completed.sort((first, second) => (Date.parse(second.updatedAt || "") || 0) - (Date.parse(first.updatedAt || "") || 0));
  state.activities = [...active, ...completed.slice(0, Math.max(0, ACTIVITY_HISTORY_LIMIT - active.length))];
}

function persistActivities() {
  pruneActivities();
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(sortedActivities().slice(0, ACTIVITY_HISTORY_LIMIT)));
}

function findActivityBySource(sourceKey) {
  return sourceKey ? state.activities.find((activity) => activity.sourceKey === sourceKey) || null : null;
}

function findActivityById(activityId) {
  return state.activities.find((activity) => activity.id === activityId) || null;
}

function createActivity(activityInput) {
  const normalized = normalizeActivity(activityInput);
  const existing = findActivityBySource(normalized.sourceKey);
  if (existing) {
    updateActivity(existing.id, normalized);
    return existing.id;
  }
  if (hasDismissedActivity(normalized.sourceKey, normalized.sourceStatus || normalized.status)) {
    return null;
  }
  state.activities.unshift(normalized);
  state.activityCollapsed = false;
  persistActivities();
  renderActivityTracker();
  return normalized.id;
}

function updateActivity(activityId, patch = {}) {
  if (!activityId) return null;
  const activity = findActivityById(activityId);
  if (!activity) return null;
  const previousStage = activity.stage;
  const nextStatus = patch.status || activity.status || "running";
  const updatedAt = activityTimestamp();
  Object.assign(activity, {
    ...patch,
    status: nextStatus,
    progress: typeof patch.progress === "undefined"
      ? activity.progress
      : Math.max(0, Math.min(100, Math.round(Number(patch.progress) || 0))),
    updatedAt,
  });
  activity.sourceStatus = patch.sourceStatus || activity.sourceStatus || nextStatus;
  activity.dismissKey = activity.sourceKey ? activityDismissKey(activity.sourceKey, activity.sourceStatus || nextStatus) : "";
  if (patch.stage && patch.stage !== previousStage) {
    activity.history = [
      ...(Array.isArray(activity.history) ? activity.history : []),
      { stage: patch.stage, at: updatedAt },
    ].slice(-5);
  }
  if (activityStatusIsComplete(nextStatus) && !activity.completedAt) {
    activity.completedAt = updatedAt;
  }
  if (!activityStatusIsComplete(nextStatus)) {
    activity.completedAt = null;
  }
  persistActivities();
  renderActivityTracker();
  return activity;
}

function completeActivity(activityId, patch = {}) {
  return updateActivity(activityId, {
    progress: 100,
    status: "success",
    stage: progressCopy("complete"),
    ...patch,
  });
}

function failActivity(activityId, error, patch = {}) {
  const message = error?.message || String(error || "");
  return updateActivity(activityId, {
    status: "error",
    stage: langText({ en: "Action needed", "zh-CN": "需要处理", th: "ต้องตรวจสอบ" }),
    detail: message,
    ...patch,
  });
}

function clearProgressActivity(kind) {
  if (state.progressActivityIds && Object.prototype.hasOwnProperty.call(state.progressActivityIds, kind)) {
    state.progressActivityIds[kind] = null;
  }
}

function activityTargetLabel(activity) {
  if (activity.target === "query" && activity.itemId) {
    return langText({ en: "Open lookup", "zh-CN": "打开查询", th: "เปิดการค้นหา" });
  }
  if (activity.target === "claims") {
    return langText({ en: "Open claims", "zh-CN": "查看认领", th: "เปิดคำขอ" });
  }
  if (activity.target === "notifications") {
    return t("notifications.title");
  }
  if (activity.target === "room") {
    return t("nav.room");
  }
  return langText({ en: "Open", "zh-CN": "打开", th: "เปิด" });
}

function renderActivityTracker() {
  if (!activityTracker || !activityList) return;
  const activities = sortedActivities();
  const activeCount = activities.filter((activity) => !activityStatusIsComplete(activity.status)).length;
  activityTracker.classList.toggle("is-hidden", !activities.length);
  activityTracker.classList.toggle("has-active-activity", activeCount > 0);
  activityTracker.classList.toggle("is-collapsed", activities.length > 0 && state.activityCollapsed && activeCount === 0);
  activityTrackerToggle?.setAttribute("aria-expanded", activityTracker.classList.contains("is-collapsed") ? "false" : "true");
  if (activityTrackerCount) activityTrackerCount.textContent = String(activeCount || activities.length);
  if (activityTrackerSummary) {
    activityTrackerSummary.textContent = activeCount
      ? langText({
          en: `${activeCount} active task${activeCount === 1 ? "" : "s"}`,
          "zh-CN": `${activeCount} 个任务进行中`,
          th: `${activeCount} งานกำลังทำงาน`,
        })
      : langText({
          en: `${activities.length} recent item${activities.length === 1 ? "" : "s"}`,
          "zh-CN": `${activities.length} 条最近记录`,
          th: `${activities.length} รายการล่าสุด`,
        });
  }
  activityClearButton?.classList.toggle("is-hidden", !activities.some((activity) => activityStatusIsComplete(activity.status)));
  activityList.replaceChildren();
  activities.forEach((activity) => {
    const card = document.createElement("article");
    card.className = `activity-card is-${activity.status || "running"}`;
    card.dataset.activityId = activity.id;

    const top = document.createElement("button");
    top.className = "activity-card-main";
    top.type = "button";
    top.dataset.activityToggle = activity.id;

    const statusDot = document.createElement("span");
    statusDot.className = "activity-status-dot";
    statusDot.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "activity-card-copy";
    const title = document.createElement("strong");
    title.textContent = activity.title || activityTitleForType(activity.type);
    const stage = document.createElement("span");
    stage.textContent = activity.stage || activityStatusCopy(activity.status);
    copy.append(title, stage);

    const value = document.createElement("span");
    value.className = "activity-progress-value";
    value.textContent = `${Math.round(Number(activity.progress) || 0)}%`;

    top.append(statusDot, copy, value);

    const progress = document.createElement("div");
    progress.className = "activity-progress-track";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(0, Math.min(100, Number(activity.progress) || 0))}%`;
    progress.append(fill);

    card.append(top, progress);

    if (activity.expanded) {
      const details = document.createElement("div");
      details.className = "activity-card-detail";
      const detailText = document.createElement("p");
      detailText.textContent = activity.detail || activityStatusCopy(activity.status);
      const meta = document.createElement("p");
      meta.className = "activity-meta";
      meta.textContent = `${activityStatusCopy(activity.status)} • ${formatDateTime(activity.updatedAt)}`;
      details.append(detailText, meta);

      if (activity.expanded && Array.isArray(activity.history) && activity.history.length > 1) {
        const history = document.createElement("ol");
        history.className = "activity-history";
        activity.history.forEach((entry) => {
          const row = document.createElement("li");
          row.textContent = `${entry.stage} • ${formatDateTime(entry.at)}`;
          history.append(row);
        });
        details.append(history);
      }

      const actions = document.createElement("div");
      actions.className = "activity-actions";
      if (activity.target) {
        const openButton = document.createElement("button");
        openButton.className = "ghost-button small-button";
        openButton.type = "button";
        openButton.dataset.activityOpen = activity.id;
        openButton.textContent = activityTargetLabel(activity);
        actions.append(openButton);
      }
      if (activityStatusIsComplete(activity.status)) {
        const dismissButton = document.createElement("button");
        dismissButton.className = "ghost-button small-button";
        dismissButton.type = "button";
        dismissButton.dataset.activityDismiss = activity.id;
        dismissButton.textContent = langText({ en: "Dismiss", "zh-CN": "关闭", th: "ปิด" });
        actions.append(dismissButton);
      }
      if (actions.children.length) {
        details.append(actions);
      }
      card.append(details);
    }

    activityList.append(card);
  });
}

function toggleActivityTracker() {
  state.activityCollapsed = !state.activityCollapsed;
  renderActivityTracker();
}

async function openActivity(activity) {
  if (!activity) return;
  if (activity.notificationId) {
    await markNotificationRead(activity.notificationId, { reload: false });
    await loadNotifications();
  }
  if (activity.target === "query") {
    navigateTo("query", activity.itemId || null);
    return;
  }
  navigateTo(activity.target || "dashboard");
}

function handleActivityListClick(event) {
  const dismissButton = event.target?.closest?.("[data-activity-dismiss]");
  if (dismissButton) {
    dismissActivity(dismissButton.dataset.activityDismiss);
    return;
  }

  const openButton = event.target?.closest?.("[data-activity-open]");
  if (openButton) {
    void openActivity(findActivityById(openButton.dataset.activityOpen));
    return;
  }

  const toggleButton = event.target?.closest?.("[data-activity-toggle]");
  if (toggleButton) {
    const activity = findActivityById(toggleButton.dataset.activityToggle);
    if (!activity) return;
    activity.expanded = !activity.expanded;
    persistActivities();
    renderActivityTracker();
  }
}

function dismissActivity(activityId) {
  const activity = findActivityById(activityId);
  if (!activity || !activityStatusIsComplete(activity.status)) return;
  rememberDismissedActivity(activity);
  state.activities = state.activities.filter((entry) => entry.id !== activity.id);
  persistActivities();
  renderActivityTracker();
}

function dismissCompletedActivities() {
  state.activities
    .filter((activity) => activityStatusIsComplete(activity.status))
    .forEach(rememberDismissedActivity);
  state.activities = state.activities.filter((activity) => !activityStatusIsComplete(activity.status));
  persistActivities();
  renderActivityTracker();
}

function claimStatusActivityCopy(claim) {
  const status = String(claim?.status || "pending").toLowerCase();
  const itemTitle = claim?.item?.title || langText({ en: "Item", "zh-CN": "物品", th: "สิ่งของ" });
  if (status === "draft") {
    return {
      title: langText({ en: `Draft: ${claim?.title || itemTitle}`, "zh-CN": `草稿：${claim?.title || itemTitle}`, th: `แบบร่าง: ${claim?.title || itemTitle}` }),
      stage: langText({ en: "Private draft", "zh-CN": "私人草稿", th: "แบบร่างส่วนตัว" }),
      detail: langText({
        en: "Saved privately. Submit it from My Claims when ready.",
        "zh-CN": "已私人保存。准备好后可在我的认领中提交。",
        th: "บันทึกแบบส่วนตัว ส่งจากหน้าคำขอของฉันเมื่อพร้อม",
      }),
      status: "waiting",
      progress: 35,
    };
  }
  if (status === "approved") {
    const collectionLocation = localizeValue("Lost & Found Room");
    return {
      title: langText({ en: `Claim: ${itemTitle}`, "zh-CN": `认领：${itemTitle}`, th: `คำขอ: ${itemTitle}` }),
      stage: langText({ en: "Approved - Ready for pickup", "zh-CN": "已通过 - 可领取", th: "อนุมัติแล้ว - พร้อมรับคืน" }),
      detail: langText({
        en: `Approved - Collect at ${collectionLocation}.`,
        "zh-CN": `已通过 - 请到${collectionLocation}领取。`,
        th: `อนุมัติแล้ว - โปรดรับที่${collectionLocation}`,
      }),
      status: "success",
      progress: 100,
    };
  }
  if (status === "rejected") {
    return {
      title: langText({ en: `Claim: ${itemTitle}`, "zh-CN": `认领：${itemTitle}`, th: `คำขอ: ${itemTitle}` }),
      stage: langText({ en: "Rejected", "zh-CN": "已拒绝", th: "ถูกปฏิเสธ" }),
      detail: langText({
        en: "Admin reviewed the claim. Open claims for details.",
        "zh-CN": "管理员已审核这条认领。打开认领记录查看详情。",
        th: "ผู้ดูแลตรวจสอบคำขอแล้ว เปิดหน้าคำขอเพื่อดูรายละเอียด",
      }),
      status: "error",
      progress: 100,
    };
  }
  return {
    title: langText({ en: `Claim: ${itemTitle}`, "zh-CN": `认领：${itemTitle}`, th: `คำขอ: ${itemTitle}` }),
    stage: langText({ en: "Pending review", "zh-CN": "等待审核", th: "รอตรวจสอบ" }),
    detail: langText({
      en: "Awaiting admin review. You can keep using the app.",
      "zh-CN": "正在等待管理员审核。你可以继续使用应用。",
      th: "กำลังรอผู้ดูแลตรวจสอบ คุณสามารถใช้งานแอปต่อได้",
    }),
    status: "waiting",
    progress: 68,
  };
}

function syncClaimActivities(claims = state.claims) {
  claims.slice(0, 8).forEach((claim) => {
    const status = String(claim?.status || "pending").toLowerCase();
    const sourceKey = claim?.id ? `claim:${claim.id}` : "";
    const copy = claimStatusActivityCopy(claim);
    if (!sourceKey || (!findActivityBySource(sourceKey) && hasDismissedActivity(sourceKey, status))) return;
    createActivity({
      sourceKey,
      sourceStatus: status,
      dismissKey: activityDismissKey(sourceKey, status),
      type: "claim",
      title: copy.title,
      stage: copy.stage,
      detail: copy.detail,
      status: copy.status,
      progress: copy.progress,
      target: "claims",
      itemId: claim.item_id || claim.item?.id || null,
      claimId: claim.id || null,
      createdAt: claim.timestamp || activityTimestamp(),
      updatedAt: claim.updated_at || claim.timestamp || activityTimestamp(),
    });
  });
}

function notificationActivityTarget(notification) {
  const eventType = String(notification?.event_type || "").toLowerCase();
  if (notification?.related_question_id || eventType.includes("question")) return "query";
  if (notification?.related_claim_id || eventType.includes("claim")) return "claims";
  if (eventType.includes("query")) return "query";
  if (eventType.includes("room")) return "room";
  if (eventType.includes("report") || eventType.includes("match") || eventType.includes("dispute")) return "reports";
  return "notifications";
}

function syncNotificationActivities(notifications = state.notifications) {
  notifications
    .filter((notification) => !notification.read || isClaimApprovedNotification(notification))
    .slice(0, 8)
    .forEach((notification) => {
      const sourceKey = `notification:${notification.id}`;
      const eventType = String(notification.event_type || "").toLowerCase();
      const status = eventType.includes("rejected") || eventType.includes("verification") ? "error" : "success";
      if (!findActivityBySource(sourceKey) && hasDismissedActivity(sourceKey, status)) return;
      const approvedCopy = isClaimApprovedNotification(notification) ? claimApprovalCopy(notification) : null;
      createActivity({
        sourceKey,
        sourceStatus: status,
        dismissKey: activityDismissKey(sourceKey, status),
        type: "notification",
        title: approvedCopy?.eyebrow || notification.title || t("notifications.title"),
        stage: approvedCopy
          ? langText({ en: "Approved - Ready for pickup", "zh-CN": "已通过 - 可领取", th: "อนุมัติแล้ว - พร้อมรับคืน" })
          : notificationCategory(notification).label,
        detail: approvedCopy?.message || notification.message || "",
        status,
        progress: 100,
        target: notificationActivityTarget(notification),
        itemId: notification.related_item_id || null,
        claimId: notification.related_claim_id || null,
        notificationId: notification.id || null,
        createdAt: notification.created_at || activityTimestamp(),
        updatedAt: notification.created_at || activityTimestamp(),
      });
    });
}

function ensureLoginBackground() {
  const probe = new Image();
  probe.onload = () => {
    document.body.classList.remove("login-background-missing");
  };
  probe.onerror = () => {
    document.body.classList.add("login-background-missing");
  };
  probe.src = LOGIN_BACKGROUND_URL;
}

function fillSelect(select, values, includeAll = false) {
  select.replaceChildren();
  if (includeAll) {
    select.append(new Option(t("common.all"), ""));
  }
  values.forEach((value) => {
    const label = String(value || "").includes(">") ? locationPathLabel(value) : localizeValue(value);
    select.append(new Option(label, value));
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "";
  const locale = currentLanguage() === "zh-CN" ? "zh-CN" : currentLanguage() === "th" ? "th-TH" : "en-US";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / (60 * 60000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60000));

  if (diffMinutes >= 0 && diffMinutes < 1) {
    return langText({ en: "Just now", "zh-CN": "刚刚", th: "เมื่อสักครู่" });
  }
  if (diffMinutes < 60) {
    return langText({
      en: `${diffMinutes}m ago`,
      "zh-CN": `${diffMinutes} 分钟前`,
      th: `${diffMinutes} นาทีที่แล้ว`,
    });
  }
  if (diffHours < 24) {
    return langText({
      en: `${diffHours}h ago`,
      "zh-CN": `${diffHours} 小时前`,
      th: `${diffHours} ชม. ที่แล้ว`,
    });
  }
  if (diffDays === 1) {
    return langText({ en: "Yesterday", "zh-CN": "昨天", th: "เมื่อวาน" });
  }
  if (diffDays < 7) {
    return langText({
      en: `${diffDays}d ago`,
      "zh-CN": `${diffDays} 天前`,
      th: `${diffDays} วันที่แล้ว`,
    });
  }
  return target.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: target.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function emptyAdminMonitor() {
  return {
    status: "unknown",
    ollama: {
      available: false,
      host: "",
      message: "Waiting for Ollama connection test...",
      text_model: "",
      text_ready: false,
      image_model: "",
      image_ready: false,
      models: [],
    },
    uptime_seconds: null,
    fetched_at: null,
  };
}

function emptySmtpStatus() {
  return {
    configured: false,
    connected: false,
    delivery_mode: "development-log",
    host: "",
    port: 587,
    username_configured: false,
    password_configured: false,
    from_address: "",
    from_name: "",
    sender: "",
    use_tls: true,
    use_ssl: false,
    last_error: "",
    last_success_at: null,
    last_failure_at: null,
  };
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function formatMonitorStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!status || status === "unknown") {
    return langText({ en: "Unknown", "zh-CN": "未知", th: "ไม่ทราบ" });
  }
  if (currentLanguage() === "zh-CN") {
    if (status === "running") return "运行中";
    if (status === "stopped") return "已停止";
    if (status === "starting") return "启动中";
    if (status === "stopping") return "停止中";
  }
  if (currentLanguage() === "th") {
    if (status === "running") return "กำลังทำงาน";
    if (status === "stopped") return "หยุดแล้ว";
    if (status === "starting") return "กำลังเริ่ม";
    if (status === "stopping") return "กำลังหยุด";
  }
  if (currentLanguage() === "zh-CN") {
    if (status === "success") return "正常";
    if (status === "failed") return "失败";
  }
  if (currentLanguage() === "th") {
    if (status === "success") return "ปกติ";
    if (status === "failed") return "ล้มเหลว";
  }
  return titleCase(status);
}

function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function titleCase(value) {
  if (!value) return "";
  if (currentLanguage() !== "en") return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setLanguage(language) {
  const oldLanguage = currentLanguage();
  state.language = SUPPORTED_LANGUAGES.includes(language) ? language : "en";
  console.info("[LANGUAGE DEBUG]", "old_language=", oldLanguage, "new_language=", state.language);
  localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  state.queryCache.clear();
  state.queryResultCache.clear();
  languageSelect.value = state.language;
  applyTranslations();
  syncLocationBrowserState();
  updateLocationBar();
}

function tutorialState() {
  try {
    const rawValue = localStorage.getItem(TUTORIAL_STORAGE_KEY) || "{}";
    if (rawValue === "true") {
      return { completed: true };
    }
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveTutorialState(nextState) {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(nextState));
}

function invalidateSearchCache() {
  state.searchCache.clear();
}

function invalidateQueryCache(itemId = null) {
  if (itemId == null) {
    state.queryCache.clear();
    state.queryResultCache.clear();
    return;
  }
  state.queryCache.delete(itemId == null ? "general" : `item:${itemId}`);
  [...state.queryResultCache.keys()]
    .filter((key) => String(key).startsWith(`item:${itemId}:`))
    .forEach((key) => state.queryResultCache.delete(key));
}

function ensureApiBase(path = "") {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${path || ""}`;
  if (API_BASE) {
    return `${API_BASE}${normalizedPath}`;
  }

  const error = new Error("Frontend needs an API base URL. Set PUBLIC_API_BASE_URL or serve the frontend from the backend origin.");
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

  if (data.detail && typeof data.detail === "object" && typeof data.detail.message === "string" && data.detail.message.trim()) {
    return data.detail.message.trim();
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

function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

function validateChatFile(file) {
  if (!file) return "";
  const extension = fileExtension(file.name);
  if (!CHAT_ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return langText({
      en: "Question images must be PNG, JPG, or JPEG.",
      "zh-CN": "问题图片仅支持 PNG、JPG 或 JPEG。",
      th: "รูปภาพคำถามต้องเป็น PNG, JPG หรือ JPEG",
    });
  }
  if (file.size > CHAT_UPLOAD_LIMIT_BYTES) {
    return langText({
      en: "Question images must be 5 MB or smaller.",
      "zh-CN": "问题图片必须小于或等于 5 MB。",
      th: "รูปภาพคำถามต้องมีขนาดไม่เกิน 5 MB",
    });
  }
  if (file.type && !CHAT_ALLOWED_FILE_MIME_TYPES.includes(file.type)) {
    return langText({
      en: "This file's browser MIME type is not supported.",
      "zh-CN": "该文件的浏览器 MIME 类型不受支持。",
      th: "เบราว์เซอร์ระบุ MIME type ของไฟล์นี้ว่าไม่รองรับ",
    });
  }
  return "";
}

function validateReportImageFile(file) {
  if (!file) return "";
  const extension = fileExtension(file.name);
  if (!REPORT_ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
    return langText({
      en: "Images must be PNG, JPG, JPEG, WEBP, HEIC, or HEIF.",
      "zh-CN": "图片仅支持 PNG、JPG、JPEG、WEBP、HEIC 或 HEIF。",
      th: "รูปภาพต้องเป็น PNG, JPG, JPEG, WEBP, HEIC หรือ HEIF",
    });
  }
  if (file.type && !REPORT_ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return langText({
      en: "This image file's browser MIME type is not supported.",
      "zh-CN": "该图片的浏览器 MIME 类型不受支持。",
      th: "เบราว์เซอร์ระบุ MIME type ของรูปภาพนี้ว่าไม่รองรับ",
    });
  }
  return "";
}

function currentThemeMode() {
  return document.body.classList.contains("light-mode") ? "light" : "dark";
}

function syncThemeIcon(mode = currentThemeMode()) {
  if (!themeToggleButton) return;
  const toggleLabel = mode === "dark"
    ? langText({
        en: "Use light mode",
        "zh-CN": "切换到浅色模式",
        th: "เปลี่ยนเป็นโหมดสว่าง",
      })
    : langText({
        en: "Use dark mode",
        "zh-CN": "切换到深色模式",
        th: "เปลี่ยนเป็นโหมดมืด",
      });
  themeToggleButton.setAttribute("aria-label", toggleLabel);
  themeToggleButton.setAttribute("title", toggleLabel);
  themeToggleButton.dataset.mode = mode;
  themeIcon?.setAttribute("data-mode", mode);
}

function applyThemeMode(mode, { persist = true } = {}) {
  const nextMode = THEME_MODES.includes(mode) ? mode : "dark";
  document.body.classList.remove("dark-mode", "light-mode");
  document.body.classList.add(`${nextMode}-mode`);
  document.documentElement.dataset.theme = nextMode;
  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, nextMode);
  }
  syncThemeIcon(nextMode);
}

function initializeTheme() {
  localStorage.removeItem("lostfound_theme");
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme) {
    applyThemeMode(savedTheme);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyThemeMode(prefersDark ? "dark" : "light", { persist: false });
}

function toggleThemeMode() {
  const nextMode = currentThemeMode() === "dark" ? "light" : "dark";
  applyThemeMode(nextMode);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function replaceFileExtension(name, extension) {
  const basename = String(name || "upload")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
  return `${basename}${extension}`;
}

function progressCopy(key) {
  const messages = currentLanguage() === "zh-CN"
    ? {
        reportPrepare: "正在准备报告...",
        reportCompress: "正在压缩图片...",
        reportUpload: "正在上传报告...",
        reportProcess: "正在进行 LLaVA 审核与标签生成...",
        queryPrepare: "正在准备问题...",
        queryCompress: "正在压缩附件图片...",
        queryUpload: "正在上传问题...",
        queryProcess: "正在处理问题...",
        profileCompress: "正在压缩头像...",
        profileUpload: "正在上传头像...",
        profileProcess: "正在保存头像...",
        complete: "完成",
        reset: "已重置",
      }
    : currentLanguage() === "th"
      ? {
          reportPrepare: "กำลังเตรียมรายงาน...",
          reportCompress: "กำลังบีบอัดรูปภาพ...",
          reportUpload: "กำลังอัปโหลดรายงาน...",
          reportProcess: "กำลังตรวจสอบและสร้างแท็ก...",
          queryPrepare: "กำลังเตรียมข้อความ...",
          queryCompress: "กำลังบีบอัดรูปไฟล์แนบ...",
          queryUpload: "กำลังอัปโหลดข้อความ...",
          queryProcess: "กำลังประมวลผลข้อความ...",
          profileCompress: "กำลังบีบอัดรูปโปรไฟล์...",
          profileUpload: "กำลังอัปโหลดรูปโปรไฟล์...",
          profileProcess: "กำลังบันทึกรูปโปรไฟล์...",
          complete: "เสร็จสิ้น",
          reset: "รีเซ็ตแล้ว",
        }
      : {
          reportPrepare: "Preparing report...",
          reportCompress: "Compressing image...",
          reportUpload: "Uploading report...",
          reportProcess: "Running LLaVA moderation and tagging...",
          queryPrepare: "Preparing question...",
          queryCompress: "Compressing attachment image...",
          queryUpload: "Uploading question...",
          queryProcess: "Processing your question...",
          profileCompress: "Compressing profile image...",
          profileUpload: "Uploading profile image...",
          profileProcess: "Saving profile image...",
          complete: "Complete",
          reset: "Reset",
        };
  return messages[key] || messages.reportPrepare;
}

function clearProgressTimer(kind) {
  if (state.progressTimers[kind]) {
    window.clearInterval(state.progressTimers[kind]);
    state.progressTimers[kind] = null;
  }
}

function setProgress(kind, value, label = "", visible = true) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const activityId = state.progressActivityIds?.[kind] || null;
  if (activityId && visible) {
    updateActivity(activityId, {
      progress: percent,
      stage: label || activityStatusCopy("running"),
      status: percent >= 100 ? "success" : "running",
    });
  }

  const handle = progressHandles[kind];
  if (!handle) return;

  handle.root.classList.toggle("is-hidden", !visible);
  handle.root.dataset.progress = String(percent);
  handle.fill.style.width = `${percent}%`;
  handle.value.textContent = `${percent}%`;
  if (label) {
    handle.label.textContent = label;
  }
}

function hideProgress(kind) {
  clearProgressTimer(kind);
  const handle = progressHandles[kind];
  if (!handle) return;
  handle.root.classList.add("is-hidden");
}

function startProcessingProgress(kind, label, start = 60, end = 90) {
  clearProgressTimer(kind);
  setProgress(kind, start, label, true);
  state.progressTimers[kind] = window.setInterval(() => {
    const handle = progressHandles[kind];
    const current = Number(handle?.root?.dataset.progress || start);
    if (current >= end) {
      clearProgressTimer(kind);
      return;
    }
    setProgress(kind, Math.min(end, current + 2), label, true);
  }, 220);
}

async function completeProgress(kind) {
  clearProgressTimer(kind);
  setProgress(kind, 100, progressCopy("complete"), true);
  await sleep(360);
  hideProgress(kind);
}

function resetProgress(kind) {
  clearProgressTimer(kind);
  setProgress(kind, 0, progressCopy("reset"), true);
}

function updateUploadProgress(kind, event, label) {
  if (!event.lengthComputable || !event.total) {
    setProgress(kind, 40, label, true);
    return;
  }
  const percent = 20 + Math.round((event.loaded / event.total) * 40);
  setProgress(kind, percent, label, true);
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the selected image."));
    image.src = dataUrl;
  });
}

async function compressImageFile(file) {
  if (!file) {
    return file;
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(dataUrl);
  const longestSide = Math.max(image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1);
  const scale = Math.min(1, REPORT_IMAGE_MAX_DIMENSION / longestSide);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the selected image.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }
        reject(new Error("Could not compress the selected image."));
      },
      "image/jpeg",
      REPORT_IMAGE_JPEG_QUALITY,
    );
  });

  if (!blob.size) {
    throw new Error("Compressed image was empty.");
  }

  const compressedFile = new File([blob], replaceFileExtension(file.name, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  return compressedFile;
}

async function prepareUploadFile(file, kind, labels) {
  if (!file) {
    setProgress(kind, 20, labels.prepare, true);
    return null;
  }

  const validationMessage = validateReportImageFile(file);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  if (REPORT_ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension(file.name))) {
    setProgress(kind, 10, labels.compress, true);
    let compressedFile = file;
    try {
      compressedFile = await compressImageFile(file);
    } catch (error) {
      if (!SERVER_SIDE_IMAGE_CONVERSION_EXTENSIONS.includes(fileExtension(file.name))) {
        throw error;
      }
    }
    if (!compressedFile.size) {
      throw new Error("Prepared image file was empty.");
    }
    setProgress(kind, 20, labels.compress, true);
    return compressedFile;
  }

  setProgress(kind, 20, labels.prepare, true);
  return file;
}

function apiRequestWithProgress(path, { method = "GET", headers = {}, body = null, onUploadProgress = null, onUploadComplete = null } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const requestMethod = String(method || "GET").toUpperCase();
    const requestUrl = ensureApiBase(path);
    logApiDebug("request", {
      method: requestMethod,
      url: requestUrl,
      payload: summarizeRequestBodyForLog(body),
    });
    xhr.open(requestMethod, requestUrl);
    xhr.responseType = "text";
    xhr.timeout = 60000;

    Object.entries({ ...headers, ...authHeaders() }).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        xhr.setRequestHeader(key, value);
      }
    });

    if (typeof onUploadProgress === "function") {
      xhr.upload.addEventListener("progress", onUploadProgress);
    }
    if (typeof onUploadComplete === "function") {
      xhr.upload.addEventListener("load", onUploadComplete, { once: true });
    }

    xhr.onload = () => {
      const contentType = xhr.getResponseHeader("content-type") || "";
      const payload = parseApiResponsePayload(xhr.responseText || "", contentType);
      logApiDebug("response", {
        method: requestMethod,
        url: xhr.responseURL || requestUrl,
        status: xhr.status,
        body: sanitizeForApiLog(payload),
      });

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(extractApiMessage(payload, "Request failed.")));
    };

    xhr.onerror = () => {
      logApiDebug("network error", { method: requestMethod, url: requestUrl });
      reject(new Error(`Could not reach backend at ${API_BASE || "the configured API origin"}.`));
    };
    xhr.ontimeout = () => {
      logApiDebug("timeout", { method: requestMethod, url: requestUrl });
      reject(new Error("Request timed out."));
    };
    xhr.send(body);
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
  state.accountEmailChangeEmail = "";
  state.accountEmailChangeSentAt = 0;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function authVerificationPurpose() {
  return "register";
}

function authEmailValue() {
  return String(authEmail?.value || "").trim().toLowerCase();
}

function authEmailLooksValid(email = authEmailValue()) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function emailVerificationMatchesCurrentForm() {
  return Boolean(
    state.emailVerificationToken
    && state.emailVerificationEmail === authEmailValue()
    && state.emailVerificationPurpose === authVerificationPurpose(),
  );
}

function resetEmailVerificationState({ keepMessage = false } = {}) {
  state.emailVerificationToken = "";
  state.emailVerificationEmail = "";
  state.emailVerificationPurpose = "";
  state.emailVerificationSentAt = 0;
  state.emailVerificationExpiresAt = 0;
  if (authVerificationCode) authVerificationCode.value = "";
  if (!keepMessage) {
    setMessage(authVerificationMeta, "");
  }
  syncEmailVerificationUi();
}

function syncEmailVerificationUi() {
  const purpose = authVerificationPurpose();
  const email = authEmailValue();
  const isVerified = emailVerificationMatchesCurrentForm();
  const emailIsValid = authEmailLooksValid(email);
  const isRegister = state.authView === "register";
  if (authEmail) {
    authEmail.required = true;
  }
  authVerificationPanel?.classList.toggle("is-hidden", !isRegister);
  authVerificationPanel?.classList.toggle("is-verified", isVerified);
  if (authVerificationStatus) {
    authVerificationStatus.textContent = isVerified ? t("auth.emailVerified") : t("auth.emailUnverified");
  }
  if (authSendCodeButton) {
    authSendCodeButton.disabled = !isRegister || !emailIsValid;
    authSendCodeButton.textContent = state.emailVerificationSentAt ? t("auth.resendCode") : t("auth.sendCode");
  }
  if (authVerifyCodeButton) {
    authVerifyCodeButton.disabled = !isRegister || !emailIsValid || String(authVerificationCode?.value || "").replace(/\D/g, "").length !== EMAIL_VERIFICATION_CODE_LENGTH;
  }
  if (authSubmitButton && isRegister) {
    authSubmitButton.disabled = !isVerified;
  } else if (authSubmitButton) {
    authSubmitButton.disabled = false;
  }
  authVerificationPanel?.setAttribute("data-purpose", purpose);
}

async function requestEmailVerificationCode() {
  if (state.authView !== "register") return;
  const email = authEmailValue();
  if (!authEmailLooksValid(email)) {
    setMessage(authVerificationMeta, langText({
      en: "Enter a valid email first.",
      "zh-CN": "请先输入有效邮箱。",
      th: "กรุณาใส่อีเมลที่ถูกต้องก่อน",
    }), true);
    return;
  }

  setButtonLoading(authSendCodeButton, true);
  setMessage(authVerificationMeta, langText({ en: "Sending code...", "zh-CN": "正在发送验证码...", th: "กำลังส่งรหัส..." }));
  try {
    const data = await apiFetch("/auth/email/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose: authVerificationPurpose() }),
    });
    state.emailVerificationToken = "";
    state.emailVerificationEmail = "";
    state.emailVerificationPurpose = "";
    state.emailVerificationSentAt = Date.now();
    state.emailVerificationExpiresAt = Date.now() + (Number(data.expires_in || 0) * 1000);
    setMessage(authVerificationMeta, data.delivery === "development-log"
      ? (data.message || "Email delivery is not configured. Verification codes are currently being written to the development security log.")
      : langText({
          en: "Code sent. Check your email and enter the 6 digits.",
          "zh-CN": "验证码已发送。请查看邮箱并输入 6 位数字。",
          th: "ส่งรหัสแล้ว โปรดตรวจอีเมลและใส่ตัวเลข 6 หลัก",
        }),
      data.delivery === "development-log");
    authVerificationCode?.focus();
  } catch (error) {
    setMessage(authVerificationMeta, error.message, true);
    logClientError("email verification request failed", error, { purpose: authVerificationPurpose() });
  } finally {
    setButtonLoading(authSendCodeButton, false);
    syncEmailVerificationUi();
  }
}

async function verifyEmailCode() {
  if (state.authView !== "register") return;
  const email = authEmailValue();
  const code = String(authVerificationCode?.value || "").replace(/\D/g, "");
  if (!authEmailLooksValid(email) || code.length !== EMAIL_VERIFICATION_CODE_LENGTH) {
    setMessage(authVerificationMeta, langText({
      en: "Enter the email and 6-digit code.",
      "zh-CN": "请输入邮箱和 6 位验证码。",
      th: "กรุณาใส่อีเมลและรหัส 6 หลัก",
    }), true);
    return;
  }

  setButtonLoading(authVerifyCodeButton, true);
  setMessage(authVerificationMeta, langText({ en: "Checking code...", "zh-CN": "正在验证...", th: "กำลังตรวจรหัส..." }));
  try {
    const purpose = authVerificationPurpose();
    const data = await apiFetch("/auth/email/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, purpose }),
    });
    state.emailVerificationToken = data.verification_token || "";
    state.emailVerificationEmail = email;
    state.emailVerificationPurpose = purpose;
    setMessage(authVerificationMeta, langText({
      en: "Email verified.",
      "zh-CN": "邮箱已验证。",
      th: "ยืนยันอีเมลแล้ว",
    }));
    triggerHaptic("success");
  } catch (error) {
    state.emailVerificationToken = "";
    setMessage(authVerificationMeta, error.message, true);
    logClientError("email verification failed", error, { purpose: authVerificationPurpose() });
  } finally {
    setButtonLoading(authVerifyCodeButton, false);
    syncEmailVerificationUi();
  }
}

function ensureLoginBubbles() {
  if (!loginBubbleSystem || loginBubbleSystem.children.length) return;
  for (let index = 0; index < LOGIN_BUBBLE_COUNT; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = `login-bubble login-bubble-${index + 1}`;
    if (index < 4) {
      bubble.classList.add("has-report-slot");
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      bubble.append(image);
    }
    if (index < 3) {
      const small = document.createElement("span");
      small.className = "login-bubble-emitter";
      bubble.append(small);
    }
    loginBubbleSystem.append(bubble);
  }
}

function updateLoginBubbleImages() {
  if (!loginBubbleSystem || !state.loginBubbleItems.length) return;
  const slots = Array.from(loginBubbleSystem.querySelectorAll(".has-report-slot img"));
  slots.forEach((image, index) => {
    const item = state.loginBubbleItems[(state.loginBubbleIndex + index) % state.loginBubbleItems.length];
    const imageUrl = normalizeImageUrl(item?.image_url || "");
    if (!imageUrl || image.getAttribute("src") === imageUrl) return;
    image.src = imageUrl;
    image.title = item?.title || "";
    image.parentElement?.classList.add("has-report-image");
  });
  state.loginBubbleIndex = (state.loginBubbleIndex + 1) % state.loginBubbleItems.length;
}

async function loadLoginBubbleImages() {
  ensureLoginBubbles();
  if (!loginBubbleSystem) return;
  try {
    const data = await apiFetch("/auth/login-images");
    state.loginBubbleItems = Array.isArray(data.items) ? data.items.filter((item) => item?.image_url).slice(0, 5) : [];
    updateLoginBubbleImages();
    if (state.loginBubbleTimer) {
      window.clearInterval(state.loginBubbleTimer);
    }
    if (state.loginBubbleItems.length > 1) {
      state.loginBubbleTimer = window.setInterval(updateLoginBubbleImages, 5200);
    }
  } catch (error) {
    logClientError("loading login bubble images failed", error);
  }
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
  closeTutorial({ markSeen: false, rememberSession: false });
  document.body.classList.add("auth-route");
  authScreen?.classList.remove("is-hidden");
  appShell?.classList.add("is-hidden");
  loginLoadingScreen?.classList.add("is-hidden");
  document.body.classList.remove("login-loading-route");
}

function showAppShell() {
  document.body.classList.remove("auth-route");
  document.body.classList.remove("login-loading-route");
  authScreen?.classList.add("is-hidden");
  loginLoadingScreen?.classList.add("is-hidden");
  appShell?.classList.remove("is-hidden");
  syncModeUi();
  window.requestAnimationFrame(() => {
    syncAllPanels(Object.keys(state.panelState).length === 0);
    openPanel("sidebar");
    logChatbotDebug("after-login-mount");
  });
}

function hideLoginLoadingVideo() {
  if (loginLoadingVideo) {
    loginLoadingVideo.pause();
    loginLoadingVideo.removeAttribute("src");
    loginLoadingVideo.load();
  }
  loginLoadingScreen?.classList.add("is-fading");
  window.setTimeout(() => {
    loginLoadingScreen?.classList.add("is-hidden");
    loginLoadingScreen?.classList.remove("is-active", "is-fading");
    document.body.classList.remove("login-loading-route");
  }, 260);
}

function playLoginLoadingVideo() {
  if (!loginLoadingScreen || !loginLoadingVideo) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (played) => {
      if (settled) return;
      settled = true;
      loginLoadingVideo.removeEventListener("ended", onEnded);
      loginLoadingVideo.removeEventListener("error", onError);
      window.clearTimeout(timeoutId);
      resolve(Boolean(played));
    };
    const onEnded = () => finish(true);
    const onError = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(false), LOGIN_LOADING_FALLBACK_MS);

    document.body.classList.add("login-loading-route");
    authScreen?.classList.add("is-hidden");
    appShell?.classList.add("is-hidden");
    loginLoadingScreen.classList.remove("is-hidden", "is-fading");
    loginLoadingScreen.classList.add("is-active");

    loginLoadingVideo.src = state.loadingVideoUrl || LOGIN_LOADING_VIDEO_URL;
    loginLoadingVideo.currentTime = 0;
    loginLoadingVideo.muted = true;
    loginLoadingVideo.playsInline = true;
    loginLoadingVideo.addEventListener("ended", onEnded, { once: true });
    loginLoadingVideo.addEventListener("error", onError, { once: true });

    const playPromise = loginLoadingVideo.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => finish(false));
    }
  });
}

function closeDialogWithAnimation(dialog, afterClose) {
  if (!dialog) return;
  if (!dialog.open) {
    if (typeof afterClose === "function") afterClose();
    return;
  }

  triggerHaptic("close");
  dialog.classList.add("is-closing");
  const closeToken = `${Date.now()}-${Math.random()}`;
  dialog.dataset.closeToken = closeToken;
  window.setTimeout(() => {
    if (dialog.dataset.closeToken !== closeToken) return;
    delete dialog.dataset.closeToken;
    dialog.classList.remove("is-closing");
    if (dialog.open) {
      dialog.close();
    }
    if (typeof afterClose === "function") afterClose();
  }, MODAL_CLOSE_ANIMATION_MS);
}

function resetReportModalState() {
  state.activeReportFormContext = false;
  stopReportCamera();
  reportDialog?.classList.remove("is-map-report-context");
  clearReportMapLocationMarker();
  form?.reset();
  if (claimRequiredInput) claimRequiredInput.checked = true;
  if (noClaimRequiredInput) noClaimRequiredInput.checked = false;
  state.selectedFile = null;
  dropZone?.classList.remove("is-dragging");
  if (dropTitle) {
    dropTitle.textContent = t("report.dropTitle");
  }
  if (dropHint) {
    dropHint.textContent = t("report.dropHint");
  }
  if (dateInput) {
    dateInput.value = todayIso();
  }
  prefillReporter();
  updateLocationUi();
  updateReportClaimStatusUi();
  updateReportSubmitState();
  if (state.progressActivityIds?.report) {
    reportProgress?.classList.add("is-hidden");
  } else {
    hideProgress("report");
  }
  setMessage(uploadMessage, "");
  setWarningCard(reportWarningCard, "");
  renderSchoolMap();
}

function reportClaimRequiredValue() {
  return noClaimRequiredInput?.checked ? false : true;
}

function claimRequirementLabel(claimRequired = true) {
  return claimRequired
    ? langText({ en: "Claim Required", "zh-CN": "需要认领", th: "ต้องยื่นคำขอ" })
    : langText({ en: "Direct Collection Allowed", "zh-CN": "允许直接领取", th: "รับได้โดยตรง" });
}

function directCollectionMessage(item = {}) {
  return langText({
    en: `"${item.title || "This item"}" can be collected directly. Please visit the Lost & Found Room or follow the listed location guidance.`,
    "zh-CN": `“${item.title || "这件物品"}”允许直接领取。请前往失物招领室或按报告中的地点说明领取。`,
    th: `"${item.title || "สิ่งของนี้"}" สามารถรับได้โดยตรง โปรดไปที่ห้องของหายหรือทำตามสถานที่ที่ระบุไว้`,
  });
}

function updateReportClaimStatusUi() {
  if (reportClaimStatusLabel) {
    reportClaimStatusLabel.textContent = claimRequirementLabel(reportClaimRequiredValue());
  }
}

function prepareReportPage({ reset = false } = {}) {
  if (reset || !state.activeReportFormContext) {
    resetReportModalState();
  }
  state.activeReportFormContext = true;
  reportDialog?.classList.remove("is-map-report-context");
  setWarningCard(reportWarningCard, "");
  assignReportLocationFromSelection();
  updateReportClaimStatusUi();
  updateReportSubmitState();
  window.setTimeout(() => {
    titleInput?.focus();
  }, 0);
}

function openReportModal() {
  if (!currentUserCanCreateContent()) {
    setWarningCard(queryWarningCard, langText({
      en: "Student accounts can search, browse, and send information through query or claim flows.",
      "zh-CN": "学生账号可以搜索、浏览，并通过查询或认领流程发送信息。",
      th: "บัญชีนักเรียนสามารถค้นหา เรียกดู และส่งข้อมูลผ่านขั้นตอนการสอบถามหรือคำขอรับคืน",
    }));
    navigateTo("query");
    return;
  }
  navigateTo("report");
  triggerHaptic("open");
}

function closeReportModal({ navigate = true } = {}) {
  if (navigate && state.currentView === "report") {
    resetReportModalState();
    goBackToPreviousRoute("dashboard");
    return;
  }
  resetReportModalState();
}

function setPasswordFieldVisibility(input, toggle, visible) {
  if (!input) return;
  const isVisible = Boolean(visible);
  input.type = isVisible ? "text" : "password";
  if (toggle) {
    toggle.classList.toggle("is-visible", isVisible);
    const labelKey = isVisible ? "auth.hidePassword" : "auth.showPassword";
    toggle.setAttribute("aria-label", t(labelKey));
    toggle.setAttribute("title", t(labelKey));
  }
}

function setAuthPasswordVisibility(visible) {
  setPasswordFieldVisibility(authPassword, authPasswordToggle, visible);
}

function setAuthConfirmPasswordVisibility(visible) {
  setPasswordFieldVisibility(authConfirmPassword, authConfirmPasswordToggle, visible);
}

function setAuthView(view) {
  state.authView = view;
  resetEmailVerificationState({ keepMessage: true });
  authSubmitLabel.textContent = t(view === "login" ? "auth.login" : "auth.register");
  loginTab.classList.toggle("is-active", view === "login");
  registerTab.classList.toggle("is-active", view === "register");
  authUsernameField?.classList.add("is-hidden");
  if (authUsername) {
    authUsername.required = false;
    authUsername.disabled = true;
    authUsername.value = "";
  }
  registerFields.classList.add("is-hidden");
  authPassword.setAttribute("autocomplete", view === "login" ? "current-password" : "new-password");
  if (authConfirmPassword) {
    authConfirmPassword.required = false;
    authConfirmPassword.disabled = true;
    authConfirmPassword.value = "";
  }
  if (authInitials) authInitials.disabled = true;
  if (authClassOf) authClassOf.disabled = true;
  setAuthPasswordVisibility(false);
  setAuthConfirmPasswordVisibility(false);
  syncEmailVerificationUi();
}

function currentUserCanAdmin() {
  return Boolean(state.user?.is_admin);
}

function currentUserRole() {
  const role = String(state.user?.role || "").trim().toLowerCase();
  if (role === "student" || role === "teacher") return role;
  return currentUserCanAdmin() ? "teacher" : "teacher";
}

function currentUserIsStudent() {
  return currentUserRole() === "student" && !currentUserCanAdmin();
}

function currentUserCanCreateContent() {
  return currentUserCanAdmin() || currentUserRole() === "teacher";
}

function currentUserCanManageItem(item) {
  return currentUserCanAdmin()
    || (currentUserCanCreateContent() && Number(item?.submitted_by_user_id) === Number(state.user?.id));
}

function defaultSectionForCurrentUser() {
  return "dashboard";
}

function tutorialSteps() {
  const steps = [
    {
      section: "dashboard",
      selector: "#dashboardSection",
      title: langText({ en: "Start at Dashboard", "zh-CN": "从仪表盘开始", th: "เริ่มที่แดชบอร์ด" }),
      body: langText({ en: "This is your home base for recent reports, returned items, personal activity, and quick actions.", "zh-CN": "这里集中显示最近报告、归还物品、个人活动和快捷入口。", th: "นี่คือหน้าแรกสำหรับรายงานล่าสุด สิ่งของที่รับคืน กิจกรรมของคุณ และปุ่มลัด" }),
    },
    {
      section: "map",
      selector: "#mapSection",
      title: langText({ en: "Open the School Map", "zh-CN": "打开校园地图", th: "เปิดแผนที่โรงเรียน" }),
      body: langText({ en: "This opens the school map. Browse campus locations, floors, and location-filtered reports here.", "zh-CN": "这里可以打开校园地图，浏览地点、楼层，并按地点筛选报告。", th: "ใช้แผนที่โรงเรียนเพื่อดูสถานที่ ชั้น และรายงานตามตำแหน่ง" }),
    },
    {
      section: "query",
      selector: "#queryForm",
      title: langText({ en: "Ask a Query", "zh-CN": "提交查询", th: "ถามคำถาม" }),
      body: langText({ en: "Use Query when you want to ask about a lost item or search with a photo.", "zh-CN": "如果想询问遗失物品或用照片搜索，请使用查询。", th: "ใช้ Query เมื่อต้องการถามเกี่ยวกับของหายหรือค้นหาด้วยรูปภาพ" }),
    },
    {
      section: "reports",
      selector: "#searchInput",
      title: langText({ en: "Search Reports", "zh-CN": "搜索报告", th: "ค้นหารายงาน" }),
      body: langText({ en: "Click here to search reports by item, description, category, or location.", "zh-CN": "点击这里按物品、描述、分类或地点搜索报告。", th: "คลิกที่นี่เพื่อค้นหารายงานตามสิ่งของ รายละเอียด หมวดหมู่ หรือสถานที่" }),
    },
    {
      section: "returned",
      selector: "#returnedSection",
      title: langText({ en: "Recently Returned", "zh-CN": "最近归还", th: "เพิ่งถูกรับคืน" }),
      body: langText({ en: "This is where returned items appear. It stays available without crowding the main student flow.", "zh-CN": "已归还物品会显示在这里。它仍可访问，但不会占据学生主流程。", th: "สิ่งของที่รับคืนแล้วจะแสดงที่นี่ โดยยังเข้าถึงได้แต่ไม่รบกวนขั้นตอนหลักของนักเรียน" }),
    },
    {
      section: "account",
      selector: "#accountSection",
      title: langText({ en: "Profile", "zh-CN": "个人资料", th: "โปรไฟล์" }),
      body: langText({ en: "Profile keeps your account details, language, and school identity in one place.", "zh-CN": "个人资料集中管理账号信息、语言和校园身份。", th: "โปรไฟล์รวมข้อมูลบัญชี ภาษา และตัวตนในโรงเรียนไว้ที่เดียว" }),
    },
  ];

  if (!currentUserIsStudent()) {
    steps.push({
      section: "reports",
      selector: "#openReportModalButton",
      title: t("tutorial.reportsTitle"),
      body: t("tutorial.reportsBody"),
    });
  }

  if (state.advancedMode && currentUserCanAdmin()) {
    steps.push({
      section: "admin",
      selector: "#adminSection .admin-tab-switch",
      title: t("tutorial.adminTitle"),
      body: t("tutorial.adminBody"),
      requiresInteraction: true,
      onEnter: async () => {
        switchAdminTab("monitor");
        await loadAdminMonitor();
      },
    });
  }

  return steps;
}

function clearTutorialHighlight() {
  if (typeof state.tutorialCleanup === "function") {
    state.tutorialCleanup();
  }
  state.tutorialCleanup = null;
  tutorialActiveTarget = null;
  if (tutorialSpotlightFrame) {
    window.cancelAnimationFrame(tutorialSpotlightFrame);
    tutorialSpotlightFrame = 0;
  }
  document.querySelectorAll(".tutorial-highlight").forEach((element) => {
    element.classList.remove("tutorial-highlight");
    element.classList.remove("tutorial-target-active");
  });
  tutorialSpotlight.classList.add("is-hidden");
  tutorialSpotlight.style.removeProperty("top");
  tutorialSpotlight.style.removeProperty("left");
  tutorialSpotlight.style.removeProperty("width");
  tutorialSpotlight.style.removeProperty("height");
  if (tutorialCard) {
    tutorialCard.style.removeProperty("top");
    tutorialCard.style.removeProperty("left");
    tutorialCard.style.removeProperty("transform");
    tutorialCard.style.removeProperty("max-height");
  }
  tutorialBackdropPanes.forEach((pane) => {
    pane.style.removeProperty("top");
    pane.style.removeProperty("left");
    pane.style.removeProperty("width");
    pane.style.removeProperty("height");
  });
}

function resolveTutorialTarget(step) {
  if (!step?.selector) return null;
  const selector = typeof step.selector === "function" ? step.selector() : step.selector;
  return typeof selector === "string" ? document.querySelector(selector) : selector;
}

function tutorialViewportRect(target) {
  const rect = target.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const top = clamp(rect.top, 0, viewportHeight);
  const left = clamp(rect.left, 0, viewportWidth);
  const width = Math.max(0, Math.min(rect.width, viewportWidth - left));
  const height = Math.max(0, Math.min(rect.height, viewportHeight - top));
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function clamp(value, min, max) {
  if (max <= min) return min;
  return Math.min(Math.max(value, min), max);
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function tutorialPreferredPlacement(rect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const verticalCenter = rect.top + (rect.height / 2);
  const horizontalCenter = rect.left + (rect.width / 2);

  if (verticalCenter <= viewportHeight * 0.33) return "below";
  if (verticalCenter >= viewportHeight * 0.67) return "above";
  if (horizontalCenter <= viewportWidth * 0.4) return "right";
  if (horizontalCenter >= viewportWidth * 0.6) return "left";

  const spaces = {
    below: viewportHeight - rect.bottom,
    above: rect.top,
    right: viewportWidth - rect.right,
    left: rect.left,
  };

  return Object.entries(spaces)
    .sort(([, first], [, second]) => second - first)[0]?.[0] || "below";
}

function buildTutorialCardPlacement(side, targetRect, cardWidth, cardHeight, viewportWidth, viewportHeight, padding, margin) {
  const minCardHeight = 180;
  let left = padding;
  let top = padding;
  let availableHeight = viewportHeight - (padding * 2);

  if (side === "below") {
    availableHeight = viewportHeight - targetRect.bottom - margin - padding;
    if (availableHeight < minCardHeight) return null;
    top = targetRect.bottom + margin;
    left = clamp(
      targetRect.left + (targetRect.width / 2) - (cardWidth / 2),
      padding,
      viewportWidth - padding - cardWidth,
    );
  } else if (side === "above") {
    availableHeight = targetRect.top - margin - padding;
    if (availableHeight < minCardHeight) return null;
    top = targetRect.top - margin - Math.min(cardHeight, availableHeight);
    left = clamp(
      targetRect.left + (targetRect.width / 2) - (cardWidth / 2),
      padding,
      viewportWidth - padding - cardWidth,
    );
  } else if (side === "right") {
    if ((viewportWidth - targetRect.right - margin - padding) < cardWidth) return null;
    left = targetRect.right + margin;
    top = clamp(
      targetRect.top + (targetRect.height / 2) - (cardHeight / 2),
      padding,
      viewportHeight - padding - Math.min(cardHeight, availableHeight),
    );
  } else {
    if ((targetRect.left - margin - padding) < cardWidth) return null;
    left = targetRect.left - margin - cardWidth;
    top = clamp(
      targetRect.top + (targetRect.height / 2) - (cardHeight / 2),
      padding,
      viewportHeight - padding - Math.min(cardHeight, availableHeight),
    );
  }

  const height = Math.min(cardHeight, Math.max(minCardHeight, availableHeight));
  const rect = {
    top,
    left,
    right: left + cardWidth,
    bottom: top + height,
  };

  if (rect.top < padding || rect.left < padding || rect.right > viewportWidth - padding || rect.bottom > viewportHeight - padding) {
    return null;
  }
  if (rectsOverlap(rect, targetRect)) {
    return null;
  }
  if (side === "below" && rect.top < targetRect.bottom + margin) return null;
  if (side === "above" && rect.bottom > targetRect.top - margin) return null;
  if (side === "right" && rect.left < targetRect.right + margin) return null;
  if (side === "left" && rect.right > targetRect.left - margin) return null;

  return {
    top,
    left,
    maxHeight: height,
  };
}

function positionTutorialCard(targetRect) {
  if (!tutorialCard) return;

  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const currentRect = tutorialCard.getBoundingClientRect();
  const padding = Math.max(10, Math.min(TUTORIAL_VIEWPORT_PADDING, Math.floor(viewportWidth * 0.03)));
  const cardWidth = Math.min(currentRect.width || 360, viewportWidth - (padding * 2));
  const cardHeight = Math.min(currentRect.height || 240, viewportHeight - (padding * 2));
  const preferredSide = tutorialPreferredPlacement(targetRect);
  const placements = [preferredSide, "right", "below", "left", "above"]
    .filter((side, index, values) => values.indexOf(side) === index);

  for (const side of placements) {
    const placement = buildTutorialCardPlacement(
      side,
      targetRect,
      cardWidth,
      cardHeight,
      viewportWidth,
      viewportHeight,
      padding,
      TUTORIAL_CARD_MARGIN,
    );
    if (!placement) continue;
    tutorialCard.style.top = `${placement.top}px`;
    tutorialCard.style.left = `${placement.left}px`;
    tutorialCard.style.transform = "none";
    tutorialCard.style.maxHeight = `${placement.maxHeight}px`;
    return;
  }

  const fallbackCandidates = [
    {
      top: padding,
      left: clamp(targetRect.left, padding, viewportWidth - padding - cardWidth),
    },
    {
      top: viewportHeight - padding - cardHeight,
      left: clamp(targetRect.left, padding, viewportWidth - padding - cardWidth),
    },
    {
      top: clamp(targetRect.bottom + TUTORIAL_CARD_MARGIN, padding, viewportHeight - padding - cardHeight),
      left: clamp(targetRect.left + (targetRect.width / 2) - (cardWidth / 2), padding, viewportWidth - padding - cardWidth),
    },
    {
      top: clamp(targetRect.top - TUTORIAL_CARD_MARGIN - cardHeight, padding, viewportHeight - padding - cardHeight),
      left: clamp(targetRect.left + (targetRect.width / 2) - (cardWidth / 2), padding, viewportWidth - padding - cardWidth),
    },
  ];
  const fallback = fallbackCandidates.find((candidate) => !rectsOverlap({
    top: candidate.top,
    left: candidate.left,
    right: candidate.left + cardWidth,
    bottom: candidate.top + cardHeight,
  }, targetRect)) || fallbackCandidates.sort((first, second) => {
    const firstDistance = Math.abs((first.top + (cardHeight / 2)) - (targetRect.top + (targetRect.height / 2)));
    const secondDistance = Math.abs((second.top + (cardHeight / 2)) - (targetRect.top + (targetRect.height / 2)));
    return secondDistance - firstDistance;
  })[0];
  const fallbackTop = clamp(fallback.top, padding, viewportHeight - padding - cardHeight);
  const fallbackLeft = clamp(fallback.left, padding, viewportWidth - padding - cardWidth);

  tutorialCard.style.top = `${fallbackTop}px`;
  tutorialCard.style.left = `${fallbackLeft}px`;
  tutorialCard.style.transform = "none";
  tutorialCard.style.maxHeight = `${Math.max(180, viewportHeight - fallbackTop - padding)}px`;
}

function positionTutorialBackdrop(rect) {
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const top = Math.max(0, Math.min(rect.top, viewportHeight));
  const left = Math.max(0, Math.min(rect.left, viewportWidth));
  const width = Math.max(0, Math.min(rect.width, viewportWidth - left));
  const height = Math.max(0, Math.min(rect.height, viewportHeight - top));
  const bottom = Math.max(0, viewportHeight - (top + height));
  const right = Math.max(0, viewportWidth - (left + width));
  const [topPane, leftPane, rightPane, bottomPane] = tutorialBackdropPanes;

  if (!topPane || !leftPane || !rightPane || !bottomPane) return;

  topPane.style.top = "0px";
  topPane.style.left = "0px";
  topPane.style.width = `${viewportWidth}px`;
  topPane.style.height = `${top}px`;

  leftPane.style.top = `${top}px`;
  leftPane.style.left = "0px";
  leftPane.style.width = `${left}px`;
  leftPane.style.height = `${height}px`;

  rightPane.style.top = `${top}px`;
  rightPane.style.left = `${left + width}px`;
  rightPane.style.width = `${right}px`;
  rightPane.style.height = `${height}px`;

  bottomPane.style.top = `${top + height}px`;
  bottomPane.style.left = "0px";
  bottomPane.style.width = `${viewportWidth}px`;
  bottomPane.style.height = `${bottom}px`;
}

function updateTutorialSpotlight(target = tutorialActiveTarget) {
  if (!target || !target.isConnected) {
    return;
  }

  const rect = tutorialViewportRect(target);
  tutorialSpotlight.style.top = `${rect.top}px`;
  tutorialSpotlight.style.left = `${rect.left}px`;
  tutorialSpotlight.style.width = `${rect.width}px`;
  tutorialSpotlight.style.height = `${rect.height}px`;
  tutorialSpotlight.classList.remove("is-hidden");
  positionTutorialBackdrop(rect);
  positionTutorialCard(rect);
}

function scheduleTutorialSpotlightUpdate() {
  if (!state.tutorialActive || !tutorialActiveTarget) return;
  if (tutorialSpotlightFrame) return;
  tutorialSpotlightFrame = window.requestAnimationFrame(() => {
    tutorialSpotlightFrame = 0;
    updateTutorialSpotlight();
  });
}

async function waitForTutorialTarget(step, attempts = 12) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const target = resolveTutorialTarget(step);
    if (target instanceof HTMLElement && target.isConnected) {
      return target;
    }
    await sleep(80);
  }
  return null;
}

function shouldShowTutorial() {
  const savedState = tutorialState();
  return Boolean(
    state.user
    && !state.tutorialDismissedForSession
    && !savedState.completed
    && !savedState.skipped,
  );
}

async function syncTutorialStep() {
  const steps = tutorialSteps();
  if (!state.tutorialActive || !steps.length) return;

  const stepIndex = Math.max(0, Math.min(state.tutorialStepIndex, steps.length - 1));
  const step = steps[stepIndex];
  state.tutorialStepIndex = stepIndex;

  tutorialStepLabel.textContent = t("tutorial.stepOf", { current: stepIndex + 1, total: steps.length });
  tutorialTitle.textContent = step.title;
  tutorialBody.textContent = step.body;
  tutorialDontShowAgainLabel.textContent = t("tutorial.dontShowAgain");
  tutorialSkipButton.textContent = t("tutorial.skip");
  tutorialBackButton.textContent = t("tutorial.back");
  tutorialBackButton.disabled = stepIndex === 0;
  tutorialNextLabel.textContent = stepIndex === steps.length - 1 ? t("tutorial.finish") : t("tutorial.next");
  state.tutorialInteractionSatisfied = !step.requiresInteraction;
  tutorialNextButton.disabled = !state.tutorialInteractionSatisfied;

  if (state.currentView !== step.section) {
    await activateRoute({ section: step.section, itemId: null });
  }
  if (typeof step.onEnter === "function") {
    await step.onEnter();
  }

  clearTutorialHighlight();
  const target = await waitForTutorialTarget(step);
  if (target) {
    tutorialActiveTarget = target;
    target.classList.add("tutorial-highlight");
    target.classList.add("tutorial-target-active");
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    await sleep(240);
    window.requestAnimationFrame(() => updateTutorialSpotlight(target));
    if (step.requiresInteraction) {
      const handleInteraction = () => {
        state.tutorialInteractionSatisfied = true;
        tutorialNextButton.disabled = false;
      };
      target.addEventListener("click", handleInteraction, true);
      target.addEventListener("focusin", handleInteraction, true);
      state.tutorialCleanup = () => {
        target.removeEventListener("click", handleInteraction, true);
        target.removeEventListener("focusin", handleInteraction, true);
      };
    }
  }
}

async function openTutorial() {
  state.tutorialActive = true;
  state.tutorialStepIndex = 0;
  tutorialDontShowAgain.checked = false;
  tutorialOverlay.classList.remove("is-hidden");
  tutorialOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("tutorial-open");
  triggerHaptic("open");
  await syncTutorialStep();
}

function closeTutorial({ markSeen = false, rememberSession = true } = {}) {
  const wasActive = state.tutorialActive;
  const shouldSkipTutorial = tutorialDontShowAgain.checked;
  state.tutorialActive = false;
  state.tutorialStepIndex = 0;
  tutorialOverlay.classList.add("is-hidden");
  tutorialOverlay.setAttribute("aria-hidden", "true");
  tutorialDontShowAgain.checked = false;
  document.body.classList.remove("tutorial-open");
  clearTutorialHighlight();
  if (wasActive) {
    triggerHaptic("close");
  }

  if (rememberSession) {
    state.tutorialDismissedForSession = true;
  }
  if (markSeen) {
    saveTutorialState({ completed: true, skipped: false, savedAt: new Date().toISOString() });
  } else if (shouldSkipTutorial) {
    saveTutorialState({ completed: false, skipped: true, savedAt: new Date().toISOString() });
  }
}

function showFinderEasterEgg() {
  if (state.mascotUnlocked) return;
  state.mascotUnlocked = true;
  const badge = document.createElement("div");
  badge.className = "easter-egg-badge";
  badge.textContent = "Finder mode unlocked";
  document.body.append(badge);
  window.setTimeout(() => {
    badge.classList.add("is-leaving");
    window.setTimeout(() => badge.remove(), 420);
  }, 2200);
}

async function maybeStartTutorial() {
  if (!shouldShowTutorial()) return;
  state.tutorialDismissedForSession = false;
  await openTutorial();
}

async function advanceTutorial() {
  const steps = tutorialSteps();
  if (!state.tutorialActive || !steps.length) return;
  if (!state.tutorialInteractionSatisfied) return;

  if (state.tutorialStepIndex >= steps.length - 1) {
    closeTutorial({ markSeen: true });
    return;
  }

  state.tutorialStepIndex += 1;
  triggerHaptic("selection");
  await syncTutorialStep();
}

async function rewindTutorial() {
  if (!state.tutorialActive || state.tutorialStepIndex <= 0) return;
  state.tutorialStepIndex -= 1;
  triggerHaptic("selection");
  await syncTutorialStep();
}

function canPreviewImage(path) {
  return typeof path === "string" && /^(https?:|data:|blob:)/.test(path);
}

function normalizeImageUrl(path) {
  if (typeof path !== "string") return "";
  const source = path.trim();
  if (!source || /\b(?:undefined|null)\b/i.test(source)) return "";
  if (/^(data:|blob:)/.test(source)) return source;

  if (/^https?:/i.test(source)) {
    try {
      const url = new URL(source);
      url.pathname = url.pathname.replace(/\/{2,}/g, "/");
      if (/\b(?:undefined|null)\b/i.test(url.pathname)) return "";
      return url.toString();
    } catch (error) {
      logClientDebug("invalid image URL", { source, message: error?.message || String(error) });
      return "";
    }
  }

  const [withoutHash, hash = ""] = source.replace(/\\/g, "/").split("#", 2);
  const [rawPath, query = ""] = withoutHash.split("?", 2);
  const normalizedPath = rawPath.replace(/\/{2,}/g, "/");
  const suffix = `${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
  if (normalizedPath.startsWith("uploads/")) return `${API_BASE}/${normalizedPath}${suffix}`;
  if (normalizedPath.startsWith("/")) return `${API_BASE}${normalizedPath}${suffix}`;
  return "";
}

function cacheBustImageUrl(source, version = Date.now()) {
  if (!source || /^(data:|blob:)/.test(source)) return source || "";
  const versionValue = String(version || Date.now());
  try {
    const url = new URL(source, window.location.href);
    url.searchParams.delete("ts");
    url.searchParams.delete("v");
    url.searchParams.set("v", versionValue);
    return url.toString();
  } catch (error) {
    const [base, hash = ""] = source.split("#");
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}v=${encodeURIComponent(versionValue)}${hash ? `#${hash}` : ""}`;
  }
}

function isUploadImageUrl(source) {
  if (!source || /^(data:|blob:)/.test(source)) return false;
  try {
    const url = new URL(source, window.location.href);
    return url.pathname.startsWith("/uploads/");
  } catch {
    return String(source).startsWith("/uploads/");
  }
}

function normalizeAvatarUrl(source, version = state.avatarVersion || Date.now()) {
  const normalizedSource = normalizeImageUrl(source);
  if (!normalizedSource) return "";
  if (!isUploadImageUrl(normalizedSource)) return normalizedSource;
  return cacheBustImageUrl(normalizedSource, version);
}

function probeImageUrl(source, timeoutMs = 5000) {
  const normalizedSource = normalizeAvatarUrl(source);
  if (!canPreviewImage(normalizedSource)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const probe = new Image();
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    probe.onload = () => finish(true);
    probe.onerror = () => finish(false);
    probe.src = normalizedSource;
  });
}

function resolveImageUrl(item) {
  return normalizeImageUrl(item?.image_url || item?.image_path);
}

function isPreviewableAttachment(attachment) {
  const type = String(attachment?.content_type || "").toLowerCase();
  const name = String(attachment?.name || attachment?.url || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|webp|gif)(?:$|\?)/i.test(name);
}

function openImagePreview(source, title = "Image preview", caption = "") {
  if (!imagePreviewDialog || !canPreviewImage(source)) return;
  imagePreviewTitle.textContent = title || "Image preview";
  imagePreviewCaption.textContent = caption || title || "Preview image";
  imagePreviewImage.src = source;
  imagePreviewImage.alt = title || "Preview image";
  if (imagePreviewDialog.open) return;
  imagePreviewDialog.classList.remove("is-closing");
  delete imagePreviewDialog.dataset.closeToken;
  imagePreviewDialog.showModal();
  triggerHaptic("open");
}

function closeImagePreview() {
  if (!imagePreviewDialog?.open) return;
  closeDialogWithAnimation(imagePreviewDialog, () => {
    imagePreviewImage.removeAttribute("src");
  });
}

function findKnownItemById(itemId) {
  const numericId = Number(itemId || 0);
  if (!numericId) return null;
  const pools = [state.adminItems, state.items, state.roomItems, state.returnedItems];
  for (const collection of pools) {
    const match = collection.find((item) => Number(item.id) === numericId);
    if (match) return match;
  }
  return null;
}

function previewPayloadForRecord(record, fallbackTitle = "Preview image") {
  if (!record || typeof record !== "object") return null;

  const directSources = [
    record,
    record.after_state,
    record.before_state,
    record.metadata,
    record.request_metadata,
  ];

  for (const candidate of directSources) {
    const source = normalizeImageUrl(candidate?.image_url || candidate?.image_path || candidate?.avatar_url || "");
    if (canPreviewImage(source)) {
      return {
        src: source,
        title: candidate?.title || record.title || fallbackTitle,
        caption: candidate?.description || record.reason || "",
      };
    }
  }

  const relatedItemIds = [
    record.item_id,
    record.related_item_id,
    record.entity_type === "item" ? record.entity_id : null,
    record.metadata?.item_id,
    record.request_metadata?.item_id,
    record.after_state?.id,
    record.before_state?.id,
  ];

  for (const itemId of relatedItemIds) {
    const match = findKnownItemById(itemId);
    const source = resolveImageUrl(match);
    if (canPreviewImage(source)) {
      return {
        src: source,
        title: match?.title || fallbackTitle,
        caption: match?.description || "",
      };
    }
  }

  return null;
}

function createThumbnailButton(source, { title = "Preview image", caption = "" } = {}) {
  if (!canPreviewImage(source)) return null;
  const button = document.createElement("button");
  button.className = "panel-thumbnail-button";
  button.type = "button";
  button.setAttribute("aria-label", title);
  const image = document.createElement("img");
  image.className = "panel-thumbnail";
  image.src = source;
  image.alt = title;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => button.remove(), { once: true });
  button.append(image);
  button.addEventListener("click", () => openImagePreview(source, title, caption));
  return button;
}

function analysisText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function analysisList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  return uniqueValues(source.map(analysisText).filter(Boolean)).slice(0, 8);
}

function isPlainAnalysisObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function fullAnalysisSource(analysis) {
  if (isPlainAnalysisObject(analysis?.full_json_response)) return analysis.full_json_response;
  if (isPlainAnalysisObject(analysis?.parsed_json)) return analysis.parsed_json;
  if (isPlainAnalysisObject(analysis?.llava_response_json)) return analysis.llava_response_json;
  return isPlainAnalysisObject(analysis) ? analysis : {};
}

function formatAnalysisDetailValue(value, maxLength = 160) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return uniqueValues(value.map((entry) => formatAnalysisDetailValue(entry, 80)).filter(Boolean)).slice(0, 6).join(", ");
  }
  if (isPlainAnalysisObject(value)) {
    return Object.entries(value)
      .filter(([key]) => !["raw", "output_text", "prompt_text"].includes(String(key).toLowerCase()))
      .map(([key, entry]) => {
        const formatted = formatAnalysisDetailValue(entry, 80);
        return formatted ? `${analysisText(key).replace(/_/g, " ")}: ${formatted}` : "";
      })
      .filter(Boolean)
      .slice(0, 4)
      .join("; ");
  }
  const text = analysisText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function analysisValueForKeys(analysis, source, keys) {
  for (const key of keys) {
    const formatted = formatAnalysisDetailValue(source?.[key]);
    if (formatted) return formatted;
  }
  for (const key of keys) {
    const formatted = formatAnalysisDetailValue(analysis?.[key]);
    if (formatted) return formatted;
  }
  return "";
}

function createAiAnalysisDetails(item) {
  const analysis = item?.llava_analysis || {};
  const source = fullAnalysisSource(analysis);
  const entries = [
    ["Object", ["object_type", "item_classification", "item_subtype", "object"]],
    ["Colours", ["colours", "colors", "color"]],
    ["Materials", ["materials", "material"]],
    ["Brand/text", ["brand", "visible_text", "text"]],
    ["Markings", ["notable_markings", "markings", "distinguishing_features", "distinctive_features"]],
    ["Condition", ["condition", "shape", "size_estimate"]],
    ["Scene", ["scene_context", "location_context", "background"]],
    ["Category", ["possible_category", "category"]],
    ["Tags", ["tags"]],
  ]
    .map(([label, keys]) => [label, analysisValueForKeys(analysis, source, keys)])
    .filter(([, value]) => value);

  if (!entries.length) return null;

  const details = document.createElement("dl");
  details.className = "ai-analysis-details";
  entries.slice(0, 8).forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "ai-analysis-detail";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    row.append(term, description);
    details.append(row);
  });
  return details;
}

function analysisConfidenceValue(item) {
  const analysis = item?.llava_analysis || {};
  const raw = analysis.confidence_score ?? analysis.confidence ?? item?.image?.confidence_score;
  if (raw === null || raw === undefined || raw === "") return 0;
  const numeric = Number(String(raw).replace("%", "").trim());
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric <= 1 && numeric > 0 ? numeric * 100 : numeric)));
}

function aiAnalysisStatus(item) {
  return analysisText(item?.ai_analysis_status || item?.llava_analysis?.ai_analysis_status || "success").toLowerCase() || "success";
}

function aiAnalysisSummary(item) {
  const analysis = item?.llava_analysis || {};
  const status = aiAnalysisStatus(item);
  const source = state.previewUrls.get(item?.id) || resolveImageUrl(item);
  const hasImageAnalysis = Boolean(analysis.llava_attempted || analysis.llava_called || canPreviewImage(source));
  const direct = analysisText(
    analysis.item_description
    || analysis.object_description
    || (!hasImageAnalysis ? item?.ai_summary : ""),
  );
  if (direct) return direct;

  const objectType = analysisText(analysis.object_type || analysis.item_classification);
  const colours = analysisList(analysis.colours || analysis.colors);
  const markings = analysisList(analysis.notable_markings || analysis.markings);
  if (objectType) {
    const prefix = colours.length ? `${colours.join(", ")} ${objectType}` : objectType;
    return markings.length ? `${prefix} with ${markings.join(", ")}` : prefix;
  }

  if (status === "fallback") return "LLaVA unavailable; keyword tags were used.";
  if (status === "failed") return "Image analysis failed.";
  if (!hasImageAnalysis) {
    const tags = analysisList(analysis.tags || item?.tags);
    if (tags.length) return tags.slice(0, 4).join(", ");
  }
  return "";
}

function createAiAnalysisBlock(item, { heading = "AI Analysis", includeStatus = true } = {}) {
  const source = state.previewUrls.get(item?.id) || resolveImageUrl(item);
  if (!canPreviewImage(source)) return null;

  const summary = aiAnalysisSummary(item);
  const confidence = analysisConfidenceValue(item);
  const status = aiAnalysisStatus(item);
  const block = document.createElement("div");
  block.className = "ai-analysis-block";
  if (status !== "success") block.classList.add(`is-${status}`);

  const title = document.createElement("span");
  title.className = "ai-analysis-heading";
  title.textContent = heading;

  const summaryLine = document.createElement("p");
  summaryLine.className = "ai-analysis-summary";
  summaryLine.textContent = summary || "Analysis pending.";

  const meta = document.createElement("div");
  meta.className = "ai-analysis-meta";
  const confidenceLine = document.createElement("span");
  confidenceLine.textContent = `Confidence: ${confidence ? `${confidence}%` : "Not provided"}`;
  meta.append(confidenceLine);
  if (includeStatus) {
    const statusLine = document.createElement("span");
    statusLine.textContent = `Status: ${status}`;
    meta.append(statusLine);
  }

  block.append(title, summaryLine, meta);
  const details = createAiAnalysisDetails(item);
  if (details) {
    block.append(details);
  }
  return block;
}

function createAttachmentPreview(attachment) {
  const source = normalizeImageUrl(attachment?.url || "");
  return isPreviewableAttachment(attachment) ? createThumbnailButton(source, {
    title: attachment?.name || "Attachment preview",
    caption: attachment?.name || "",
  }) : null;
}

function applyFreshUser(user, version = Date.now()) {
  state.avatarVersion = Number(version || Date.now()) || Date.now();
  if (!user?.avatar_url) return user;
  return {
    ...user,
    avatar_url: normalizeAvatarUrl(user.avatar_url, state.avatarVersion),
  };
}

function renderCurrentAccountChip() {
  if (!state.user) return;
  applyAvatar(accountChipAvatar, accountAvatarSource(), userAvatarLabel(state.user));
  applyAvatar(topbarAccountAvatar, accountAvatarSource(), userAvatarLabel(state.user));
  accountName.textContent = userDisplayName(state.user);
  if (topbarAccountName) {
    topbarAccountName.textContent = userDisplayName(state.user);
  }
  accountMeta.textContent = currentUserCanAdmin()
    ? langText({ en: "Admin access", "zh-CN": "管理员权限", th: "สิทธิ์ผู้ดูแล" })
    : currentUserIsStudent()
      ? langText({ en: "Student mode", "zh-CN": "学生模式", th: "โหมดนักเรียน" })
      : langText({ en: "Teacher mode", "zh-CN": "教师模式", th: "โหมดครู" });
}

function revokeProfilePreviewUrl() {
  if (!state.profilePreviewUrl) return;
  URL.revokeObjectURL(state.profilePreviewUrl);
  state.profilePreviewUrl = "";
}

function accountAvatarSource() {
  return state.profilePreviewUrl || state.user?.avatar_url || "";
}

function selectProfileImage(file) {
  revokeProfilePreviewUrl();

  if (!file) {
    setMessage(profileImageMessage, "");
    renderAccount();
    return;
  }

  const validationMessage = validateReportImageFile(file);
  if (validationMessage) {
    if (profileImageInput) profileImageInput.value = "";
    setMessage(profileImageMessage, validationMessage, true);
    renderAccount();
    return;
  }

  state.profilePreviewUrl = URL.createObjectURL(file);
  applyAvatar(accountAvatar, state.profilePreviewUrl, userAvatarLabel(state.user));
  applyAvatar(accountChipAvatar, state.profilePreviewUrl, userAvatarLabel(state.user));
  applyAvatar(topbarAccountAvatar, state.profilePreviewUrl, userAvatarLabel(state.user));
  setMessage(profileImageMessage, langText({
    en: `Preview ready: ${file.name} (${formatFileSize(file.size)}).`,
    "zh-CN": `预览已就绪：${file.name}（${formatFileSize(file.size)}）。`,
    th: `แสดงตัวอย่างแล้ว: ${file.name} (${formatFileSize(file.size)})`,
  }));
}

function markImageUnavailable(container, image, fallback) {
  container?.classList.remove("has-image");
  if (container) container.style.cursor = "";
  image?.removeAttribute("src");
  fallback?.classList.remove("is-hidden");
}

function renderQueryContextImage(item) {
  if (!queryItemImageButton || !queryItemImage || !queryItemImageFallback) return;
  const source = item ? (state.previewUrls.get(item.id) || resolveImageUrl(item)) : "";
  queryItemImageButton.disabled = !canPreviewImage(source);
  queryItemImageButton.onclick = null;
  if (!canPreviewImage(source)) {
    queryItemImageFallback.textContent = item ? "No image" : "General";
    markImageUnavailable(queryItemImageButton, queryItemImage, queryItemImageFallback);
    return;
  }

  queryItemImageFallback.classList.add("is-hidden");
  queryItemImageButton.classList.add("has-image");
  queryItemImage.loading = "lazy";
  queryItemImage.decoding = "async";
  queryItemImage.alt = item.title || "Query item";
  queryItemImage.onerror = () => markImageUnavailable(queryItemImageButton, queryItemImage, queryItemImageFallback);
  queryItemImage.src = source;
  queryItemImageButton.onclick = () => openImagePreview(source, item.title || "Query item", item.description || "");
}

function syncQueryAdminActions() {
  const visible = currentUserCanAdmin() && Boolean(state.currentQueryItem?.id);
  queryAdminActions?.classList.toggle("is-hidden", !visible);
  if (queryClearThreadButton) {
    queryClearThreadButton.disabled = !visible;
  }
}

function queryThreadKey(itemId) {
  return itemId ? `item:${itemId}` : "general";
}

function invalidateQueryThread(itemId) {
  state.queryCache.delete(queryThreadKey(itemId));
}

function relatedItemForNotification(notification) {
  return findKnownItemById(notification?.related_item_id);
}

function appendNotificationPreview(notification, itemElement) {
  const item = relatedItemForNotification(notification);
  const source = resolveImageUrl(item);
  const thumbnail = createThumbnailButton(source, {
    title: item?.title || notification.title || "Notification image",
    caption: item?.description || notification.message || "",
  });
  if (thumbnail) {
    thumbnail.classList.add("notification-preview");
    itemElement.append(thumbnail);
  }
}

function createDetailsToggle(detailRegion) {
  const button = document.createElement("button");
  button.className = "ghost-button small-button log-detail-toggle";
  button.type = "button";
  const setLabel = () => {
    button.textContent = detailRegion.classList.contains("is-hidden")
      ? langText({ en: "Details", "zh-CN": "详情", th: "รายละเอียด" })
      : langText({ en: "Hide details", "zh-CN": "收起详情", th: "ซ่อนรายละเอียด" });
  };
  setLabel();
  button.addEventListener("click", () => {
    detailRegion.classList.toggle("is-hidden");
    setLabel();
  });
  return button;
}

function manualLocationCodeCandidate(value = "") {
  const parts = locationPathParts(value);
  const leaf = String(parts[parts.length - 1] || value || "").trim();
  const compactLeaf = leaf.toUpperCase().replace(/[\s-]+/g, "");
  if (/^[ASP][1-5]\d{2}$/.test(compactLeaf)) return compactLeaf;
  const embeddedCode = String(value || "").toUpperCase().match(/\b([ASP])\s*([1-5]\d{2})\b/);
  return embeddedCode ? `${embeddedCode[1]}${embeddedCode[2]}` : compactLeaf;
}

function activeSchoolLocations() {
  return Array.isArray(state?.locations) && state.locations.length ? state.locations : SCHOOL_LOCATIONS;
}

function locationAliasEntries() {
  return activeSchoolLocations()
    .flatMap((location) => uniqueValues([
      location.name,
      location.label,
      ...(LOCATION_PART_ALIASES[location.name] || []),
      ...(LOCATION_PART_ALIASES[location.label] || []),
    ]).map((alias) => ({
      location,
      alias: normalizeLocationText(alias),
    })))
    .filter((entry) => entry.location?.id && entry.alias);
}

function locationByExactLabel(value = "") {
  const normalized = normalizeLocationText(value);
  if (!normalized) return null;
  return locationAliasEntries().find((entry) => entry.alias === normalized)?.location || null;
}

function locationContextIdFromInput(value = "") {
  const source = normalizeLocationText(value);
  if (!source) return "";
  const entries = locationAliasEntries()
    .slice()
    .sort((left, right) => right.alias.length - left.alias.length);
  return entries.find((entry) => source === entry.alias || source.includes(entry.alias))?.location?.id || "";
}

function manualLocationRulesForPrefix(prefix, floorNumber) {
  return MANUAL_LOCATION_CODE_RULES.filter((rule) => (
    rule.prefix === prefix
      && floorNumber >= rule.minFloor
      && floorNumber <= rule.maxFloor
  ));
}

function manualLocationRuleForInput(prefix, value = "", floorNumber = 0) {
  const rules = manualLocationRulesForPrefix(prefix, floorNumber);
  if (!rules.length) return null;
  const contextLocationId = locationContextIdFromInput(value);
  if (contextLocationId) {
    return rules.find((rule) => rule.locationId === contextLocationId) || null;
  }
  return rules[0] || null;
}

function parseManualLocationCode(value = "") {
  const code = manualLocationCodeCandidate(value);
  const match = code.match(/^([ASP])([1-5]\d{2})$/);
  if (!match) return null;
  const [, prefix, roomNumber] = match;
  const floorNumber = Number(roomNumber[0]);
  const rule = manualLocationRuleForInput(prefix, value, floorNumber);
  if (!rule || !Number.isInteger(floorNumber) || floorNumber < rule.minFloor || floorNumber > rule.maxFloor) return null;
  return { code, prefix, roomNumber, floorNumber, rule };
}

function manualLocationCodeValidationMessage(value = "") {
  const candidate = manualLocationCodeCandidate(value);
  if (!candidate) return "";
  if (parseManualLocationCode(value)) return "";
  const looksLikeLocationCode = /^[ASP]\d*$/i.test(candidate) || /\b[ASP]\s*\d+\b/i.test(String(value || ""));
  return looksLikeLocationCode ? INVALID_LOCATION_CODE_MESSAGE : "";
}

function manualLocationFromInput(value = "") {
  const parsed = parseManualLocationCode(value);
  if (!parsed) return null;
  const location = schoolLocationById(parsed.rule.locationId);
  const floor = floorForLabel(location, floorLabelForNumber(parsed.floorNumber));
  if (!location || !floor) return null;
  const floorPath = locationFloorPath(location, floor);
  return {
    code: parsed.code,
    location,
    floor,
    floorNumber: parsed.floorNumber,
    roomNumber: parsed.roomNumber,
    value: parsed.code,
    meta: floorPath,
    label: `${floorPath} > Room ${parsed.code}`,
    mapLabel: floorPath,
  };
}

function normalizeRoomCode(value) {
  return manualLocationCodeCandidate(value);
}

function roomCodeToLabel(roomCode) {
  const manualLocation = manualLocationFromInput(roomCode);
  if (manualLocation) return manualLocation.label;
  const code = normalizeRoomCode(roomCode);
  const building = buildings[code[0]];
  return building ? `${building} - Room ${code}` : code;
}

function validateRoomCode(value) {
  return Boolean(manualLocationFromInput(value));
}

function subLocationMatchesLabel(subLocation, label = "") {
  const normalized = normalizeLocationText(label);
  if (!normalized) return false;
  return locationAliasesForPart(subLocation?.label || "").includes(normalized)
    || normalizeLocationText(subLocation?.id || "") === normalized;
}

function knownSubLocationMatches(label = "") {
  const normalized = normalizeLocationText(label);
  if (!normalized) return [];
  return activeSchoolLocations().flatMap((location) => (
    directSubLocationsForLocation(location)
      .filter((subLocation) => subLocationMatchesLabel(subLocation, normalized))
      .map((subLocation) => ({ location, subLocation }))
  ));
}

function knownLocationFromInput(value = "") {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const parts = locationPathParts(rawValue);
  const location = parts.length ? locationByExactLabel(parts[0]) : locationByExactLabel(rawValue);
  if (location) {
    if (parts.length <= 1) {
      return {
        valid: true,
        value: location.name,
        meta: location.name,
        label: location.name,
        location,
      };
    }

    const floor = floorForLabel(location, parts[1]);
    if (floor) {
      if (parts.length === 2) {
        return {
          valid: true,
          value: floor.label,
          meta: location.name,
          label: locationFloorPath(location, floor),
          location,
          floor,
          floorNumber: floorNumberForFloor(floor),
        };
      }
      const manualLocation = manualLocationFromInput(rawValue);
      if (
        manualLocation
          && manualLocation.location.id === location.id
          && manualLocation.floor.id === floor.id
      ) {
        return manualLocation;
      }
      const subLocation = subLocationForLabel(floor.subLocations || [], parts[2]);
      if (subLocation && parts.length === 3) {
        return {
          valid: true,
          value: subLocation.label,
          meta: locationFloorPath(location, floor),
          label: locationSubLocationPath(location, subLocation, floor),
          location,
          floor,
          floorNumber: floorNumberForFloor(floor),
          subLocation,
        };
      }
      return null;
    }

    const subLocation = directSubLocationsForLocation(location)
      .find((candidate) => subLocationMatchesLabel(candidate, parts[1]));
    if (subLocation && parts.length === 2) {
      return {
        valid: true,
        value: subLocation.label,
        meta: location.name,
        label: locationSubLocationPath(location, subLocation),
        location,
        subLocation,
      };
    }
    return null;
  }

  const subLocationMatches = knownSubLocationMatches(rawValue);
  if (subLocationMatches.length === 1) {
    const { location: parentLocation, subLocation } = subLocationMatches[0];
    return {
      valid: true,
      value: subLocation.label,
      meta: parentLocation.name,
      label: locationSubLocationPath(parentLocation, subLocation),
      location: parentLocation,
      subLocation,
    };
  }
  return null;
}

function currentLocation() {
  const value = String(optionalLocationInput?.value || "").trim();
  const manualLocation = manualLocationFromInput(value);
  if (manualLocation) {
    return {
      valid: true,
      value: manualLocation.value,
      meta: manualLocation.meta,
      label: manualLocation.label,
      code: manualLocation.code,
    };
  }
  const manualLocationError = manualLocationCodeValidationMessage(value);
  if (manualLocationError) {
    return {
      valid: false,
      value: value || "Unknown",
      meta: "invalid-location-code",
      message: manualLocationError,
    };
  }
  const structured = structuredLocationFromSelection();
  if (structured && (!value || optionalLocationInput?.dataset?.mapLocation === structured.label)) {
    return {
      valid: true,
      value: structured.value,
      meta: structured.meta,
    };
  }
  const knownLocation = knownLocationFromInput(value);
  if (knownLocation) {
    return {
      valid: true,
      value: knownLocation.value,
      meta: knownLocation.meta,
      label: knownLocation.label,
      code: knownLocation.code || "",
    };
  }
  const activeRegion = selectedMapRegion();
  const activeZone = selectedMapZone();
  if (!value && activeRegion) {
    return {
      valid: true,
      value: activeRegion.label,
      meta: activeRegion.zone,
    };
  }
  if (!value && activeZone) {
    return {
      valid: true,
      value: activeZone,
      meta: activeZone,
    };
  }
  return {
    valid: false,
    value: value || "",
    meta: "invalid-location-code",
    message: INVALID_LOCATION_CODE_MESSAGE,
  };
}

function updateLocationUi() {
  const location = currentLocation();
  if (optionalLocationInput) {
    const message = location.valid ? "" : (location.message || "Invalid location.");
    optionalLocationInput.setCustomValidity(message);
    optionalLocationInput.setAttribute("aria-invalid", String(!location.valid));
  }
  if (locationHelperText) {
    locationHelperText.textContent = location.valid && location.code
      ? `Report code ${location.code} maps to ${location.meta}.`
      : (location.message || "Use room codes like A504, S312, P308, or P201.");
  }
  return location;
}

function handleManualLocationInput() {
  clearReportMapLocationMarker();
  const manualLocation = manualLocationFromInput(optionalLocationInput?.value || "");
  if (manualLocation) {
    state.selectedZone = manualLocation.location.id;
    state.selectedLocation = manualLocation.location.id;
    state.selectedBox = manualLocation.location.id;
    state.expandedBox = manualLocation.location.id;
    state.selectedFloor = {
      locationId: manualLocation.location.id,
      id: manualLocation.floor.id,
      label: manualLocation.floor.label,
    };
    state.selectedSubLocation = null;
    state.expandedMapTarget = null;
    setActiveLocationFilter(manualLocation.mapLabel, {
      load: false,
      focusDashboard: false,
      closeDrawer: false,
      source: "manual",
    });
  }
  updateLocationUi();
}

function prefillReporter() {
  if (!state.user) return;
  reporterInput.value = state.user.identity || state.user.username || "";
}

function validateRegisterFields() {
  if (state.authView !== "register") return null;

  if (!authEmailLooksValid()) {
    return langText({
      en: "Enter a valid email address.",
      "zh-CN": "请输入有效邮箱地址。",
      th: "กรุณาใส่อีเมลที่ถูกต้อง",
    });
  }
  if (!emailVerificationMatchesCurrentForm()) {
    return langText({
      en: "Verify your email before creating the account.",
      "zh-CN": "创建账号前请先验证邮箱。",
      th: "กรุณายืนยันอีเมลก่อนสร้างบัญชี",
    });
  }
  if (String(authPassword?.value || "").length < 6) {
    return langText({
      en: "Password must be at least 6 characters.",
      "zh-CN": "密码至少需要 6 个字符。",
      th: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    });
  }
  return null;
}

function validateReportForm() {
  const imageValidationMessage = validateReportImageFile(state.selectedFile);
  if (!titleInput.value.trim() || titleInput.value.trim().length < 3) {
    return langText({ en: "Item title must be at least 3 characters.", "zh-CN": "物品标题至少需要 3 个字符。", th: "ชื่อสิ่งของต้องมีอย่างน้อย 3 ตัวอักษร" });
  }
  if (!descriptionInput.value.trim() || descriptionInput.value.trim().length < 6) {
    return langText({ en: "Description must be at least 6 characters.", "zh-CN": "描述至少需要 6 个字符。", th: "คำอธิบายต้องมีอย่างน้อย 6 ตัวอักษร" });
  }
  if (imageValidationMessage) {
    return imageValidationMessage;
  }
  const locationValidation = currentLocation();
  if (!locationValidation.valid) {
    return locationValidation.message || "Invalid location.";
  }
  return "";
}

function validateClaimForm() {
  if (!claimReasonInput.value.trim() || claimReasonInput.value.trim().length < 6) {
    return langText({ en: "Claim reason must be at least 6 characters.", "zh-CN": "认领原因至少需要 6 个字符。", th: "เหตุผลในการยื่นคำขอต้องมีอย่างน้อย 6 ตัวอักษร" });
  }
  if (!claimDescriptionInput.value.trim() || claimDescriptionInput.value.trim().length < 6) {
    return langText({ en: "Description of item must be at least 6 characters.", "zh-CN": "物品描述至少需要 6 个字符。", th: "คำอธิบายสิ่งของต้องมีอย่างน้อย 6 ตัวอักษร" });
  }
  if (!claimLocationInput.value.trim() || claimLocationInput.value.trim().length < 4) {
    return langText({ en: "Lost location must be at least 4 characters.", "zh-CN": "丢失地点至少需要 4 个字符。", th: "สถานที่ที่ทำหายต้องมีอย่างน้อย 4 ตัวอักษร" });
  }
  if (!claimIdentifyingInput.value.trim() || claimIdentifyingInput.value.trim().length < 4) {
    return langText({ en: "Additional identifying info must be at least 4 characters.", "zh-CN": "补充识别信息至少需要 4 个字符。", th: "ข้อมูลระบุตัวตนเพิ่มเติมต้องมีอย่างน้อย 4 ตัวอักษร" });
  }
  if (claimIdentifyingInput.value.trim().split(/\s+/).filter(Boolean).length < 2) {
    return langText({
      en: "Add specific identifying details like color, brand, markings, or unique features.",
      "zh-CN": "请提供更具体的识别细节，例如颜色、品牌、贴纸或独特标记。",
      th: "กรุณาระบุรายละเอียดเฉพาะ เช่น สี ยี่ห้อ รอยตำหนิ หรือจุดสังเกตพิเศษ",
    });
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
  (tags || []).slice(0, 8).forEach((tag) => {
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
  if (status === "draft") return "is-safe";
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
  if (!element) return;
  const fallback = fallbackText || "LF";
  element.textContent = fallback;
  element.style.backgroundImage = "";
  element.style.removeProperty("--avatar-image");
  element.style.color = "";
  element.classList.remove("has-avatar-image", "is-avatar-broken", "is-avatar-loading");
  const source = normalizeAvatarUrl(imageUrl);
  element.dataset.avatarSource = source;
  if (!source) return;

  element.textContent = "";
  element.classList.add("is-avatar-loading");
  const probe = new Image();
  probe.onload = () => {
    if (element.dataset.avatarSource !== source) return;
    const cssSource = `url(${JSON.stringify(source)})`;
    element.style.setProperty("--avatar-image", cssSource);
    element.style.backgroundImage = cssSource;
    element.style.color = "transparent";
    element.textContent = "";
    element.classList.add("has-avatar-image");
    element.classList.remove("is-avatar-broken", "is-avatar-loading");
    logProfileImage("loaded", source, {
      elementId: element.id || "",
    });
  };
  probe.onerror = () => {
    if (element.dataset.avatarSource !== source) return;
    element.style.backgroundImage = "";
    element.style.removeProperty("--avatar-image");
    element.style.color = "";
    element.classList.remove("has-avatar-image", "is-avatar-loading");
    element.classList.add("is-avatar-broken");
    element.textContent = fallback;
    logProfileImage("failed", source, {
      elementId: element.id || "",
      fallbackText: fallback,
    });
  };
  probe.src = source;
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
  if (section === "dashboard") {
    return "#dashboard";
  }
  if (section === "map") {
    return "#map";
  }
  if (section === "query") {
    return itemId ? `#query-${itemId}` : "#query";
  }
  return `#${section}`;
}

function readRoute() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) {
    return {
      section: defaultSectionForCurrentUser(),
      itemId: state.currentItemId,
    };
  }
  if (raw === "query") {
    return { section: "query", itemId: null };
  }
  if (raw.startsWith("query-")) {
    const itemId = Number(raw.slice("query-".length)) || null;
    return { section: "query", itemId };
  }
  if (["dashboard", "report", "map", "reports", "room", "returned", "claims", "notifications", "account", "admin"].includes(raw)) {
    return { section: raw, itemId: state.currentItemId };
  }
  return { section: defaultSectionForCurrentUser(), itemId: state.currentItemId };
}

function navigateTo(section, itemId = null, options = {}) {
  if (currentResponsiveMode() !== "desktop") {
    state.locationDrawerOpen = false;
  }
  state.multitaskRequested = Boolean(options.multitask && state.advancedMode);
  if (!state.multitaskRequested) {
    state.multitaskActive = false;
  }
  const nextHash = buildHash(section, itemId);
  if (window.location.hash === nextHash) {
    void activateRoute({ section, itemId });
    return;
  }
  window.location.hash = nextHash;
}

function goBackToPreviousRoute(fallbackSection = "dashboard") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  navigateTo(fallbackSection);
}

function returnFromLocationFilter() {
  const fallback = state.locationFilterSource === "map" ? "map" : "dashboard";
  setActiveLocationFilter("", {
    load: true,
    closeDrawer: false,
  });
  goBackToPreviousRoute(fallback);
}

function closeNewWindowMenu() {
  newWindowMenu?.classList.add("is-hidden");
  newWindowButton?.setAttribute("aria-expanded", "false");
}

function toggleNewWindowMenu() {
  if (!newWindowMenu || !newWindowButton) return;
  const willOpen = newWindowMenu.classList.contains("is-hidden");
  newWindowMenu.classList.toggle("is-hidden", !willOpen);
  newWindowButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
  if (willOpen) {
    const firstAvailable = newWindowMenu.querySelector("button:not(.is-hidden):not(:disabled)");
    window.requestAnimationFrame(() => firstAvailable?.focus({ preventScroll: true }));
  }
}

function syncNewWindowMenu() {
  newWindowMenuButtons.forEach((button) => {
    const target = button.dataset.newWindowTarget || "";
    button.classList.toggle("is-hidden", !sectionAvailableInCurrentMode(target));
    button.classList.toggle("is-active", target === state.currentView);
  });
}

function openNewWindowTarget(section) {
  if (!section) return;
  closeNewWindowMenu();
  if (section === "admin" && !currentUserCanAdmin()) {
    navigateTo("dashboard");
    return;
  }
  navigateTo(section, null, { multitask: state.advancedMode });
}

function sectionLabel(section = state.currentView) {
  const labels = {
    dashboard: t("nav.dashboard"),
    report: t("nav.report"),
    map: t("nav.map"),
    reports: t("nav.reports"),
    room: t("nav.room"),
    returned: t("nav.returned"),
    query: t("nav.query"),
    claims: t("nav.claims"),
    notifications: t("notifications.title"),
    account: t("nav.account"),
    admin: t("nav.admin"),
  };
  return labels[section] || titleCase(section || "dashboard");
}

function breadcrumbLabel(section = state.currentView) {
  const parts = [t("nav.dashboard")];
  const location = activeLocationLabel();
  if (location) {
    parts.push(location);
  }
  if (section && section !== "dashboard") {
    parts.push(sectionLabel(section));
  }
  if (section === "query" && (state.currentQueryItem?.id || state.currentItemId)) {
    parts.push(`Item #${state.currentQueryItem?.id || state.currentItemId}`);
  }
  return parts.join(" > ");
}

function updateLocationBar() {
  const breadcrumbs = breadcrumbLabel(state.currentView);
  const currentSection = sectionLabel(state.currentView);
  if (topbarCurrentSection) {
    topbarCurrentSection.textContent = currentSection;
  }
  if (topbarBreadcrumbs) {
    topbarBreadcrumbs.textContent = breadcrumbs;
  }
  if (sidebarCurrentSection) {
    sidebarCurrentSection.textContent = currentSection;
  }
  if (sidebarBreadcrumbs) {
    sidebarBreadcrumbs.textContent = breadcrumbs;
  }
  syncLocationBrowserState();
  syncLocationFilterBanner();
}

function updateTopbarState() {
  const toggle = (button, active) => {
    if (!button) return;
    button.classList.toggle("is-active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  };
  toggle(showDashboardButton, state.currentView === "dashboard");
  toggle(showMapButton, state.currentView === "map");
  toggle(showReportsButton, state.currentView === "reports");
  toggle(showReportItemButton, state.currentView === "report");
  toggle(showRoomButton, state.currentView === "room");
  toggle(showReturnedButton, state.currentView === "returned");
  toggle(showQueryButton, state.currentView === "query");
  toggle(showClaimsButton, state.currentView === "claims");
  toggle(showNotificationsButton, state.currentView === "notifications");
  toggle(showAccountButton, state.currentView === "account");
  toggle(showAdminButton, state.currentView === "admin");
  updateLocationBar();
  syncModeUi();
  syncNewWindowMenu();
  syncNavActivityIndicators();
}

function setNavActivityIndicator(button, count) {
  if (!button) return;
  const value = Math.max(0, Number(count) || 0);
  button.classList.toggle("has-activity-indicator", value > 0);
  if (value > 0) {
    button.dataset.activityCount = value > 99 ? "99+" : String(value);
  } else {
    delete button.dataset.activityCount;
  }
}

function syncNavActivityIndicators(stats = dashboardStats()) {
  setNavActivityIndicator(showReportsButton, stats.activeReports);
  setNavActivityIndicator(showReturnedButton, stats.returnedThisWeek);
  setNavActivityIndicator(showQueryButton, stats.activeQueries);
  setNavActivityIndicator(showNotificationsButton, currentUserIsStudent() ? 0 : stats.unreadNotifications);
}

function switchSection(section) {
  state.currentView = section;
  if (isPrimaryPanel(section)) {
    openPanel("dashboard", { unminimize: true });
    openPanel("reports", { unminimize: true });
  } else if (secondaryPanelNames.includes(section)) {
    if (state.advancedMode && (state.multitaskRequested || state.multitaskActive)) {
      openPanel("reports", { unminimize: false });
    } else {
      ensurePanelState("reports").closed = true;
    }
    openPanel(section, { unminimize: true });
  }
  applyNavigationLayoutPolicy(section);
  updateTopbarState();
  updatePanelActiveState();
  syncWorkspaceLayout();
  focusActivePanel();
}

async function activateRoute(route = readRoute()) {
  if (!state.user) return;

  const section = route.section || "dashboard";
  if (!sectionAvailableInCurrentMode(section)) {
    navigateTo(defaultSectionForCurrentUser());
    return;
  }
  if (section !== "query" && state.currentView === "query") {
    clearQueryState();
  }
  if (section !== "admin") {
    stopAdminMonitorPolling();
  }
  if (section === "claims") {
    switchSection("claims");
    await loadClaims();
    return;
  }

  if (section === "notifications") {
    switchSection("notifications");
    await loadNotifications();
    return;
  }

  if (section === "room") {
    switchSection("room");
    await loadRoomItems();
    return;
  }

  if (section === "map") {
    switchSection("map");
    await loadMapSystem();
    return;
  }

  if (section === "returned") {
    switchSection("returned");
    await loadReturnedItems();
    return;
  }

  if (section === "report") {
    switchSection("report");
    prepareReportPage();
    return;
  }

  if (section === "account") {
    renderAccount();
    switchSection("account");
    return;
  }

  if (section === "admin") {
    if (!currentUserCanAdmin()) {
      navigateTo("dashboard");
      return;
    }
    switchSection("admin");
    switchAdminTab(state.adminTab);
    await loadAdminSurface();
    startAdminMonitorPolling();
    return;
  }

  if (section === "query") {
    switchSection("query");
    await loadQueryPage(route.itemId || null);
    return;
  }

  if (section === "dashboard") {
    switchSection("dashboard");
    renderDashboard();
    return;
  }

  switchSection("reports");
}

async function apiFetch(path, options = {}) {
  let response;
  const method = String(options.method || "GET").toUpperCase();
  const requestUrl = ensureApiBase(path);
  logApiDebug("request", {
    method,
    url: requestUrl,
    payload: summarizeRequestBodyForLog(options.body),
  });
  try {
    response = await fetch(requestUrl, {
      ...options,
      method,
      headers: {
        ...(options.headers || {}),
        ...authHeaders(),
      },
    });
  } catch (error) {
    logClientError("network request failed", error, { path, apiBase: API_BASE, url: requestUrl });
    logApiDebug("network error", { method, url: requestUrl });
    throw new Error(`Could not reach backend at ${API_BASE || "the configured API origin"}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();
  const responsePayload = parseApiResponsePayload(responseText, contentType);
  logApiDebug("response", {
    method,
    url: response.url || requestUrl,
    status: response.status,
    body: sanitizeForApiLog(responsePayload),
  });

  if (response.ok) {
    return responsePayload;
  }

  let message = "Request failed";
  let retryAfter = null;
  if (responsePayload && typeof responsePayload === "object") {
    message = extractApiMessage(responsePayload, message);
    retryAfter = Number(responsePayload?.retry_after || 0) || null;
  } else if (typeof responsePayload === "string" && responsePayload.trim()) {
    message = responsePayload.trim();
  }

  if (response.status === 429 && retryAfter) {
    message = langText({
      en: `${message} Please wait about ${retryAfter} second(s).`,
      "zh-CN": `${message} 请大约等待 ${retryAfter} 秒后再试。`,
      th: `${message} โปรดรอประมาณ ${retryAfter} วินาทีก่อนลองใหม่`,
    });
  }
  const error = new Error(message);
  error.status = response.status;
  error.payload = responsePayload;
  logClientError("api request failed", error, { path, status: response.status });
  throw error;
}

async function loadFilters() {
  try {
    const filters = await apiFetch("/filters");
    state.filters = {
      categories: filters.categories || fallbackFilters.categories,
      statuses: filters.statuses || fallbackFilters.statuses,
      locations: uniqueValues([
        ...campusLocationsFromMap(),
        ...(filters.locations || fallbackFilters.locations),
      ]),
    };
  } catch (error) {
    state.filters = {
      ...fallbackFilters,
      locations: campusLocationsFromMap(),
    };
    logClientError("loading filters failed", error);
  }

  fillSelect(categoryInput, state.filters.categories);
  fillSelect(categoryFilter, state.filters.categories, true);
  fillSelect(statusFilter, state.filters.statuses, true);
  fillSelect(locationFilter, state.filters.locations, true);
  syncLocationFilterSelect();
  categoryInput.value = "Other";
}

function notificationCategory(notification) {
  const eventType = String(notification?.event_type || "").toLowerCase();
  if (eventType === "claim_approved") {
    return {
      key: "claim-approved",
      label: langText({ en: "Claim approved", "zh-CN": "认领通过", th: "อนุมัติคำขอ" }),
      className: "is-safe",
    };
  }
  if (eventType === "claim_rejected") {
    return {
      key: "claim-rejected",
      label: langText({ en: "Claim rejected", "zh-CN": "认领被拒", th: "ปฏิเสธคำขอ" }),
      className: "is-flagged",
    };
  }
  if (eventType.includes("query")) {
    return {
      key: "query-update",
      label: langText({ en: "Question update", "zh-CN": "问题更新", th: "อัปเดตคำถาม" }),
      className: "is-lost",
    };
  }
  if (eventType.includes("admin") || eventType.includes("override")) {
    return {
      key: "admin-message",
      label: langText({ en: "Admin message", "zh-CN": "管理员消息", th: "ข้อความผู้ดูแล" }),
      className: "is-claimed",
    };
  }
  if (eventType.includes("report") || eventType.includes("match") || eventType.includes("dispute")) {
    return {
      key: "report-update",
      label: langText({ en: "Report update", "zh-CN": "报告更新", th: "อัปเดตรายงาน" }),
      className: "is-lost",
    };
  }
  return {
    key: "admin-message",
    label: langText({ en: "Admin message", "zh-CN": "管理员消息", th: "ข้อความผู้ดูแล" }),
    className: "is-safe",
  };
}

function isClaimApprovedNotification(notification) {
  return String(notification?.event_type || "").toLowerCase() === "claim_approved";
}

async function markNotificationRead(notificationId, { reload = true } = {}) {
  if (!notificationId) return;
  try {
    await apiFetch(`/notifications/${notificationId}/read`, { method: "POST" });
    if (reload) {
      await loadNotifications();
    }
  } catch (error) {
    logClientError("mark notification read failed", error, { notificationId });
  }
}

async function openQuestionNotification(notification) {
  const questionId = Number(notification?.related_question_id || 0);
  if (!questionId) return;
  state.pendingQuestionThreadId = questionId;
  await markNotificationRead(notification.id, { reload: false });
  navigateTo("query");
  if (state.currentView === "query") {
    await loadQuestionBoard({ openQuestionId: questionId });
  }
}

function createNotificationCard(notification, { page = false } = {}) {
  const item = document.createElement("article");
  const category = notificationCategory(notification);
  item.className = `notification-item notification-category-${category.key}`;
  item.classList.toggle("is-unread", !notification.read);
  item.classList.toggle("is-priority", isClaimApprovedNotification(notification));

  const head = document.createElement("div");
  head.className = "notification-item-head";
  const relatedItem = relatedItemForNotification(notification);
  const titleWrap = document.createElement("span");
  titleWrap.className = "person-line notification-title-line";
  titleWrap.append(createMiniAvatar(
    relatedItem?.reporter_identity || relatedItem?.reporter_name || notification.title || "LF",
    relatedItem?.reporter_avatar_url || "",
  ));
  const title = document.createElement("strong");
  title.textContent = notification.title || t("notifications.title");
  titleWrap.append(title);

  const categoryBadge = document.createElement("span");
  categoryBadge.className = `status-badge notification-category-badge ${category.className}`;
  categoryBadge.textContent = category.label;

  const button = document.createElement("button");
  button.className = "ghost-button small-button";
  button.type = "button";
  button.textContent = t("notifications.markRead");
  button.disabled = Boolean(notification.read);
  button.addEventListener("click", () => {
    void markNotificationRead(notification.id);
  });
  head.append(titleWrap, categoryBadge, button);

  const body = document.createElement("p");
  body.className = "item-description";
  body.textContent = notification.message || "";

  const meta = document.createElement("p");
  meta.className = "notification-meta";
  meta.textContent = formatDateTime(notification.created_at);

  item.append(head, body, meta);

  if (page && (notification.related_claim_id || isClaimApprovedNotification(notification))) {
    const actions = document.createElement("div");
    actions.className = "card-actions notification-card-actions";
    const viewClaim = document.createElement("button");
    viewClaim.className = "primary-button small-button";
    viewClaim.type = "button";
    viewClaim.textContent = langText({ en: "View claim", "zh-CN": "查看认领", th: "ดูคำขอ" });
    viewClaim.addEventListener("click", async () => {
      await markNotificationRead(notification.id);
      navigateTo("claims");
    });
    actions.append(viewClaim);
    item.append(actions);
  }

  if (notification.related_question_id) {
    const actions = document.createElement("div");
    actions.className = "card-actions notification-card-actions";
    const viewThread = document.createElement("button");
    viewThread.className = "primary-button small-button";
    viewThread.type = "button";
    viewThread.textContent = langText({ en: "Open thread", "zh-CN": "打开主题", th: "เปิดเธรด" });
    viewThread.addEventListener("click", () => {
      void openQuestionNotification(notification);
    });
    actions.append(viewThread);
    item.append(actions);
  }

  appendNotificationPreview(notification, item);
  return item;
}

function renderNotificationCollection(container, notifications = [], { page = false } = {}) {
  if (!container) return;
  container.replaceChildren();
  if (!notifications.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = t("notifications.empty");
    container.append(empty);
    return;
  }
  notifications.forEach((notification) => {
    container.append(createNotificationCard(notification, { page }));
  });
}

function renderNotificationPageSummary(notifications = state.notifications) {
  if (!notificationPageCount) return;
  notificationPageCount.textContent = langText({
    en: `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`,
    "zh-CN": `${notifications.length} 条通知`,
    th: `${notifications.length} การแจ้งเตือน`,
  });
}

function claimApprovalCopy(notification) {
  const relatedItem = relatedItemForNotification(notification);
  const quotedTitle = String(notification?.message || "").match(/"([^"]+)"/)?.[1] || "";
  const itemTitle = relatedItem?.title || quotedTitle || langText({ en: "your item", "zh-CN": "你的物品", th: "สิ่งของของคุณ" });
  const collectionLocation = localizeValue("Lost & Found Room");
  const fallbackInstruction = langText({
    en: `Please collect the item at ${collectionLocation}.`,
    "zh-CN": `请到${collectionLocation}领取物品。`,
    th: `โปรดรับสิ่งของที่${collectionLocation}`,
  });
  const backendMessage = String(notification?.message || "").trim();
  const message = /\b(collect|collection|pick up|pickup|lost & found|student services)\b/i.test(backendMessage)
    ? backendMessage
    : fallbackInstruction;
  return {
    eyebrow: langText({ en: "Claim approved", "zh-CN": "认领已通过", th: "อนุมัติคำขอแล้ว" }),
    title: langText({
      en: `Your claim for ${itemTitle} was approved.`,
      "zh-CN": `你对 ${itemTitle} 的认领已通过。`,
      th: `คำขอรับ ${itemTitle} ของคุณได้รับการอนุมัติแล้ว`,
    }),
    message,
  };
}

function currentClaimSuccessNotification() {
  return state.notifications.find((notification) => !notification.read && isClaimApprovedNotification(notification)) || null;
}

function renderClaimSuccessBanner(notification = currentClaimSuccessNotification()) {
  if (!claimSuccessBanner) return;
  if (!notification) {
    state.activeClaimSuccessNotificationId = null;
    claimSuccessBanner.classList.add("is-hidden");
    return;
  }

  state.activeClaimSuccessNotificationId = notification.id;
  const copy = claimApprovalCopy(notification);
  claimSuccessEyebrow.textContent = copy.eyebrow;
  claimSuccessTitle.textContent = copy.title;
  claimSuccessMessage.textContent = copy.message;
  claimSuccessBanner.classList.remove("is-hidden");
}

function renderNotifications(notifications = state.notifications) {
  notificationBadge.textContent = String(state.unreadNotifications || 0);
  notificationBadge.classList.toggle("is-hidden", !state.unreadNotifications);
  notificationButton?.setAttribute("aria-expanded", notificationDropdown && !notificationDropdown.classList.contains("is-hidden") ? "true" : "false");

  renderNotificationCollection(notificationList, notifications);
  renderNotificationCollection(notificationPageList, notifications, { page: true });
  renderNotificationPageSummary(notifications);
  renderClaimSuccessBanner();
}

async function loadNotifications() {
  if (!state.user) return;
  setLoadingLine(notificationPageLoading, true);
  try {
    const data = await apiFetch("/notifications");
    const previousUnreadCount = Number(state.unreadNotifications || 0);
    state.notifications = data.notifications || [];
    state.unreadNotifications = data.unread_count || 0;
    if (state.notificationsLoadedOnce && state.unreadNotifications > previousUnreadCount) {
      triggerHaptic("notification");
    }
    state.notificationsLoadedOnce = true;
    syncNotificationActivities(state.notifications);
    renderNotifications(state.notifications);
    renderDashboard();
  } catch (error) {
    logClientError("loading notifications failed", error);
  } finally {
    setLoadingLine(notificationPageLoading, false);
  }
}

function renderStatsSummary() {
  const count = Number(state.statsSummary?.items_returned_this_week || 0);
  if (weeklyReturnedCount) {
    weeklyReturnedCount.textContent = String(count);
  }
  renderDashboard();
}

function dateFromItem(item, fields = ["created_at", "event_date", "updated_at"]) {
  for (const field of fields) {
    const value = item?.[field];
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function isSameLocalDay(date, reference = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate();
}

function isWithinDays(date, days, reference = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const diffMs = reference.getTime() - date.getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

function textMatchesActiveLocation(value) {
  const activeLocation = currentLocationFilterValue();
  if (!activeLocation) return true;
  const source = normalizeLocationText(value);
  if (!source) return false;

  if (locationAliasesForValue(activeLocation).some((alias) => source.includes(alias))) {
    return true;
  }

  const parts = locationPathParts(activeLocation);
  if (!parts.length) return true;
  if (parts.length === 1) {
    return locationPartMatchesText(parts[0], source);
  }

  const leaf = parts[parts.length - 1];
  const parentMatches = parts.slice(0, -1).every((part) => locationPartMatchesText(part, source));
  const leafMatches = locationPartMatchesText(leaf, source);
  if (parentMatches && leafMatches) return true;
  return !locationLeafNeedsParent(leaf) && leafMatches;
}

function itemMapTextSources(item = {}) {
  const nested = item?.item || {};
  return [
    item?.location,
    item?.secondary_location,
    item?.lost_location,
    nested?.location,
    nested?.secondary_location,
    `${item?.secondary_location || ""} > ${item?.location || ""}`,
    `${nested?.secondary_location || ""} > ${nested?.location || ""}`,
  ].map((value) => normalizeLocationText(value)).filter(Boolean);
}

function roomLocationInfoFromValue(value = "") {
  const parsed = parseManualLocationCode(value);
  if (!parsed) return null;
  const location = schoolLocationById(parsed.rule.locationId);
  if (!location) return null;
  const floor = floorForLabel(location, floorLabelForNumber(parsed.floorNumber));
  return {
    code: parsed.code,
    location,
    floor,
    locationId: location.id,
    floorNumber: parsed.floorNumber,
  };
}

function canonicalLocationInfoFromValue(value = "") {
  const roomInfo = roomLocationInfoFromValue(value);
  if (roomInfo) return roomInfo;
  const knownLocation = knownLocationFromInput(value);
  if (!knownLocation?.location) return null;
  const floor = knownLocation.floor || null;
  const subLocation = knownLocation.subLocation || null;
  return {
    code: knownLocation.code || "",
    location: knownLocation.location,
    floor,
    subLocation,
    locationId: knownLocation.location.id,
    floorNumber: knownLocation.floorNumber || (floor ? floorNumberForFloor(floor) : 0),
    subLocationId: subLocation?.id || "",
  };
}

function itemRoomLocationInfos(item = {}) {
  const nested = item?.item || {};
  return uniqueValues([
    item?.location,
    item?.secondary_location,
    item?.lost_location,
    nested?.location,
    nested?.secondary_location,
    `${item?.secondary_location || ""} > ${item?.location || ""}`,
    `${nested?.secondary_location || ""} > ${nested?.location || ""}`,
  ])
    .map(canonicalLocationInfoFromValue)
    .filter(Boolean);
}

function itemRecentForMap(item = {}) {
  const rawDate = item?.updated_at || item?.created_at || item?.timestamp || item?.event_date;
  const dateValue = Date.parse(rawDate || "");
  return Number.isFinite(dateValue) && Date.now() - dateValue <= 7 * 24 * 60 * 60 * 1000;
}

function itemMatchesMapRegion(item, region) {
  if (!region) return false;
  const label = normalizeLocationText(region.label);
  const zone = normalizeLocationText(region.zone);
  const path = normalizeLocationText(regionPath(region));
  const sources = itemMapTextSources(item);
  if (!label || !sources.length) return false;
  if (sources.some((source) => path && source.includes(path))) return true;
  if (!sources.some((source) => source.includes(label))) return false;
  const secondaryMatchesZone = sources.some((source) => zone && source.includes(zone));
  const hasSecondary = Boolean(normalizeLocationText(item?.secondary_location || item?.item?.secondary_location || ""));
  return secondaryMatchesZone || !hasSecondary;
}

function itemMatchesMapZone(item, zone) {
  const matchingLocation = state.locations.find((location) => location.name === zone || location.label === zone);
  if (matchingLocation && itemRoomLocationInfos(item).some((info) => info.locationId === matchingLocation.id)) {
    return true;
  }
  const candidateZones = uniqueValues([
    zone,
    matchingLocation?.name,
    matchingLocation?.label,
  ]).flatMap((value) => locationAliasesForPart(value)).filter(Boolean);
  const sources = itemMapTextSources(item);
  if (candidateZones.some((normalizedZone) => sources.some((source) => source.includes(normalizedZone)))) {
    return true;
  }
  return state.mapRegions.some((region) => region.zone === zone && itemMatchesMapRegion(item, region));
}

function itemsForMapRegion(region) {
  if (!region) return [];
  return state.items.filter((item) => !item.claimed && !item.returned_at && itemMatchesMapRegion(item, region));
}

function itemMatchesActiveLocation(item) {
  const activeLocation = currentLocationFilterValue();
  if (!activeLocation) return true;
  const activeRegion = state.mapRegions.find((region) => normalizedLocationFilter(regionPath(region)) === activeLocation);
  if (activeRegion) return itemMatchesMapRegion(item, activeRegion);
  const activeZone = state.mapZones.find((zone) => normalizedLocationFilter(zone) === activeLocation);
  if (activeZone) return itemMatchesMapZone(item, activeZone);
  const activeParts = locationPathParts(activeLocation);
  const activeLocationNode = activeParts.length ? schoolLocationForFilter(activeParts[0]) : null;
  const activeFloor = activeLocationNode && activeParts.length > 1 ? floorForLabel(activeLocationNode, activeParts[1]) : null;
  if (activeLocationNode && activeFloor && itemMatchesFloor(item, activeLocationNode, activeFloor)) {
    return true;
  }
  return textMatchesActiveLocation(item?.location)
    || textMatchesActiveLocation(item?.secondary_location)
    || textMatchesActiveLocation(item?.lost_location)
    || textMatchesActiveLocation(item?.item?.location)
    || textMatchesActiveLocation(item?.item?.secondary_location);
}

function filterByActiveLocation(items = []) {
  return currentLocationFilterValue() ? items.filter(itemMatchesActiveLocation) : items;
}

function renderLocationScopedSurfaces() {
  renderItems(filterByActiveLocation(state.items));
  renderClaims(filterByActiveLocation(state.claims));
  renderReturnedItems(filterByActiveLocation(state.returnedItems));
  renderDashboard();
  renderSchoolMap();
  if (state.currentView === "query") {
    renderQueryItemSelector(state.currentQueryItem?.id || state.currentItemId || null);
  }
}

function normalizeMapRegion(region = {}) {
  const zone = SCHOOL_ZONES.includes(region.zone) ? region.zone : SCHOOL_ZONES[0];
  const numberFor = (key, fallback = 0) => {
    const value = Number(region[key]);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  };
  const x = numberFor("x");
  const y = numberFor("y");
  const width = Math.min(1 - x, Math.max(0.001, numberFor("width", 0.08)));
  const height = Math.min(1 - y, Math.max(0.001, numberFor("height", 0.08)));
  return {
    id: String(region.id || ""),
    label: String(region.label || "").trim() || "Unnamed region",
    zone,
    x,
    y,
    width,
    height,
  };
}

function positionMapTooltip(tooltip, shell, event) {
  if (!tooltip || !shell || !event) return;
  const rect = shell.getBoundingClientRect();
  const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2;
  const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2;
  const x = Math.min(rect.width - 12, Math.max(12, clientX - rect.left + 14));
  const y = Math.min(rect.height - 12, Math.max(12, clientY - rect.top + 14));
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function showMapTooltip(region, event, tooltip = schoolMapTooltip, shell = schoolMapShell) {
  if (!tooltip || !shell || !region) return;
  const stats = mapRegionStats(region);
  tooltip.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = region.label;
  const zone = document.createElement("span");
  zone.textContent = region.zone;
  const count = document.createElement("span");
  count.textContent = `${stats.item_count} item${stats.item_count === 1 ? "" : "s"} • ${stats.lost_count} lost`;
  const recent = document.createElement("span");
  recent.className = stats.recent_activity ? "map-tooltip-recent is-active" : "map-tooltip-recent";
  recent.textContent = stats.recent_activity ? "Recent activity" : "No recent activity";
  tooltip.append(title, zone, count, recent);
  positionMapTooltip(tooltip, shell, event);
  tooltip.classList.remove("is-hidden");
}

function hideMapTooltip(tooltip = schoolMapTooltip) {
  tooltip?.classList.add("is-hidden");
}

function heatToneForCount(count, maxCount) {
  if (count <= 0 || maxCount <= 0) return "";
  const ratio = count / maxCount;
  if (ratio < 0.34) return "is-heat-low";
  if (ratio < 0.67) return "is-heat-medium";
  return "is-heat-high";
}

function heatIntensityLabel(count, maxCount) {
  if (!count || !maxCount) return "No density";
  const ratio = count / maxCount;
  if (ratio < 0.34) return "Low density";
  if (ratio < 0.67) return "Medium density";
  return "High density";
}

function appendTooltipRecentItems(tooltip, recentItems = []) {
  const latestItem = latestImageItemForItems(recentItems) || recentItems[0] || null;
  if (!latestItem) {
    const empty = document.createElement("span");
    empty.className = "map-tooltip-recent";
    empty.textContent = "No reports yet";
    tooltip.append(empty);
    return;
  }
  const latestLabel = document.createElement("span");
  latestLabel.className = "map-tooltip-latest-label";
  latestLabel.textContent = "Latest:";
  const preview = document.createElement("span");
  preview.className = "map-tooltip-preview";
  preview.textContent = latestItem.title || latestItem.category || "Recent item";
  tooltip.append(latestLabel, preview);

  const thumbnailSource = state.previewUrls.get(latestItem.id) || resolveImageUrl(latestItem);
  if (!canPreviewImage(thumbnailSource)) return;
  const image = document.createElement("img");
  image.className = "map-tooltip-thumbnail";
  image.src = thumbnailSource;
  image.alt = latestItem.title || "Latest report image";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.remove(), { once: true });
  tooltip.append(image);
}

function mapLocationTargetStats(target = {}) {
  if (!target.location) return { item_count: 0, lost_count: 0, recent_items: [] };
  if (target.subLocation) {
    return schoolSubLocationStats(target.location, target.subLocation, target.floor || null);
  }
  if (target.floor) {
    return schoolFloorStats(target.location, target.floor);
  }
  return schoolLocationStats(target.location);
}

function showMapLocationTooltip(target, event, tooltip = schoolMapTooltip, shell = schoolMapShell) {
  if (!tooltip || !shell || !target?.location) return;
  const stats = mapLocationTargetStats(target);
  const heatMax = target.floor || target.subLocation
    ? maxTerminalReportCount(target.location)
    : maxLocationReportCount();
  tooltip.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = target.label || schoolLocationDisplayName(target.location);
  const count = document.createElement("span");
  count.textContent = reportCountLabel(stats.item_count || 0);
  const hint = document.createElement("span");
  hint.className = stats.recent_activity ? "map-tooltip-recent is-active" : "map-tooltip-recent";
  hint.textContent = heatIntensityLabel(stats.item_count, heatMax);
  tooltip.append(title, count, hint);
  appendTooltipRecentItems(tooltip, stats.recent_items || []);
  positionMapTooltip(tooltip, shell, event);
  tooltip.classList.remove("is-hidden");
}

function mapReportContextActive() {
  return Boolean(state.activeReportFormContext && state.currentView === "report");
}

function primaryRegionForLocation(location) {
  return location?.interactionRegions?.[0] || {
    id: `${location?.id || "location"}-region`,
    label: location?.label || location?.name || "",
    x: 0.4,
    y: 0.4,
    width: 0.2,
    height: 0.16,
  };
}

function cloneMapLayoutRegion(region = {}) {
  return {
    ...region,
    x: coordinateUnit(region.x, 0),
    y: coordinateUnit(region.y, 0),
    width: Math.max(0.001, Math.min(1, coordinateUnit(region.width, 0.1))),
    height: Math.max(0.001, Math.min(1, coordinateUnit(region.height, 0.1))),
    points: normalizeRegionPoints(region.points || []),
  };
}

function mapRegionEdge(region, axis, edge) {
  if (axis === "x") {
    return edge === "end" ? region.x + region.width : region.x;
  }
  return edge === "end" ? region.y + region.height : region.y;
}

function mapRegionCenter(region, axis) {
  return axis === "x"
    ? region.x + region.width / 2
    : region.y + region.height / 2;
}

function mapRegionSeparation(regionA, regionB) {
  const xAmount = Math.min(mapRegionEdge(regionA, "x", "end"), mapRegionEdge(regionB, "x", "end"))
    - Math.max(mapRegionEdge(regionA, "x", "start"), mapRegionEdge(regionB, "x", "start"))
    + MAP_WRAPPER_MIN_GAP;
  const yAmount = Math.min(mapRegionEdge(regionA, "y", "end"), mapRegionEdge(regionB, "y", "end"))
    - Math.max(mapRegionEdge(regionA, "y", "start"), mapRegionEdge(regionB, "y", "start"))
    + MAP_WRAPPER_MIN_GAP;
  if (xAmount <= 0 || yAmount <= 0) return null;
  return { xAmount, yAmount };
}

function shrinkMapRegionTrailingEdge(region, axis, amount) {
  const sizeKey = axis === "x" ? "width" : "height";
  const applied = Math.min(Math.max(0, amount), Math.max(0, region[sizeKey] - MAP_WRAPPER_MIN_SIZE));
  region[sizeKey] -= applied;
  return applied;
}

function shrinkMapRegionLeadingEdge(region, axis, amount) {
  const positionKey = axis === "x" ? "x" : "y";
  const sizeKey = axis === "x" ? "width" : "height";
  const applied = Math.min(Math.max(0, amount), Math.max(0, region[sizeKey] - MAP_WRAPPER_MIN_SIZE));
  region[positionKey] += applied;
  region[sizeKey] -= applied;
  return applied;
}

function splitMapRegionBoundary(regionA, regionB, axis, amount) {
  const before = mapRegionCenter(regionA, axis) <= mapRegionCenter(regionB, axis) ? regionA : regionB;
  const after = before === regionA ? regionB : regionA;
  const beforeTarget = amount / 2;
  const afterTarget = amount - beforeTarget;
  let applied = 0;
  applied += shrinkMapRegionTrailingEdge(before, axis, beforeTarget);
  applied += shrinkMapRegionLeadingEdge(after, axis, afterTarget);
  if (applied < amount) {
    applied += shrinkMapRegionTrailingEdge(before, axis, amount - applied);
  }
  if (applied < amount) {
    applied += shrinkMapRegionLeadingEdge(after, axis, amount - applied);
  }
  return applied > 0;
}

function collisionSafeMapTargets(targets = []) {
  const safeTargets = targets.map((target) => ({
    ...target,
    region: cloneMapLayoutRegion(target.region),
  }));
  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;
    for (let leftIndex = 0; leftIndex < safeTargets.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < safeTargets.length; rightIndex += 1) {
        const leftRegion = safeTargets[leftIndex].region;
        const rightRegion = safeTargets[rightIndex].region;
        if (!leftRegion || !rightRegion) continue;
        const separation = mapRegionSeparation(leftRegion, rightRegion);
        if (!separation) continue;
        const axis = separation.xAmount <= separation.yAmount ? "x" : "y";
        changed = splitMapRegionBoundary(leftRegion, rightRegion, axis, separation[`${axis}Amount`]) || changed;
      }
    }
    if (!changed) break;
  }
  return safeTargets;
}

function styleMapBox(element, region) {
  element.style.left = `${region.x * 100}%`;
  element.style.top = `${region.y * 100}%`;
  element.style.width = `${region.width * 100}%`;
  element.style.height = `${region.height * 100}%`;
  element.style.maxWidth = "none";
}

function subdivideRegion(region, index, total, { columns = 0 } = {}) {
  const safeTotal = Math.max(1, total);
  const columnCount = columns || (safeTotal > 4 ? 2 : safeTotal);
  const rowCount = Math.ceil(safeTotal / columnCount);
  const gap = 0.006;
  const column = index % columnCount;
  const row = Math.floor(index / columnCount);
  const width = Math.max(0.001, (region.width - gap * (columnCount + 1)) / columnCount);
  const height = Math.max(0.001, (region.height - gap * (rowCount + 1)) / rowCount);
  return {
    x: region.x + gap + column * (width + gap),
    y: region.y + gap + row * (height + gap),
    width,
    height,
  };
}

function regionForFloor(location, floor) {
  if (!location || !floor) return primaryRegionForLocation(location);
  const index = location.floors.findIndex((candidate) => candidate.id === floor.id);
  return subdivideRegion(primaryRegionForLocation(location), Math.max(0, index), location.floors.length, { columns: 1 });
}

function regionForFloorRoom(location, floor, room) {
  if (!location || !floor || !room) return regionForFloor(location, floor);
  const source = floor.subLocations || [];
  const index = source.findIndex((candidate) => candidate.id === room.id);
  return subdivideRegion(regionForFloor(location, floor), Math.max(0, index), source.length);
}

function regionForDirectSubLocation(location, subLocation) {
  if (!location || !subLocation) return primaryRegionForLocation(location);
  const source = directSubLocationsForLocation(location);
  const index = source.findIndex((candidate) => candidate.id === subLocation.id);
  return subdivideRegion(primaryRegionForLocation(location), Math.max(0, index), source.length);
}

function focusedMapRegion() {
  const location = selectedSchoolLocation();
  if (!location) return null;
  const floor = selectedSchoolFloor();
  const subLocation = selectedSchoolSubLocation();
  if (subLocation && floor) return regionForFloor(location, floor);
  if (subLocation && !floor) return primaryRegionForLocation(location);
  if (floor) return regionForFloor(location, floor);
  return primaryRegionForLocation(location);
}

function cameraStateForRegion(region) {
  if (!region) return { scale: 1, x: 0.5, y: 0.5 };
  const longestSide = Math.max(region.width, region.height, 0.001);
  const scale = Math.min(4, Math.max(2, 0.82 / longestSide));
  return {
    scale,
    x: Math.min(0.95, Math.max(0.05, region.x + region.width / 2)),
    y: Math.min(0.95, Math.max(0.05, region.y + region.height / 2)),
  };
}

function focusCameraOnRegion(region) {
  state.cameraZoomState = { scale: 1, x: 0.5, y: 0.5 };
}

function resetMapCamera() {
  state.cameraZoomState = { scale: 1, x: 0.5, y: 0.5 };
}

function applyMapCamera() {
  if (schoolMapCamera) {
    schoolMapCamera.style.transform = "none";
  }
  schoolMapShell?.classList.remove("is-focused");
}

function renderMapFocus() {
  return null;
}

function structuredLocationFromSelection() {
  const location = selectedSchoolLocation();
  if (!location) return null;
  const floor = selectedSchoolFloor();
  const subLocation = selectedSchoolSubLocation();
  if (subLocation && floor) {
    return {
      valid: true,
      value: subLocation.label,
      meta: locationFloorPath(location, floor),
      label: locationSubLocationPath(location, subLocation, floor),
    };
  }
  if (subLocation) {
    return {
      valid: true,
      value: subLocation.label,
      meta: location.name,
      label: locationSubLocationPath(location, subLocation),
    };
  }
  if (floor) {
    return {
      valid: true,
      value: floor.label,
      meta: location.name,
      label: locationFloorPath(location, floor),
    };
  }
  return {
    valid: true,
    value: location.name,
    meta: location.name,
    label: location.name,
  };
}

function assignReportLocationFromSelection() {
  if (!mapReportContextActive()) return;
  const structured = structuredLocationFromSelection();
  if (!structured || !optionalLocationInput) return;
  optionalLocationInput.value = structured.label;
  optionalLocationInput.dataset.mapLocation = structured.label;
  updateLocationUi();
  setMessage(uploadMessage, `Location selected: ${structured.label}`);
}

function clearReportMapLocationMarker() {
  if (optionalLocationInput) {
    delete optionalLocationInput.dataset.mapLocation;
  }
}

function terminalTargetsForLocation(location) {
  if (!location) return [];
  if (locationUsesDirectExpandedSubLocations(location)) {
    return directSubLocationsForLocation(location).map((subLocation) => ({
      id: `${location.id}-${subLocation.id}`,
      key: `sub:${location.id}:${subLocation.id}`,
      type: "subLocation",
      label: subLocation.label,
      location,
      floor: null,
      subLocation,
      path: locationSubLocationPath(location, subLocation),
      stats: schoolSubLocationStats(location, subLocation),
    }));
  }
  if (locationHasFloors(location)) {
    return location.floors
      .map((floor) => {
        const label = validFloorLabelForLocation(location, floor);
        if (!label) return null;
        return {
          id: `${location.id}-${floor.id}`,
          key: `floor:${location.id}:${floor.id}`,
          type: "floor",
          label,
          location,
          floor: { ...floor, label },
          subLocation: null,
          path: locationFloorPath(location, floor),
          stats: schoolFloorStats(location, floor),
        };
      })
      .filter(Boolean);
  }
  if (!directSubLocationsForLocation(location).length) {
    return [{
      id: location.id,
      key: `location:${location.id}`,
      type: "location",
      label: schoolLocationDisplayName(location),
      location,
      floor: null,
      subLocation: null,
      path: location.name,
      stats: schoolLocationStats(location),
    }];
  }
  return directSubLocationsForLocation(location).map((subLocation) => ({
    id: `${location.id}-${subLocation.id}`,
    key: `sub:${location.id}:${subLocation.id}`,
    type: "subLocation",
    label: subLocation.label,
    location,
    floor: null,
    subLocation,
    path: locationSubLocationPath(location, subLocation),
    stats: schoolSubLocationStats(location, subLocation),
  }));
}

function selectedTerminalKeyForLocation(location) {
  if (!location || state.selectedLocation !== location.id) return "";
  if (state.selectedSubLocation?.id) return `sub:${location.id}:${state.selectedSubLocation.id}`;
  if (state.selectedFloor?.id) return `floor:${location.id}:${state.selectedFloor.id}`;
  if (!locationHasFloors(location) && !directSubLocationsForLocation(location).length) return `location:${location.id}`;
  return "";
}

function maxLocationReportCount() {
  return state.locations.reduce((maxCount, location) => (
    Math.max(maxCount, schoolLocationStats(location).item_count || 0)
  ), 0);
}

function maxTerminalReportCount(location) {
  return terminalTargetsForLocation(location).reduce((maxCount, target) => (
    Math.max(maxCount, target.stats?.item_count || 0)
  ), 0);
}

function expandMapBox(location) {
  if (!location) return;
  state.selectedBox = location.id;
  state.expandedBox = location.id;
  state.selectedZone = location.id;
  state.selectedLocation = location.id;
  state.selectedSubLocation = null;
  state.selectedFloor = null;
  state.expandedMapTarget = null;
  resetMapCamera();
  triggerHaptic("selection");
  renderSchoolMap();
}

function selectMapZone(location) {
  expandMapBox(location);
}

function selectMapStandaloneLocation(location, { assignInput = true, openReports = true } = {}) {
  if (!location) return;
  state.selectedBox = location.id;
  state.expandedBox = location.id;
  state.selectedZone = location.id;
  state.selectedLocation = location.id;
  state.selectedFloor = null;
  state.selectedSubLocation = null;
  state.expandedMapTarget = null;
  resetMapCamera();
  setActiveLocationFilter(schoolLocationFilterValue(location), {
    load: !mapReportContextActive(),
    focusDashboard: false,
    closeDrawer: false,
    source: "map",
  });
  if (assignInput) {
    assignReportLocationFromSelection();
  }
  triggerHaptic("selection");
  renderSchoolMap();
  if (openReports) {
    openReportsForSelectedMapLocation();
  }
}

function openReportsForSelectedMapLocation() {
  if (mapReportContextActive()) return;
  if (state.user && state.currentView !== "reports") {
    navigateTo("reports");
  } else {
    syncWorkspaceLayout();
  }
}

function selectMapFloor(location, floor, { assignInput = true, openReports = true } = {}) {
  if (!location || !floor) return;
  state.selectedBox = location.id;
  state.expandedBox = location.id;
  state.selectedZone = location.id;
  state.selectedLocation = location.id;
  state.selectedFloor = { locationId: location.id, id: floor.id, label: floor.label };
  state.selectedSubLocation = null;
  state.expandedMapTarget = null;
  resetMapCamera();
  setActiveLocationFilter(locationFloorPath(location, floor), {
    load: !mapReportContextActive(),
    focusDashboard: false,
    closeDrawer: false,
    source: "map",
  });
  if (assignInput) {
    assignReportLocationFromSelection();
  }
  triggerHaptic("selection");
  renderSchoolMap();
  if (openReports) {
    openReportsForSelectedMapLocation();
  }
}

function selectMapSubLocation(location, subLocation, floor = null, { openReports = true } = {}) {
  if (!location || !subLocation) return;
  state.selectedBox = location.id;
  state.expandedBox = location.id;
  state.selectedZone = location.id;
  state.selectedLocation = location.id;
  state.selectedFloor = floor
    ? { locationId: location.id, id: floor.id, label: floor.label }
    : null;
  state.selectedSubLocation = {
    locationId: location.id,
    floorId: floor?.id || "",
    id: subLocation.id,
    label: subLocation.label,
  };
  state.expandedMapTarget = null;
  resetMapCamera();
  setActiveLocationFilter(locationSubLocationPath(location, subLocation, floor), {
    load: !mapReportContextActive(),
    focusDashboard: false,
    closeDrawer: false,
    source: "map",
  });
  assignReportLocationFromSelection();
  triggerHaptic("selection");
  renderSchoolMap();
  if (openReports) {
    openReportsForSelectedMapLocation();
  }
}

function selectMapTerminalTarget(target) {
  if (!target?.location) return;
  if (target.type === "location") {
    selectMapStandaloneLocation(target.location);
    return;
  }
  if (target.type === "floor") {
    selectMapFloor(target.location, target.floor);
    return;
  }
  selectMapSubLocation(target.location, target.subLocation, target.floor || null);
}

function clearMapNavigation({ clearFilter = true } = {}) {
  state.selectedZone = null;
  state.selectedLocation = null;
  state.selectedBox = null;
  state.expandedBox = null;
  state.selectedFloor = null;
  state.selectedSubLocation = null;
  state.expandedMapTarget = null;
  resetMapCamera();
  if (clearFilter && !mapReportContextActive()) {
    setActiveLocationFilter("", { load: true, focusDashboard: false, closeDrawer: false, source: "map" });
  }
  renderSchoolMap();
}

function createRecentMapItemPreview(item) {
  const node = document.createElement("button");
  node.className = "map-preview-item";
  node.type = "button";
  node.textContent = item.title || item.category || "Recent item";
  node.addEventListener("click", () => navigateTo("query", item.id || null));
  return node;
}

function currentHeatmapEntities() {
  const location = selectedSchoolLocation();
  const floor = selectedSchoolFloor();
  if (location && floor) {
    const rooms = floor.subLocations || [];
    if (!rooms.length) {
      return [{
        id: `${location.id}-${floor.id}`,
        label: locationFloorPath(location, floor),
        region: regionForFloor(location, floor),
        stats: schoolFloorStats(location, floor),
        location,
        floor,
      }];
    }
    return rooms.map((room) => ({
      id: `${location.id}-${floor.id}-${room.id}`,
      label: locationSubLocationPath(location, room, floor),
      region: regionForFloorRoom(location, floor, room),
      stats: schoolSubLocationStats(location, room, floor),
      location,
      floor,
      subLocation: room,
    }));
  }
  if (locationHasFloors(location)) {
    return location.floors
      .map((floor) => {
        const label = validFloorLabelForLocation(location, floor);
        if (!label) return null;
        return {
          id: `${location.id}-${floor.id}`,
          label: locationFloorPath(location, floor),
          region: regionForFloor(location, floor),
          stats: schoolFloorStats(location, floor),
          location,
          floor: { ...floor, label },
        };
      })
      .filter(Boolean);
  }
  if (location && directSubLocationsForLocation(location).length) {
    return directSubLocationsForLocation(location).map((subLocation) => ({
      id: `${location.id}-${subLocation.id}`,
      label: locationSubLocationPath(location, subLocation),
      region: regionForDirectSubLocation(location, subLocation),
      stats: schoolSubLocationStats(location, subLocation),
      location,
      subLocation,
    }));
  }
  if (location) {
    return [{
      id: location.id,
      label: schoolLocationDisplayName(location),
      region: primaryRegionForLocation(location),
      stats: schoolLocationStats(location),
      location,
    }];
  }
  return collisionSafeMapTargets(state.locations.map((zoneLocation) => ({
    id: zoneLocation.id,
    label: schoolLocationDisplayName(zoneLocation),
    region: primaryRegionForLocation(zoneLocation),
    stats: schoolLocationStats(zoneLocation),
    location: zoneLocation,
  })));
}

function currentHeatmapMaxCount() {
  return currentHeatmapEntities().reduce((maxCount, entity) => Math.max(maxCount, entity.stats?.item_count || 0), 0);
}

function createMapTextHitElement(target) {
  const { region, location, label = "", onClick } = target;
  const stats = schoolLocationStats(location);
  const expanded = state.expandedBox === location.id;
  const heatClass = heatToneForCount(stats.item_count, maxLocationReportCount());
  const box = document.createElement("div");
  box.className = "map-region-box";
  if (heatClass) box.classList.add(heatClass);
  box.dataset.locationId = location.id;
  box.dataset.locationFilter = schoolLocationFilterValue(location);
  box.setAttribute("role", "button");
  box.setAttribute("tabindex", "0");
  box.setAttribute("aria-expanded", String(expanded));
  box.setAttribute("aria-label", `${label || schoolLocationDisplayName(location)}: ${stats.item_count} reports`);
  box.classList.toggle("is-active", state.selectedBox === location.id);
  box.classList.toggle("is-expanded", expanded);
  styleMapBox(box, region);

  box.addEventListener("pointerenter", (event) => showMapLocationTooltip({ location, label }, event));
  box.addEventListener("pointermove", (event) => positionMapTooltip(schoolMapTooltip, schoolMapShell, event));
  box.addEventListener("pointerleave", () => hideMapTooltip(schoolMapTooltip));
  box.addEventListener("click", (event) => {
    if (typeof onClick === "function") onClick();
  });
  box.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (typeof onClick === "function") onClick();
  });
  return box;
}

function mapTextHitTargets() {
  return state.locations.map((zoneLocation) => ({
    location: zoneLocation,
    label: schoolLocationDisplayName(zoneLocation),
    region: primaryRegionForLocation(zoneLocation),
    onClick: () => selectMapZone(zoneLocation),
  }));
}

function renderMapTextHitLayer() {
  if (!schoolMapTextLayer) return;
  schoolMapTextLayer.replaceChildren();
  mapTextHitTargets().forEach((target) => {
    schoolMapTextLayer.append(createMapTextHitElement(target));
  });
  syncLocationBrowserState();
}

function renderMapOverlay() {
  renderMapTextHitLayer();
}

function renderMapBreadcrumb() {
  if (!mapSelectionBreadcrumb) return;
  const structured = structuredLocationFromSelection();
  mapSelectionBreadcrumb.textContent = structured?.label || "Campus";
}

function appendMapPreview(panel, location, { floor = null, subLocation = null } = {}) {
  const previewTitle = document.createElement("span");
  previewTitle.className = "map-preview-title";
  previewTitle.textContent = subLocation ? "Reported items" : "Recent items";
  const previewList = document.createElement("div");
  previewList.className = "map-preview-list";
  const recentItems = subLocation
    ? itemsForSubLocation(location, subLocation, floor)
      .slice()
      .sort((a, b) => {
        const left = dateFromItem(a)?.getTime() || 0;
        const right = dateFromItem(b)?.getTime() || 0;
        return right - left;
      })
    : floor
      ? recentItemsForFloor(location, floor)
      : recentItemsForSchoolLocation(location);
  if (recentItems.length) {
    recentItems.forEach((item) => previewList.append(createRecentMapItemPreview(item)));
  } else {
    const empty = document.createElement("span");
    empty.className = "map-preview-empty";
    empty.textContent = subLocation ? "No reports in this room" : "No recent items";
    previewList.append(empty);
  }
  panel.append(previewTitle, previewList);
}

function reportCountLabel(count) {
  return `${count} report${count === 1 ? "" : "s"}`;
}

function latestMapItemForStats(stats = {}) {
  return Array.isArray(stats.recent_items) && stats.recent_items.length ? stats.recent_items[0] : null;
}

function latestMapImageItemForStats(stats = {}) {
  return stats.latest_image_item || (
    Array.isArray(stats.recent_items)
      ? stats.recent_items.find((item) => canPreviewImage(mapItemImageSource(item)))
      : null
  );
}

function mapItemImageSource(item) {
  return item ? (state.previewUrls.get(item.id) || resolveImageUrl(item)) : "";
}

function createMapPreviewMedia(item, { interactive = true } = {}) {
  const source = mapItemImageSource(item);
  if (canPreviewImage(source)) {
    if (interactive) {
      const thumbnail = createThumbnailButton(source, {
        title: item?.title || "Latest report image",
        caption: item?.description || "",
      });
      thumbnail?.classList.add("map-preview-thumbnail");
      return thumbnail;
    }
    const image = document.createElement("img");
    image.className = "map-preview-thumbnail-image";
    image.src = source;
    image.alt = item?.title || "Latest report image";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove(), { once: true });
    return image;
  }
  const placeholder = document.createElement("div");
  placeholder.className = "map-preview-thumbnail-placeholder";
  placeholder.textContent = item ? "No image" : "No reports yet";
  return placeholder;
}

function createMapSelectionPreviewCard(target, heatMax) {
  const stats = target.stats || mapLocationTargetStats(target);
  const latestItem = latestMapItemForStats(stats);
  const displayItem = latestMapImageItemForStats(stats) || latestItem;
  const heatClass = heatToneForCount(stats.item_count || 0, heatMax);
  const card = document.createElement("article");
  card.className = "map-selection-card";
  if (heatClass) card.classList.add(heatClass);

  const media = createMapPreviewMedia(displayItem, { interactive: Boolean(displayItem) });
  media.classList.add("map-selection-card-media");

  const selectButton = document.createElement("button");
  selectButton.className = "map-selection-card-main";
  selectButton.type = "button";
  selectButton.setAttribute("aria-label", `${target.path}: ${reportCountLabel(stats.item_count || 0)}`);
  selectButton.classList.toggle("is-active", selectedTerminalKeyForLocation(target.location) === target.key);
  selectButton.addEventListener("click", () => selectMapTerminalTarget(target));

  const title = document.createElement("strong");
  title.textContent = target.label;
  const latestLabel = document.createElement("span");
  latestLabel.className = "map-selection-latest-label";
  latestLabel.textContent = "Latest:";
  const latest = document.createElement("span");
  latest.className = "map-selection-latest";
  latest.textContent = latestItem?.title || latestItem?.category || "No reports yet";
  const count = document.createElement("span");
  count.className = "map-selection-count";
  count.textContent = reportCountLabel(stats.item_count || 0);
  selectButton.append(title, latestLabel, latest, count);

  card.append(media, selectButton);
  return card;
}

function renderMapSelectionPanel() {
  if (!mapSelectionPanel) return;
  mapSelectionPanel.replaceChildren();
  const location = selectedSchoolLocation();
  if (!location || state.expandedBox !== location.id) {
    mapSelectionPanel.classList.add("is-hidden");
    return;
  }

  const targets = terminalTargetsForLocation(location);
  const head = document.createElement("div");
  head.className = "map-selection-panel-head";
  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Location";
  const title = document.createElement("strong");
  title.textContent = schoolLocationDisplayName(location);
  titleWrap.append(eyebrow, title);

  const closeButton = document.createElement("button");
  closeButton.className = "icon-button map-location-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close location selection");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    state.expandedBox = null;
    state.selectedBox = null;
    renderSchoolMap();
  });
  head.append(titleWrap, closeButton);

  const list = document.createElement("div");
  list.className = "map-selection-card-list";
  if (targets.length) {
    const heatMax = maxTerminalReportCount(location);
    targets.forEach((target) => list.append(createMapSelectionPreviewCard(target, heatMax)));
  } else {
    const empty = document.createElement("span");
    empty.className = "map-preview-empty";
    empty.textContent = "No reports yet";
    list.append(empty);
  }

  mapSelectionPanel.append(head, list);
  mapSelectionPanel.classList.remove("is-hidden");
}

function renderSchoolMap() {
  setMapImageSource(schoolMapImage);
  renderMapBreadcrumb();
  renderMapOverlay();
  renderMapFocus();
  renderMapSelectionPanel();
  applyMapCamera();
}

function syncMapSelectionFromFilter() {
  const location = selectedSchoolLocation();
  if (location) {
    const focusRegion = focusedMapRegion() || primaryRegionForLocation(location);
    focusCameraOnRegion(focusRegion);
  } else {
    resetMapCamera();
  }
}

function noopMapEditorCall() {}

function mapPointFromClient(shell, event) {
  const rect = shell?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return { x: 0, y: 0 };
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

function normalizeRegionBox(box) {
  const x1 = Math.min(box.x, box.x + box.width);
  const y1 = Math.min(box.y, box.y + box.height);
  const x2 = Math.max(box.x, box.x + box.width);
  const y2 = Math.max(box.y, box.y + box.height);
  const x = Math.min(1, Math.max(0, x1));
  const y = Math.min(1, Math.max(0, y1));
  return {
    x,
    y,
    width: Math.min(1 - x, Math.max(0, x2 - x)),
    height: Math.min(1 - y, Math.max(0, y2 - y)),
  };
}

function styleRegionElement(element, region) {
  styleMapBox(element, region);
}

function createMapRegionElement(region) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "map-region-box";
  element.dataset.regionId = region.id || "";
  element.dataset.zone = region.zone || "";
  element.setAttribute("aria-label", region.label || region.zone || "Map region");
  styleRegionElement(element, region);
  return element;
}

function visibleMapRegions() {
  return [];
}

function renderMapZoneTabs() {}

function renderMapRegionStrip() {}

function renderMapOverlayForAdmin() {}

function versionedUploadUrl(url, version = Date.now()) {
  const rawUrl = normalizeImageUrl(url || MAP_IMAGE_URL) || MAP_IMAGE_URL;
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    parsed.searchParams.set(MAP_IMAGE_RELOAD_PARAM, String(version || Date.now()));
    if (rawUrl.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    const joiner = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${joiner}${MAP_IMAGE_RELOAD_PARAM}=${encodeURIComponent(String(version || Date.now()))}`;
  }
}

function syncMapImageAspect(image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return;
  const shell = image.closest(".school-map-shell");
  shell?.style.setProperty("--map-aspect-ratio", `${image.naturalWidth} / ${image.naturalHeight}`);
}

function setMapImageSource(image) {
  if (!image) return;
  const nextSrc = versionedUploadUrl(state.mapImageUrl, state.mapImageVersion);
  if (image.getAttribute("src") !== nextSrc) {
    image.src = nextSrc;
    return;
  }
  syncMapImageAspect(image);
}

function updateMapFilters() {
  state.filters = {
    ...state.filters,
    locations: campusLocationsFromMap(),
  };
  if (locationFilter) {
    fillSelect(locationFilter, state.filters.locations, true);
    syncLocationFilterSelect();
  }
}

async function loadMapSystem() {
  try {
    const data = await apiFetch("/map");
    state.mapImageUrl = data.image_url || MAP_IMAGE_URL;
    state.mapImageVersion = data.image_version || Date.now();
    state.loadingVideoUrl = data.loading_video_url || LOGIN_LOADING_VIDEO_URL;
    state.locations = normalizeSchoolLocations(Array.isArray(data.locations) && data.locations.length ? data.locations : SCHOOL_LOCATIONS);
    state.mapZones = uniqueValues([
      ...SCHOOL_ZONES,
      ...(Array.isArray(data.zones) ? data.zones : []),
    ]);
    state.mapRegions = [];
    state.mapStats = data.stats || { regions: {}, zones: {} };
    renderLocationBrowserTree();
    updateMapFilters();
    syncMapSelectionFromFilter();
    renderSchoolMap();
  } catch (error) {
    state.mapImageUrl = MAP_IMAGE_URL;
    state.mapImageVersion = Date.now();
    state.loadingVideoUrl = LOGIN_LOADING_VIDEO_URL;
    state.locations = normalizeSchoolLocations(SCHOOL_LOCATIONS);
    state.mapZones = [...SCHOOL_ZONES];
    state.mapRegions = [];
    state.mapStats = { regions: {}, zones: {} };
    renderLocationBrowserTree();
    syncMapSelectionFromFilter();
    renderSchoolMap();
    logClientError("loading map failed", error);
  }
}

function fillMapRegionZoneSelect() {}

function dashboardStats() {
  const now = new Date();
  const visibleItems = state.items.filter(itemMatchesActiveLocation);
  const visibleClaims = state.claims.filter((claim) => itemMatchesActiveLocation(claim));
  const visibleReturnedItems = state.returnedItems.filter(itemMatchesActiveLocation);
  const reportsToday = visibleItems.filter((item) => {
    const created = dateFromItem(item, ["created_at", "event_date"]);
    return isSameLocalDay(created, now);
  }).length;
  const reportsThisWeek = visibleItems.filter((item) => isWithinDays(dateFromItem(item, ["created_at", "event_date"]), 7, now)).length;
  const pendingClaims = visibleClaims.filter((claim) => String(claim.status || "").toLowerCase() === "pending").length;
  const returnedThisWeek = (currentLocationFilterValue() ? 0 : Number(state.statsSummary?.items_returned_this_week || 0))
    || visibleReturnedItems.filter((item) => isWithinDays(dateFromItem(item, ["returned_at", "updated_at", "created_at"]), 7, now)).length;
  const recoveredTotal = Math.max(
    visibleReturnedItems.length,
    visibleItems.filter((item) => item.claimed || String(item.status || "").toLowerCase() === "claimed").length,
  );
  const activeQueries = state.notifications.filter((notification) => {
    const eventType = String(notification.event_type || "").toLowerCase();
    return (eventType.includes("query") || eventType.includes("question")) && !notification.read;
  }).length;
  const approvedClaims = visibleClaims.filter((claim) => String(claim.status || "").toLowerCase() === "approved").length;
  const reviewedClaims = visibleClaims.filter((claim) => ["approved", "rejected"].includes(String(claim.status || "").toLowerCase())).length;
  const approvalRate = reviewedClaims ? Math.round((approvedClaims / reviewedClaims) * 100) : 0;
  const activeReports = visibleItems.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    return !item.claimed && !["claimed", "archived", "returned"].includes(status);
  }).length;
  return {
    reportsToday,
    reportsThisWeek,
    pendingClaims,
    returnedThisWeek,
    recoveredTotal,
    activeQueries,
    unreadNotifications: Number(state.unreadNotifications || 0),
    approvalRate,
    activeReports,
  };
}

function setDashboardText(element, value) {
  if (element) element.textContent = String(value);
}

function addDashboardActivity({ title, meta, badge, target, tone = "" }) {
  if (!dashboardActivityList) return;
  const item = document.createElement("button");
  item.className = `dashboard-activity-item ${tone}`.trim();
  item.type = "button";
  item.dataset.dashboardTarget = target || "reports";

  const copy = document.createElement("span");
  copy.className = "dashboard-activity-copy";
  const titleElement = document.createElement("strong");
  titleElement.textContent = title;
  const metaElement = document.createElement("span");
  metaElement.textContent = meta;
  copy.append(titleElement, metaElement);

  const badgeElement = document.createElement("span");
  badgeElement.className = "dashboard-activity-badge";
  badgeElement.textContent = badge;
  item.append(copy, badgeElement);
  item.addEventListener("click", () => navigateTo(item.dataset.dashboardTarget || "reports"));
  dashboardActivityList.append(item);
}

function addDashboardListItem(container, { title, meta, badge, target = "reports", itemId = null, imageUrl = "" }) {
  if (!container) return;
  const item = document.createElement("button");
  item.className = "dashboard-activity-item dashboard-list-item";
  item.type = "button";

  if (imageUrl) {
    const media = document.createElement("span");
    media.className = "dashboard-list-media";
    media.style.backgroundImage = `url("${imageUrl}")`;
    item.append(media);
  }

  const copy = document.createElement("span");
  copy.className = "dashboard-activity-copy";
  const titleElement = document.createElement("strong");
  titleElement.textContent = title;
  const metaElement = document.createElement("span");
  metaElement.textContent = meta;
  copy.append(titleElement, metaElement);

  const badgeElement = document.createElement("span");
  badgeElement.className = "dashboard-activity-badge";
  badgeElement.textContent = badge;
  item.append(copy, badgeElement);
  item.addEventListener("click", () => navigateTo(target, itemId));
  container.append(item);
}

function addDashboardEmptyItem(container, message) {
  if (!container) return;
  const empty = document.createElement("p");
  empty.className = "status-message dashboard-empty-message";
  empty.textContent = message;
  container.append(empty);
}

function renderDashboardRecentReports() {
  if (!dashboardRecentReportsList) return;
  dashboardRecentReportsList.replaceChildren();
  const reports = state.items
    .filter(itemMatchesActiveLocation)
    .slice()
    .sort((first, second) => Date.parse(second.created_at || second.event_date || "") - Date.parse(first.created_at || first.event_date || ""))
    .slice(0, 5);
  if (!reports.length) {
    addDashboardEmptyItem(dashboardRecentReportsList, langText({ en: "No recent reports yet.", "zh-CN": "暂无最近报告。", th: "ยังไม่มีรายงานล่าสุด" }));
    return;
  }
  reports.forEach((item) => {
    addDashboardListItem(dashboardRecentReportsList, {
      title: item.title || langText({ en: "Untitled report", "zh-CN": "未命名报告", th: "รายงานไม่มีชื่อ" }),
      meta: `${localizeValue(item.location || "")} - ${formatDateTime(item.created_at || item.event_date)}`,
      badge: itemStatusLabel(item),
      target: "reports",
      imageUrl: resolveImageUrl(item),
    });
  });
}

function renderDashboardRecentReturns() {
  if (!dashboardRecentReturnsList) return;
  dashboardRecentReturnsList.replaceChildren();
  const returns = state.returnedItems
    .filter(itemMatchesActiveLocation)
    .slice()
    .sort((first, second) => Date.parse(second.returned_at || second.updated_at || "") - Date.parse(first.returned_at || first.updated_at || ""))
    .slice(0, 5);
  if (!returns.length) {
    addDashboardEmptyItem(dashboardRecentReturnsList, langText({ en: "No returned items in this view.", "zh-CN": "此视图暂无归还物品。", th: "ยังไม่มีสิ่งของที่รับคืนในมุมมองนี้" }));
    return;
  }
  returns.forEach((item) => {
    addDashboardListItem(dashboardRecentReturnsList, {
      title: item.title || langText({ en: "Returned item", "zh-CN": "已归还物品", th: "สิ่งของที่รับคืนแล้ว" }),
      meta: `${localizeValue(item.location || "")} - ${formatDateTime(item.returned_at || item.updated_at)}`,
      badge: langText({ en: "Returned", "zh-CN": "已归还", th: "รับคืนแล้ว" }),
      target: "returned",
      imageUrl: resolveImageUrl(item),
    });
  });
}

function renderDashboardActivity(stats = dashboardStats()) {
  if (!dashboardActivityList) return;
  dashboardActivityList.replaceChildren();

  const personalActivities = state.activities.slice(0, 4);
  if (personalActivities.length) {
    personalActivities.forEach((activity) => {
      addDashboardActivity({
        title: activity.title || activityTitleForType(activity.type),
        meta: activity.detail || activity.stage || activityStatusCopy(activity.status),
        badge: activity.status === "running" ? `${Math.round(Number(activity.progress) || 0)}%` : activityStatusCopy(activity.status),
        target: activity.target || "dashboard",
        tone: activity.status === "complete" ? "is-green" : activity.status === "warning" ? "is-gold" : "",
      });
    });
    return;
  }

  if (!currentUserIsStudent() && stats.pendingClaims > 0) {
    addDashboardActivity({
      title: langText({ en: "Claims pending review", "zh-CN": "待审核认领", th: "คำขอรอตรวจสอบ" }),
      meta: langText({ en: "Review ownership evidence", "zh-CN": "审核所有权证据", th: "ตรวจสอบหลักฐานความเป็นเจ้าของ" }),
      badge: String(stats.pendingClaims),
      target: "claims",
      tone: "is-gold",
    });
  }

  if (!currentUserIsStudent() && stats.unreadNotifications > 0) {
    addDashboardActivity({
      title: t("notifications.title"),
      meta: langText({ en: "Unread school updates", "zh-CN": "未读校园更新", th: "อัปเดตที่ยังไม่ได้อ่าน" }),
      badge: String(stats.unreadNotifications),
      target: "notifications",
      tone: "is-green",
    });
  }

  addDashboardActivity({
    title: langText({ en: "No recent personal activity", "zh-CN": "暂无个人活动", th: "ยังไม่มีกิจกรรมของคุณ" }),
    meta: langText({ en: "Your reports, queries, and claims will appear here.", "zh-CN": "你的报告、查询和认领会显示在这里。", th: "รายงาน การค้นหา และคำขอของคุณจะแสดงที่นี่" }),
    badge: "0",
    target: currentUserIsStudent() ? "query" : "reports",
  });
}

function renderDashboard() {
  if (!dashboardSection) return;
  const stats = dashboardStats();
  setDashboardText(dashboardReportsToday, stats.reportsToday);
  setDashboardText(
    dashboardReportsTodayMeta,
    langText({
      en: `${stats.reportsThisWeek} this week`,
      "zh-CN": `本周 ${stats.reportsThisWeek}`,
      th: `${stats.reportsThisWeek} ในสัปดาห์นี้`,
    }),
  );
  setDashboardText(dashboardPendingClaims, stats.pendingClaims);
  setDashboardText(dashboardReturnedWeek, stats.returnedThisWeek);
  setDashboardText(dashboardRecoveredTotal, stats.recoveredTotal);
  setDashboardText(dashboardActiveQueries, stats.activeQueries);
  setDashboardText(dashboardNotifications, stats.unreadNotifications);
  setDashboardText(dashboardApprovalRate, `${stats.approvalRate}%`);
  setDashboardText(dashboardActiveReports, stats.activeReports);
  renderDashboardRecentReports();
  renderDashboardRecentReturns();
  renderDashboardActivity(stats);
  syncNavActivityIndicators(stats);
}

async function refreshCurrentView() {
  if (!state.user) return;
  if (state.currentView === "dashboard") {
    await Promise.all([
      loadItems(),
      loadClaims(),
      loadNotifications(),
      loadStatsSummary(),
      loadReturnedItems(),
    ]);
    renderDashboard();
    return;
  }
  if (state.currentView === "reports") {
    await loadItems();
    return;
  }
  if (state.currentView === "map") {
    await Promise.all([loadMapSystem(), loadItems()]);
    renderSchoolMap();
    return;
  }
  if (state.currentView === "room") {
    await loadRoomItems();
    return;
  }
  if (state.currentView === "returned") {
    await loadReturnedItems();
    return;
  }
  if (state.currentView === "claims") {
    await loadClaims();
    return;
  }
  if (state.currentView === "notifications") {
    await loadNotifications();
    return;
  }
  if (state.currentView === "query") {
    await loadQueryPage(state.currentQueryItem?.id || null);
    return;
  }
  if (state.currentView === "admin" && currentUserCanAdmin()) {
    await loadAdminSurface();
    return;
  }
  if (state.currentView === "account") {
    renderAccount();
  }
}

async function loadStatsSummary() {
  if (!state.user) return;
  try {
    const data = await apiFetch("/stats/summary");
    state.statsSummary = {
      items_returned_this_week: Number(data.items_returned_this_week || 0),
    };
    renderStatsSummary();
  } catch (error) {
    logClientError("loading stats summary failed", error);
  }
}

function stopNotificationPolling() {
  if (!state.notificationTimer) return;
  window.clearInterval(state.notificationTimer);
  state.notificationTimer = null;
}

function startNotificationPolling() {
  stopNotificationPolling();
  if (!state.user) return;
  state.notificationTimer = window.setInterval(() => {
    void loadNotifications();
  }, NOTIFICATION_POLL_INTERVAL_MS);
}

function roomItemTimestamp(item) {
  return formatDateTime(item.room_recorded_at || item.created_at || item.updated_at);
}

function renderRoomItems(items) {
  roomGallery.replaceChildren();
  roomCount.textContent = langText({
    en: `${items.length} item${items.length === 1 ? "" : "s"}`,
    "zh-CN": `${items.length} 个物品`,
    th: `${items.length} รายการ`,
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = langText({
      en: "No room items are visible right now.",
      "zh-CN": "目前招领室中没有可显示的物品。",
      th: "ขณะนี้ยังไม่มีสิ่งของในห้องของหาย",
    });
    roomGallery.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "room-card surface-card";

    const imageWrap = document.createElement("button");
    imageWrap.className = "room-card-image";
    imageWrap.type = "button";

    const image = document.createElement("img");
    const preview = state.previewUrls.get(item.id) || resolveImageUrl(item);
    if (canPreviewImage(preview)) {
      image.src = preview;
      image.alt = item.title || "Room item";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.remove();
        const placeholder = document.createElement("div");
        placeholder.className = "image-placeholder";
        placeholder.textContent = "Image unavailable";
        imageWrap.append(placeholder);
      }, { once: true });
      imageWrap.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "image-placeholder";
      placeholder.textContent = "Image unavailable";
      imageWrap.append(placeholder);
    }

    const body = document.createElement("div");
    body.className = "room-card-body";

    const title = document.createElement("strong");
    title.textContent = item.room_label || item.title || langText({ en: "Room item", "zh-CN": "招领室物品", th: "สิ่งของในห้องของหาย" });

    const meta = document.createElement("p");
    meta.className = "room-card-meta";
    meta.textContent = roomItemTimestamp(item);

    const tags = document.createElement("div");
    tags.className = "tag-row";
    renderTags(tags, item.tags || []);

    const action = document.createElement("button");
    action.className = "primary-button card-button";
    action.type = "button";
    action.textContent = langText({
      en: "Open visual claim",
      "zh-CN": "打开可视认领",
      th: "เปิดการยืนยันแบบภาพ",
    });
    action.addEventListener("click", () => openRoomClaimPreview(item));
    imageWrap.addEventListener("click", () => openRoomClaimPreview(item));

    body.append(title, meta, tags, action);
    card.append(imageWrap, body);
    roomGallery.append(card);
  });
}

async function loadRoomItems() {
  setLoadingLine(roomLoading, true);
  setWarningCard(roomWarningCard, "");
  try {
    const data = await apiFetch("/room/items");
    state.roomItems = data.items || [];
    if (typeof data.items_returned_this_week !== "undefined") {
      state.statsSummary.items_returned_this_week = Number(data.items_returned_this_week || 0);
      renderStatsSummary();
    }
    renderRoomItems(state.roomItems);
  } catch (error) {
    roomGallery.replaceChildren();
    setWarningCard(roomWarningCard, error.message);
    logClientError("loading room items failed", error);
  } finally {
    setLoadingLine(roomLoading, false);
  }
}

function renderReturnedItems(items) {
  returnedList.replaceChildren();
  returnedCount.textContent = langText({
    en: `${items.length} item${items.length === 1 ? "" : "s"}`,
    "zh-CN": `${items.length} 个物品`,
    th: `${items.length} รายการ`,
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = langText({
      en: "No items were returned recently.",
      "zh-CN": "最近还没有已归还物品。",
      th: "ยังไม่มีสิ่งของที่เพิ่งถูกรับคืน",
    });
    returnedList.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "claim-history-card returned-card";

    const preview = state.previewUrls.get(item.id) || resolveImageUrl(item);
    if (canPreviewImage(preview)) {
      const image = document.createElement("img");
      image.className = "returned-card-image";
      image.src = preview;
      image.alt = item.title || "Returned item";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => image.remove(), { once: true });
      image.style.cursor = "zoom-in";
      image.addEventListener("click", () => {
        openImagePreview(preview, item.title || "Returned item", item.description || "");
      });
      card.append(image);
    }

    const head = document.createElement("div");
    head.className = "claim-history-head";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.title || langText({ en: "Returned item", "zh-CN": "已归还物品", th: "สิ่งของที่ถูกรับคืน" });
    const meta = document.createElement("p");
    meta.className = "claim-history-meta";
    meta.textContent = langText({
      en: `Returned ${formatDateTime(item.returned_at || item.updated_at)}`,
      "zh-CN": `归还于 ${formatDateTime(item.returned_at || item.updated_at)}`,
      th: `รับคืน ${formatDateTime(item.returned_at || item.updated_at)}`,
    });
    titleWrap.append(title, meta);

    const badge = document.createElement("span");
    badge.className = "status-badge is-claimed";
    badge.textContent = langText({ en: "Returned", "zh-CN": "已归还", th: "รับคืนแล้ว" });
    head.append(titleWrap, badge);

    const info = document.createElement("dl");
    info.className = "info-list";
    addInfo(info, langText({ en: "Location", "zh-CN": "地点", th: "สถานที่" }), localizeValue(item.location || ""));
    addInfo(info, langText({ en: "Created", "zh-CN": "创建时间", th: "สร้างเมื่อ" }), formatDateTime(item.created_at));
    addInfo(info, langText({ en: "Returned", "zh-CN": "归还时间", th: "เวลาที่รับคืน" }), formatDateTime(item.returned_at));

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const disputeButton = document.createElement("button");
    disputeButton.className = "ghost-button card-button danger-button";
    disputeButton.type = "button";
    disputeButton.textContent = langText({
      en: "This was wrongly claimed",
      "zh-CN": "这件物品被错误认领",
      th: "สิ่งของนี้ถูกรับคืนผิดคน",
    });
    disputeButton.addEventListener("click", () => openConfirmModal({
      title: langText({ en: "Dispute returned item", "zh-CN": "提交归还争议", th: "โต้แย้งการรับคืน" }),
      body: langText({
        en: "Tell the admin team why this returned item may have been claimed incorrectly.",
        "zh-CN": "请说明为什么你认为这件已归还物品可能被错误认领。",
        th: "อธิบายให้ผู้ดูแลทราบว่าทำไมคุณคิดว่าสิ่งของนี้อาจถูกรับคืนผิดคน",
      }),
      confirmLabel: langText({ en: "Send dispute", "zh-CN": "发送争议", th: "ส่งคำโต้แย้ง" }),
      notesLabel: langText({ en: "Why this looks wrong", "zh-CN": "争议原因", th: "เหตุผลของคำโต้แย้ง" }),
      requireNotes: true,
      onConfirm: async (notes) => {
        try {
          const data = await apiFetch(`/items/${item.id}/returned-disputes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: notes }),
          });
          closeConfirmModal();
          setWarningCard(returnedWarningCard, "");
          await Promise.all([loadReturnedItems(), loadNotifications()]);
          setMessage(confirmMessage, "");
          setMessage(returnedMessage, data.message || "");
        } catch (error) {
          setMessage(confirmMessage, error.message, true);
          logClientError("submitting returned dispute failed", error, { itemId: item.id });
        }
      },
    }));
    actions.append(disputeButton);

    card.append(head, info, actions);
    returnedList.append(card);
  });
}

async function loadReturnedItems() {
  setLoadingLine(returnedLoading, true);
  setWarningCard(returnedWarningCard, "");
  setMessage(returnedMessage, "");
  try {
    const data = await apiFetch("/returned/items");
    state.returnedItems = data.items || [];
    if (typeof data.items_returned_this_week !== "undefined") {
      state.statsSummary.items_returned_this_week = Number(data.items_returned_this_week || 0);
      renderStatsSummary();
    }
    renderReturnedItems(filterByActiveLocation(state.returnedItems));
    renderDashboard();
  } catch (error) {
    returnedList.replaceChildren();
    setWarningCard(returnedWarningCard, error.message);
    logClientError("loading returned items failed", error);
  } finally {
    setLoadingLine(returnedLoading, false);
  }
}

async function refreshItemSurfaces({ includeAdmin = currentUserCanAdmin(), includeClaims = false, includeNotifications = false } = {}) {
  await Promise.all([
    loadItems(),
    loadRoomItems(),
    loadReturnedItems(),
    loadStatsSummary(),
    includeClaims ? loadClaims() : Promise.resolve(),
    includeNotifications ? loadNotifications() : Promise.resolve(),
    includeAdmin ? loadAdminData() : Promise.resolve(),
  ]);
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

  try {
    const suffix = params.toString();
    const cacheKey = suffix || "__all__";
    const cached = state.searchCache.get(cacheKey);
    const data = cached || await apiFetch(`/items${suffix ? `?${suffix}` : ""}`);
    state.searchCache.set(cacheKey, data);
    state.items = data.items || [];
    renderItems(filterByActiveLocation(state.items));
    renderDashboard();
    renderSchoolMap();
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
    resultCount.textContent = langText({ en: "0 reports", "zh-CN": "0 条报告", th: "0 รายงาน" });
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
    renderClaims(filterByActiveLocation(state.claims));
    syncClaimActivities(state.claims);
    renderDashboard();
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

function populateInlineClaimItemSelect(select, selectedId = null) {
  if (!select) return;
  select.replaceChildren(new Option(langText({
    en: "Select report",
    "zh-CN": "选择报告",
    th: "เลือกรายงาน",
  }), ""));
  const seen = new Set();
  [...(state.queryItems || []), ...(state.items || [])].forEach((item) => {
    if (!item?.id || item.claimed || item.claim_required === false || seen.has(item.id)) return;
    seen.add(item.id);
    const label = [item.title, localizeValue(item.location), `#${item.id}`].filter(Boolean).join(" • ");
    select.append(new Option(label, String(item.id)));
  });
  select.value = selectedId ? String(selectedId) : "";
}

async function submitClaimDraft(draft, button, itemId = null) {
  const draftId = draft?.draft_id || String(draft?.id || "").replace(/^draft-/, "");
  const selectedItemId = itemId || draft?.item_id || draft?.item?.id || null;
  if (!draftId) return;
  if (!selectedItemId) {
    setMessage(claimsLoading, langText({ en: "Choose a report before submitting this draft.", "zh-CN": "提交草稿前请先选择报告。", th: "กรุณาเลือกรายงานก่อนส่งแบบร่าง" }), true);
    return;
  }
  setButtonLoading(button, true);
  try {
    await apiFetch(`/claim-drafts/${draftId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: Number(selectedItemId) }),
    });
    triggerHaptic("success");
    invalidateSearchCache();
    await Promise.all([loadClaims(), loadNotifications(), loadReturnedItems(), loadStatsSummary()]);
  } catch (error) {
    setMessage(claimsLoading, error.message, true);
    logClientError("submitting claim draft failed", error, { draftId, itemId: selectedItemId });
  } finally {
    setButtonLoading(button, false);
  }
}

function renderItems(items) {
  gallery.replaceChildren();
  resultCount.textContent = langText({
    en: `${items.length} report${items.length === 1 ? "" : "s"}`,
    "zh-CN": `${items.length} 条报告`,
    th: `${items.length} รายงาน`,
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    const hasFilters = Boolean(searchInput.value.trim() || categoryFilter.value || statusFilter.value || currentLocationFilterValue());
    empty.textContent = hasFilters ? t("reports.emptyFiltered") : t("reports.emptyAll");
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
    const cardActions = card.querySelector(".card-actions");
    const claimButton = card.querySelector("[data-claim-button]");
    const openQueryButton = card.querySelector("[data-open-query-button]");
    const markClaimedButton = card.querySelector("[data-mark-claimed-button]");
    const preview = state.previewUrls.get(item.id) || resolveImageUrl(item);
    const primaryAiSummary = canPreviewImage(preview) ? aiAnalysisSummary(item) : analysisText(item.ai_summary);

    title.textContent = item.title || langText({ en: "Untitled item", "zh-CN": "未命名物品", th: "สิ่งของไม่มีชื่อ" });
    const reporterLine = document.createElement("span");
    reporterLine.className = "person-line";
    reporterLine.append(
      createMiniAvatar(item.reporter_identity || item.reporter_name || "Reporter", item.reporter_avatar_url || ""),
      document.createTextNode(primaryAiSummary || langText({
        en: `Evidence: ${item.evidence_summary || "Awaiting review"}`,
        "zh-CN": `证据：${item.evidence_summary || "等待审核"}`,
        th: `หลักฐาน: ${item.evidence_summary || "รอตรวจสอบ"}`,
      })),
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

    if (canPreviewImage(preview)) {
      image.src = preview;
      image.alt = item.title || "Uploaded item";
      imageFrame.classList.add("has-image");
      imageFrame.style.cursor = "zoom-in";
      imageFrame.addEventListener("click", () => {
        openImagePreview(preview, item.title || "Report image", item.description || "");
      });
      image.addEventListener("error", (event) => {
        logClientError("image failed to load", new Error("Image request failed"), {
          itemId: item.id,
          src: event.currentTarget?.src,
        });
        imageFrame.classList.remove("has-image");
        imageFrame.style.cursor = "";
      }, { once: true });
    }

    const aiAnalysisBlock = createAiAnalysisBlock(item);
    if (aiAnalysisBlock) {
      description.after(aiAnalysisBlock);
    }

    renderTags(tags, item.tags || []);
    addInfo(info, langText({ en: "Status", "zh-CN": "状态", th: "สถานะ" }), statusLabel);
    addInfo(info, langText({ en: "Claim Status", "zh-CN": "认领状态", th: "สถานะคำขอ" }), claimRequirementLabel(item.claim_required !== false));
    addInfo(info, langText({ en: "Reported by", "zh-CN": "报告人", th: "ผู้รายงาน" }), item.reporter_identity || item.reporter_name);
    addInfo(info, langText({ en: "Category", "zh-CN": "分类", th: "หมวดหมู่" }), localizeValue(item.category));
    addInfo(info, langText({ en: "Location", "zh-CN": "地点", th: "สถานที่" }), localizeValue(item.location));
    addInfo(info, langText({ en: "Date", "zh-CN": "日期", th: "วันที่" }), item.event_date);
    addInfo(info, langText({ en: "Evidence", "zh-CN": "证据", th: "หลักฐาน" }), item.evidence_validity);
    addInfo(info, langText({ en: "Review", "zh-CN": "审核", th: "การตรวจสอบ" }), item.review_status);
    addInfo(info, langText({ en: "Created", "zh-CN": "创建时间", th: "สร้างเมื่อ" }), formatDateTime(item.created_at));
    addInfo(info, langText({ en: "Genuine score", "zh-CN": "可信分数", th: "คะแนนความน่าเชื่อถือ" }), `${item.abuse_genuine_score ?? 0}/100`);
    addInfo(info, langText({ en: "Risk level", "zh-CN": "风险等级", th: "ระดับความเสี่ยง" }), item.effective_abuse_risk_level || item.abuse_risk_level);

    claimButton.disabled = item.claimed;
    if (item.claimed) {
      claimButton.textContent = langText({ en: "Already claimed", "zh-CN": "已被认领", th: "มีผู้รับคืนแล้ว" });
    } else if (item.claim_required === false) {
      claimButton.textContent = langText({ en: "Direct collection", "zh-CN": "直接领取", th: "รับได้โดยตรง" });
      claimButton.addEventListener("click", () => {
        const message = directCollectionMessage(item);
        setWarningCard(searchWarningCard, message);
        setMessage(uploadMessage, message);
      });
    } else {
      claimButton.textContent = langText({ en: "Claim Item", "zh-CN": "认领物品", th: "ยื่นคำขอรับคืน" });
      claimButton.addEventListener("click", () => openClaimDialog(item));
    }

    openQueryButton.addEventListener("click", () => navigateTo("query", item.id));

    if (currentUserCanManageItem(item)) {
      markClaimedButton.classList.remove("is-hidden");
      markClaimedButton.disabled = item.claimed;
      markClaimedButton.textContent = langText({ en: "Mark as Claimed", "zh-CN": "标记为已认领", th: "ทำเครื่องหมายว่ารับคืนแล้ว" });
      markClaimedButton.addEventListener("click", () => markItemClaimed(item.id, markClaimedButton));

      if (!item.claimed && cardActions) {
        const claimRequirementButton = document.createElement("button");
        claimRequirementButton.className = "ghost-button card-button";
        claimRequirementButton.type = "button";
        const nextClaimRequired = item.claim_required === false;
        claimRequirementButton.textContent = nextClaimRequired
          ? langText({ en: "Require claim", "zh-CN": "改为需要认领", th: "กำหนดให้ยื่นคำขอ" })
          : langText({ en: "Allow direct collection", "zh-CN": "允许直接领取", th: "อนุญาตให้รับโดยตรง" });
        claimRequirementButton.addEventListener("click", () => updateItemClaimRequirement(item.id, nextClaimRequired, claimRequirementButton));
        cardActions.append(claimRequirementButton);
      }
    } else {
      markClaimedButton.classList.add("is-hidden");
    }

    gallery.append(card);
  });
}

function renderClaims(claims) {
  claimsList.replaceChildren();
  claimsCount.textContent = langText({
    en: `${claims.length} claim${claims.length === 1 ? "" : "s"}`,
    "zh-CN": `${claims.length} 条认领`,
    th: `${claims.length} คำขอ`,
  });

  if (!claims.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = t("claims.empty");
    claimsList.append(empty);
    return;
  }

  claims.forEach((claim) => {
    const card = claimHistoryTemplate.content.cloneNode(true);
    const article = card.querySelector(".claim-history-card");
    const title = card.querySelector("h3");
    const meta = card.querySelector(".claim-history-meta");
    const status = card.querySelector(".status-badge");
    const reason = card.querySelector(".claim-history-reason");
    const info = card.querySelector(".info-list");
    const preview = resolveImageUrl(claim.item);
    const thumbnail = createThumbnailButton(preview, {
      title: claim.item?.title || "Claim item preview",
      caption: claim.item_description || "",
    });
    if (thumbnail) {
      thumbnail.classList.add("claim-history-preview");
      article?.prepend(thumbnail);
    }

    title.textContent = claim.is_draft
      ? (claim.title || claim.item?.title || langText({ en: "Claim draft", "zh-CN": "认领草稿", th: "แบบร่างคำขอ" }))
      : (claim.item?.title || langText({ en: "Unavailable item", "zh-CN": "不可用物品", th: "สิ่งของไม่พร้อมใช้งาน" }));
    meta.textContent = langText({
      en: `${claim.user_identity || "User"} • ${claim.is_draft ? "Draft saved" : "Submitted"} ${formatDateTime(claim.timestamp)}`,
      "zh-CN": `${claim.user_identity || "用户"} • ${claim.is_draft ? "草稿保存于" : "提交于"} ${formatDateTime(claim.timestamp)}`,
      th: `${claim.user_identity || "ผู้ใช้"} • ${claim.is_draft ? "บันทึกแบบร่างเมื่อ" : "ส่งเมื่อ"} ${formatDateTime(claim.timestamp)}`,
    });
    status.textContent = titleCase(claim.status);
    status.classList.add(statusBadgeClass(claim.status));
    reason.textContent = claim.claim_reason;

    addInfo(info, langText({ en: "Claimant", "zh-CN": "认领人", th: "ผู้ยื่นคำขอ" }), claim.user_identity || "");
    addInfo(info, langText({ en: "Reported", "zh-CN": "报告人", th: "ผู้รายงาน" }), claim.item?.reporter_identity || claim.item?.reporter_name || "");
    addInfo(info, langText({ en: "Lost at", "zh-CN": "丢失地点", th: "ทำหายที่" }), claim.lost_location);
    addInfo(info, langText({ en: "Description", "zh-CN": "描述", th: "คำอธิบาย" }), claim.item_description);
    addInfo(info, langText({ en: "ID info", "zh-CN": "识别信息", th: "ข้อมูลระบุตัวตน" }), claim.identifying_info);
    addInfo(info, langText({ en: "Updated", "zh-CN": "更新时间", th: "อัปเดตเมื่อ" }), formatDateTime(claim.updated_at));

    if (claim.is_draft) {
      const actions = document.createElement("div");
      actions.className = "card-actions";
      let attachSelect = null;
      if (!claim.item_id) {
        attachSelect = document.createElement("select");
        attachSelect.className = "inline-claim-select";
        populateInlineClaimItemSelect(attachSelect);
        actions.append(attachSelect);
      }
      const submitButton = document.createElement("button");
      submitButton.className = "primary-button card-button";
      submitButton.type = "button";
      submitButton.textContent = langText({ en: "Submit draft", "zh-CN": "提交草稿", th: "ส่งแบบร่าง" });
      submitButton.addEventListener("click", () => {
        void submitClaimDraft(claim, submitButton, attachSelect ? Number(attachSelect.value) || null : null);
      });
      const editButton = document.createElement("button");
      editButton.className = "ghost-button card-button";
      editButton.type = "button";
      editButton.textContent = langText({ en: "Open builder", "zh-CN": "打开构建器", th: "เปิดตัวสร้าง" });
      editButton.addEventListener("click", () => openClaimDialog(claim.item || null, null, claim));
      actions.append(submitButton, editButton);
      article?.append(actions);
    }

    claimsList.append(card);
  });
}

function renderAccount() {
  if (!state.user) return;

  applyAvatar(accountAvatar, accountAvatarSource(), userAvatarLabel(state.user));
  accountPageName.textContent = userDisplayName(state.user);
  accountPageIdentity.textContent = `@${state.user.username}`;
  accountAdminBadge.classList.toggle("is-hidden", !currentUserCanAdmin());

  accountInfoList.replaceChildren();
  addInfo(accountInfoList, langText({ en: "Role", "zh-CN": "角色", th: "บทบาท" }), currentUserIsStudent()
    ? langText({ en: "Student", "zh-CN": "学生", th: "นักเรียน" })
    : langText({ en: "Teacher", "zh-CN": "教师", th: "ครู" }));
  if (state.user.email) {
    addInfo(accountInfoList, langText({ en: "Email", "zh-CN": "邮箱", th: "อีเมล" }), state.user.email);
  }
  addInfo(accountInfoList, langText({ en: "Email status", "zh-CN": "邮箱状态", th: "สถานะอีเมล" }), (state.user.email_verified || state.user.email_verified_at)
    ? langText({ en: "Verified", "zh-CN": "已验证", th: "ยืนยันแล้ว" })
    : langText({ en: "Not verified", "zh-CN": "未验证", th: "ยังไม่ยืนยัน" }));
  addInfo(accountInfoList, langText({ en: "Initials", "zh-CN": "姓名缩写", th: "ชื่อย่อ" }), state.user.initials || "-");
  addInfo(accountInfoList, langText({ en: "Class of", "zh-CN": "毕业年份", th: "รุ่นจบ" }), state.user.class_of || "-");
  addInfo(accountInfoList, langText({ en: "Created", "zh-CN": "创建时间", th: "สร้างเมื่อ" }), formatDateTime(state.user.created_at));
  addInfo(accountInfoList, langText({ en: "Admin", "zh-CN": "管理员", th: "ผู้ดูแล" }), currentUserCanAdmin() ? t("common.yes") : t("common.no"));
  if (accountEmailInput && !state.accountEmailChangeSentAt && document.activeElement !== accountEmailInput) {
    accountEmailInput.value = state.user.email || "";
  }
  syncAccountEmailChangeUi();
  syncModeUi();
}

function accountEmailChangeValue() {
  return String(accountEmailInput?.value || "").trim().toLowerCase();
}

function resetAccountEmailChangeState({ keepMessage = false } = {}) {
  state.accountEmailChangeEmail = "";
  state.accountEmailChangeSentAt = 0;
  if (accountEmailCodeInput) accountEmailCodeInput.value = "";
  if (!keepMessage) setMessage(accountEmailMessage, "");
  syncAccountEmailChangeUi();
}

function syncAccountEmailChangeUi() {
  const email = accountEmailChangeValue();
  const currentEmail = String(state.user?.email || "").toLowerCase();
  const emailIsValid = authEmailLooksValid(email);
  const codeReady = String(accountEmailCodeInput?.value || "").replace(/\D/g, "").length === EMAIL_VERIFICATION_CODE_LENGTH;
  const changed = email && email !== currentEmail;
  if (accountEmailSendCodeButton) {
    accountEmailSendCodeButton.disabled = !emailIsValid || !changed;
    accountEmailSendCodeButton.textContent = state.accountEmailChangeSentAt ? t("auth.resendCode") : t("auth.sendCode");
  }
  if (accountEmailConfirmButton) {
    accountEmailConfirmButton.disabled = !emailIsValid || !changed || !codeReady || state.accountEmailChangeEmail !== email;
  }
}

async function requestAccountEmailChangeCode() {
  const email = accountEmailChangeValue();
  if (!authEmailLooksValid(email)) {
    setMessage(accountEmailMessage, langText({
      en: "Enter a valid email first.",
      "zh-CN": "请先输入有效邮箱。",
      th: "กรุณาใส่อีเมลที่ถูกต้องก่อน",
    }), true);
    return;
  }

  setButtonLoading(accountEmailSendCodeButton, true);
  setMessage(accountEmailMessage, langText({ en: "Sending code...", "zh-CN": "正在发送验证码...", th: "กำลังส่งรหัส..." }));
  try {
    const data = await apiFetch("/account/email/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    state.accountEmailChangeEmail = email;
    state.accountEmailChangeSentAt = Date.now();
    setMessage(accountEmailMessage, data.delivery === "development-log"
      ? (data.message || "Email delivery is not configured. Verification codes are currently being written to the development security log.")
      : langText({
          en: "Code sent. Check the new email address.",
          "zh-CN": "验证码已发送。请查看新邮箱。",
          th: "ส่งรหัสแล้ว โปรดตรวจอีเมลใหม่",
        }),
      data.delivery === "development-log");
    accountEmailCodeInput?.focus();
  } catch (error) {
    setMessage(accountEmailMessage, error.message, true);
    logClientError("account email verification request failed", error);
  } finally {
    setButtonLoading(accountEmailSendCodeButton, false);
    syncAccountEmailChangeUi();
  }
}

async function submitAccountEmailChange(event) {
  event.preventDefault();
  const email = accountEmailChangeValue();
  const code = String(accountEmailCodeInput?.value || "").replace(/\D/g, "");
  if (!authEmailLooksValid(email) || code.length !== EMAIL_VERIFICATION_CODE_LENGTH) {
    setMessage(accountEmailMessage, langText({
      en: "Enter the new email and 6-digit code.",
      "zh-CN": "请输入新邮箱和 6 位验证码。",
      th: "กรุณาใส่อีเมลใหม่และรหัส 6 หลัก",
    }), true);
    return;
  }

  setButtonLoading(accountEmailConfirmButton, true);
  setMessage(accountEmailMessage, langText({ en: "Verifying email...", "zh-CN": "正在验证邮箱...", th: "กำลังยืนยันอีเมล..." }));
  try {
    const data = await apiFetch("/account/email/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    state.user = applyFreshUser(data.user);
    resetAccountEmailChangeState({ keepMessage: true });
    renderCurrentAccountChip();
    renderAccount();
    setMessage(accountEmailMessage, langText({
      en: "Email updated.",
      "zh-CN": "邮箱已更新。",
      th: "อัปเดตอีเมลแล้ว",
    }));
  } catch (error) {
    setMessage(accountEmailMessage, error.message, true);
    logClientError("account email change failed", error);
  } finally {
    setButtonLoading(accountEmailConfirmButton, false);
    syncAccountEmailChangeUi();
  }
}

function renderAdminMonitor(monitor = state.adminMonitor || emptyAdminMonitor()) {
  const uptime = Number.isFinite(Number(monitor.uptime_seconds)) ? formatDuration(monitor.uptime_seconds) : "--";
  const ollama = monitor.ollama || emptyAdminMonitor().ollama;
  const models = Array.isArray(ollama.models) ? ollama.models : [];

  adminMonitorUptime.textContent = uptime;
  adminMonitorStatus.textContent = formatMonitorStatus(monitor.status);
  if (adminOllamaStatus) {
    adminOllamaStatus.textContent = ollama.available
      ? `Connected (${ollama.host || "configured host"})`
      : `Disconnected${ollama.host ? ` (${ollama.host})` : ""}`;
  }
  if (adminOllamaModels) {
    adminOllamaModels.textContent = models.length
      ? models.join(", ")
      : (ollama.available ? "No downloaded models detected" : "Unavailable");
  }

  if (monitor.fetched_at) {
    adminMonitorUpdated.textContent = langText({
      en: `Last refresh: ${formatDateTime(monitor.fetched_at)}`,
      "zh-CN": `上次刷新：${formatDateTime(monitor.fetched_at)}`,
      th: `รีเฟรชล่าสุด: ${formatDateTime(monitor.fetched_at)}`,
    });
  } else {
    adminMonitorUpdated.textContent = t("admin.monitorWaiting");
  }

  const warningMessage = ollama.available
    ? (ollama.text_ready ? "" : `Ollama is connected, but model "${ollama.text_model || "unconfigured"}" was not detected.`)
    : (ollama.message || "Ollama is disconnected. AI features will use safe fallbacks where available.");
  setWarningCard(adminMonitorWarning, warningMessage);
  renderAdminSmtpStatus();
}

function yesNo(value) {
  return value ? t("common.yes") : t("common.no");
}

function renderAdminSmtpStatus(status = state.smtpStatus || emptySmtpStatus()) {
  const configured = Boolean(status.configured);
  const connected = Boolean(status.connected);
  const deliveryMode = status.delivery_mode === "real-email" ? "Real Email" : "Development Log";
  const lastError = String(status.last_error || "").trim();
  const sender = String(status.sender || status.from_address || "").trim();
  if (adminSmtpStatus) {
    adminSmtpStatus.textContent = connected ? "Connected" : "Not Connected";
    adminSmtpStatus.classList.toggle("is-success", connected);
    adminSmtpStatus.classList.toggle("is-error", !connected);
  }
  if (adminSmtpDeliveryMode) {
    adminSmtpDeliveryMode.textContent = deliveryMode;
  }
  if (adminSmtpHostConfigured) adminSmtpHostConfigured.textContent = yesNo(configured);
  if (adminSmtpUsernameConfigured) adminSmtpUsernameConfigured.textContent = yesNo(status.username_configured);
  if (adminSmtpPasswordConfigured) adminSmtpPasswordConfigured.textContent = yesNo(status.password_configured);
  if (adminSmtpSender) adminSmtpSender.textContent = sender || "--";
  if (adminSmtpLastError) adminSmtpLastError.textContent = lastError || "None";
  setWarningCard(adminSmtpWarning, configured ? "" : "Email delivery is not configured. Verification codes are currently being written to the development security log.");
}

function resetAdminMonitor() {
  state.adminMonitor = emptyAdminMonitor();
  state.smtpStatus = emptySmtpStatus();
  renderAdminMonitor();
}

async function loadAdminMonitor() {
  if (!currentUserCanAdmin() || state.adminMonitorRequestInFlight) {
    return;
  }

  state.adminMonitorRequestInFlight = true;
  try {
    const [data, smtpData] = await Promise.all([
      apiFetch("/health/detailed"),
      apiFetch("/debug/smtp-status"),
    ]);
    state.adminMonitor = {
      ...emptyAdminMonitor(),
      ...data,
      fetched_at: new Date().toISOString(),
    };
    state.smtpStatus = {
      ...emptySmtpStatus(),
      ...smtpData,
    };
    renderAdminMonitor();
  } catch (error) {
    if (!state.adminMonitor) {
      resetAdminMonitor();
    }
    adminMonitorUpdated.textContent = langText({
      en: `System monitor unavailable: ${error.message}`,
      "zh-CN": `系统监控不可用：${error.message}`,
      th: `ไม่สามารถใช้งานการตรวจสอบระบบได้: ${error.message}`,
    });
    setWarningCard(adminMonitorWarning, adminMonitorUpdated.textContent);
    logClientError("loading admin monitor failed", error);
  } finally {
    state.adminMonitorRequestInFlight = false;
  }
}

async function sendAdminSmtpTestEmail(event) {
  event.preventDefault();
  if (!currentUserCanAdmin()) return;
  const email = String(adminSmtpTestEmail?.value || "").trim().toLowerCase();
  if (!authEmailLooksValid(email)) {
    setMessage(adminSmtpTestMessage, "Enter a valid test recipient email.", true);
    return;
  }

  setButtonLoading(adminSmtpTestButton, true);
  setMessage(adminSmtpTestMessage, "Sending SMTP test email...");
  try {
    const data = await apiFetch("/debug/smtp-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    state.smtpStatus = {
      ...emptySmtpStatus(),
      ...(data.config || {}),
    };
    renderAdminSmtpStatus();
    setMessage(adminSmtpTestMessage, data.success
      ? "SMTP test accepted by the mail server. Check the recipient inbox."
      : (data.error || data.message || "SMTP test failed."),
      !data.success);
  } catch (error) {
    setMessage(adminSmtpTestMessage, error.message, true);
    logClientError("smtp test failed", error);
  } finally {
    setButtonLoading(adminSmtpTestButton, false);
  }
}

async function updateOllamaService(action, button) {
  if (!currentUserCanAdmin()) return;
  setButtonLoading(button, true);
  setMessage(adminMessage, `${action === "start" ? "Starting" : "Stopping"} Ollama...`);
  try {
    const data = await apiFetch(`/admin/ollama/${action}`, { method: "POST" });
    setMessage(adminMessage, data.message || `Ollama ${action} request completed.`);
    await loadAdminMonitor();
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError(`ollama ${action} failed`, error);
  } finally {
    setButtonLoading(button, false);
  }
}

function stopAdminMonitorPolling() {
  if (!state.adminMonitorTimer) {
    return;
  }
  window.clearInterval(state.adminMonitorTimer);
  state.adminMonitorTimer = null;
}

function startAdminMonitorPolling() {
  if (!currentUserCanAdmin() || state.currentView !== "admin") {
    stopAdminMonitorPolling();
    return;
  }
  stopAdminMonitorPolling();
  state.adminMonitorTimer = window.setInterval(() => {
    void loadAdminMonitor();
  }, ADMIN_MONITOR_POLL_INTERVAL_MS);
}

function updateAdminSummary() {
  if (state.adminTab === "users") {
    adminSummary.textContent = langText({
      en: `${state.adminUsers.length} user${state.adminUsers.length === 1 ? "" : "s"}`,
      "zh-CN": `${state.adminUsers.length} 位用户`,
      th: `${state.adminUsers.length} ผู้ใช้`,
    });
    return;
  }
  if (state.adminTab === "items") {
    adminSummary.textContent = langText({
      en: `${state.adminItems.length} item${state.adminItems.length === 1 ? "" : "s"}`,
      "zh-CN": `${state.adminItems.length} 个物品`,
      th: `${state.adminItems.length} รายการ`,
    });
    return;
  }
  if (state.adminTab === "claims") {
    adminSummary.textContent = langText({
      en: `${state.adminClaims.length} claim${state.adminClaims.length === 1 ? "" : "s"}`,
      "zh-CN": `${state.adminClaims.length} 条认领`,
      th: `${state.adminClaims.length} คำขอ`,
    });
    return;
  }
  if (state.adminTab === "inspection") {
    adminSummary.textContent = langText({
      en: `${state.adminAudits.length + state.aiInspectionLogs.length} audit and inspection record${state.adminAudits.length + state.aiInspectionLogs.length === 1 ? "" : "s"}`,
      "zh-CN": `${state.adminAudits.length + state.aiInspectionLogs.length} 条审计与检查记录`,
      th: `${state.adminAudits.length + state.aiInspectionLogs.length} รายการตรวจสอบและบันทึก`,
    });
    return;
  }
  adminSummary.textContent = langText({ en: "Live system feed", "zh-CN": "实时系统监控", th: "สถานะระบบแบบสด" });
}

function switchAdminTab(tab) {
  state.adminTab = tab;
  adminUsersTab.classList.toggle("is-active", tab === "users");
  adminItemsTab.classList.toggle("is-active", tab === "items");
  adminClaimsTab.classList.toggle("is-active", tab === "claims");
  adminInspectionTab.classList.toggle("is-active", tab === "inspection");
  adminMonitorTab.classList.toggle("is-active", tab === "monitor");
  adminUsersPanel.classList.toggle("is-hidden", tab !== "users");
  adminItemsPanel.classList.toggle("is-hidden", tab !== "items");
  adminClaimsPanel.classList.toggle("is-hidden", tab !== "claims");
  adminInspectionPanel.classList.toggle("is-hidden", tab !== "inspection");
  adminMonitorPanel.classList.toggle("is-hidden", tab !== "monitor");
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
    identityCell.textContent = `${user.identity || `${user.initials || "-"} / ${user.class_of || "-"}`} • ${langText({ en: "Trust", "zh-CN": "可信分数", th: "คะแนนความน่าเชื่อถือ" })} ${user.trust_score ?? 50}/100`;

    const roleCell = document.createElement("td");
    const schoolRole = String(user.role || "").toLowerCase() === "student"
      ? langText({ en: "Student", "zh-CN": "学生", th: "นักเรียน" })
      : langText({ en: "Teacher", "zh-CN": "教师", th: "ครู" });
    const roleSource = user.role_source === "assigned"
      ? langText({ en: "manual", "zh-CN": "手动", th: "กำหนดเอง" })
      : langText({ en: "auto", "zh-CN": "自动", th: "อัตโนมัติ" });
    roleCell.textContent = user.is_admin
      ? `${schoolRole} (${roleSource}) / ${langText({ en: "Admin", "zh-CN": "管理员", th: "ผู้ดูแล" })}`
      : `${schoolRole} (${roleSource})`;

    const createdCell = document.createElement("td");
    createdCell.textContent = formatDateTime(user.created_at) || "-";

    row.append(idCell, usernameCell, identityCell, roleCell, createdCell);

    const actions = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "admin-user-actions";

    const promoteButton = document.createElement("button");
    promoteButton.className = "ghost-button small-button";
    promoteButton.type = "button";
    promoteButton.textContent = langText({ en: "Promote", "zh-CN": "提升", th: "เลื่อนสิทธิ์" });
    promoteButton.disabled = Boolean(user.is_admin);
    promoteButton.addEventListener("click", () => handleAdminUserRoleAction(user, "promote"));

    const demoteButton = document.createElement("button");
    demoteButton.className = "ghost-button small-button";
    demoteButton.type = "button";
    demoteButton.textContent = langText({ en: "Demote", "zh-CN": "降级", th: "ลดสิทธิ์" });
    demoteButton.disabled = !user.is_admin || user.id === state.user?.id;
    demoteButton.addEventListener("click", () => handleAdminUserRoleAction(user, "demote"));

    const schoolRoleSelect = document.createElement("select");
    schoolRoleSelect.className = "admin-role-select";
    schoolRoleSelect.setAttribute("aria-label", "School role");
    [
      ["auto", `Auto (${String(user.auto_detected_role || "teacher") === "student" ? "Student" : "Teacher"})`],
      ["student", "Student"],
      ["teacher", "Teacher"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      schoolRoleSelect.append(option);
    });
    schoolRoleSelect.value = user.assigned_role || "auto";
    schoolRoleSelect.addEventListener("change", () => handleAdminSchoolRoleChange(user, schoolRoleSelect.value, schoolRoleSelect));

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button small-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = langText({ en: "Delete", "zh-CN": "删除", th: "ลบ" });
    deleteButton.disabled = user.id === state.user?.id;
    deleteButton.addEventListener("click", () => handleAdminDelete({
      path: `/admin/users/${user.id}`,
      confirmationMessage: langText({
        en: `Delete user #${user.id}? This cannot be undone.`,
        "zh-CN": `删除用户 #${user.id}？此操作不可撤销。`,
        th: `ลบผู้ใช้ #${user.id} ใช่หรือไม่ การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      }),
    }));

    wrap.append(schoolRoleSelect, promoteButton, demoteButton, deleteButton);
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
    title.textContent = item.title || langText({ en: "Unavailable item", "zh-CN": "不可用物品", th: "สิ่งของไม่พร้อมใช้งาน" });
    const meta = document.createElement("p");
    meta.className = "admin-claim-meta";
    meta.textContent = `${localizeValue(item.category || t("common.category"))} • ${localizeValue(item.location || t("common.location"))} • ${formatDateTime(item.created_at)}`;
    headText.append(title, meta);

    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.classList.add(itemStatusClass(item));
    badge.textContent = item.status || (item.claimed ? "Claimed" : "Open");
    head.append(headText, badge);

    const description = document.createElement("p");
    description.className = "claim-history-reason";
    description.textContent = item.description || "";

    const info = document.createElement("dl");
    info.className = "info-list";
    addInfo(info, "ID", item.id);
    addInfo(info, langText({ en: "Claim Status", "zh-CN": "认领状态", th: "สถานะคำขอ" }), claimRequirementLabel(item.claim_required !== false));
    addInfo(info, langText({ en: "Reporter", "zh-CN": "报告人", th: "ผู้รายงาน" }), item.reporter_identity || item.reporter_name || "");
    addInfo(info, langText({ en: "Evidence", "zh-CN": "证据摘要", th: "สรุปหลักฐาน" }), item.evidence_summary || "");
    addInfo(info, langText({ en: "Missing info", "zh-CN": "缺失信息", th: "ข้อมูลที่ขาด" }), item.evidence_missing_info || "");
    addInfo(info, langText({ en: "Inconsistencies", "zh-CN": "矛盾点", th: "จุดไม่สอดคล้อง" }), item.evidence_inconsistencies || "");
    addInfo(info, langText({ en: "Validity", "zh-CN": "有效性", th: "ความน่าเชื่อถือ" }), item.evidence_validity || "");
    addInfo(info, langText({ en: "Review", "zh-CN": "审核状态", th: "การตรวจสอบ" }), item.review_status || "");
    addInfo(info, langText({ en: "Genuine score", "zh-CN": "可信分数", th: "คะแนนความน่าเชื่อถือ" }), `${item.abuse_genuine_score ?? 0}/100`);
    addInfo(info, langText({ en: "Risk level", "zh-CN": "风险等级", th: "ระดับความเสี่ยง" }), item.effective_abuse_risk_level || item.abuse_risk_level || "");
    addInfo(info, langText({ en: "Risk reasoning", "zh-CN": "风险说明", th: "เหตุผลของความเสี่ยง" }), item.abuse_reasoning || "");
    addInfo(info, langText({ en: "Admin override", "zh-CN": "管理员覆盖", th: "การแทนค่าผู้ดูแล" }), item.abuse_override_status || "-");
    addInfo(info, "AI analysis status", aiAnalysisStatus(item));
    addInfo(info, "LLaVA confidence", analysisConfidenceValue(item) ? `${analysisConfidenceValue(item)}%` : "Not provided");
    addInfo(info, langText({ en: "Tags", "zh-CN": "标签", th: "แท็ก" }), (item.tags || []).join(", "));

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const approveButton = document.createElement("button");
    approveButton.className = "primary-button card-button";
    approveButton.type = "button";
    approveButton.textContent = langText({ en: "Approve", "zh-CN": "通过", th: "อนุมัติ" });
    approveButton.addEventListener("click", () => handleAdminItemReview(item.id, "approved"));

    const rejectButton = document.createElement("button");
    rejectButton.className = "ghost-button card-button";
    rejectButton.type = "button";
    rejectButton.textContent = langText({ en: "Reject", "zh-CN": "拒绝", th: "ปฏิเสธ" });
    rejectButton.addEventListener("click", () => handleAdminItemReview(item.id, "rejected"));

    const incompleteButton = document.createElement("button");
    incompleteButton.className = "ghost-button card-button";
    incompleteButton.type = "button";
    incompleteButton.textContent = langText({ en: "Needs info", "zh-CN": "需补信息", th: "ต้องการข้อมูลเพิ่ม" });
    incompleteButton.addEventListener("click", () => handleAdminItemReview(item.id, "incomplete"));

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button card-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = langText({ en: "Delete item", "zh-CN": "删除物品", th: "ลบสิ่งของ" });
    deleteButton.addEventListener("click", () => handleAdminDelete({
      path: `/admin/items/${item.id}`,
      confirmationMessage: langText({
        en: `Delete report #${item.id}? You can undo this shortly.`,
        "zh-CN": `删除报告 #${item.id}？稍后可撤销。`,
        th: `ลบรายงาน #${item.id} ใช่หรือไม่ คุณสามารถเลิกทำได้ภายในช่วงสั้น ๆ`,
      }),
      undoMessage: langText({ en: "Report deleted.", "zh-CN": "报告已删除。", th: "ลบรายงานแล้ว" }),
      onUndo: async () => {
        await apiFetch(`/admin/items/${item.id}/restore`, { method: "POST" });
        hideUndoToast();
        invalidateSearchCache();
        await refreshItemSurfaces({ includeAdmin: true, includeNotifications: true });
      },
    }));

    const allowButton = document.createElement("button");
    allowButton.className = "ghost-button card-button";
    allowButton.type = "button";
    allowButton.textContent = langText({ en: "Mark safe", "zh-CN": "标记安全", th: "ทำเครื่องหมายว่าปลอดภัย" });
    allowButton.addEventListener("click", () => handleAdminAbuseOverride(item, "allow"));

    const flagButton = document.createElement("button");
    flagButton.className = "ghost-button card-button";
    flagButton.type = "button";
    flagButton.textContent = langText({ en: "Flag high risk", "zh-CN": "标记高风险", th: "ทำเครื่องหมายว่าเสี่ยงสูง" });
    flagButton.addEventListener("click", () => handleAdminAbuseOverride(item, "flag"));

    const clearButton = document.createElement("button");
    clearButton.className = "ghost-button card-button";
    clearButton.type = "button";
    clearButton.textContent = langText({ en: "Clear override", "zh-CN": "清除覆盖", th: "ล้างการแทนค่า" });
    clearButton.addEventListener("click", () => handleAdminAbuseOverride(item, ""));

    const roomButton = document.createElement("button");
    roomButton.className = "ghost-button card-button";
    roomButton.type = "button";
    roomButton.textContent = langText({ en: "Move to room", "zh-CN": "移到招领室", th: "ย้ายไปห้องของหาย" });
    roomButton.addEventListener("click", () => handleAdminMoveToRoom(item));

    const clearChatButton = document.createElement("button");
    clearChatButton.className = "ghost-button card-button danger-button";
    clearChatButton.type = "button";
    clearChatButton.textContent = langText({ en: "Clear questions", "zh-CN": "清空问题", th: "ล้างคำถาม" });
    clearChatButton.addEventListener("click", () => {
      state.currentQueryItem = item;
      clearCurrentQueryThread();
    });

    actions.append(approveButton, rejectButton, incompleteButton, allowButton, flagButton, clearButton, roomButton, clearChatButton, deleteButton);

    const preview = state.previewUrls.get(item.id) || resolveImageUrl(item);
    const thumbnail = createThumbnailButton(preview, {
      title: item.title || "Admin item preview",
      caption: item.description || "",
    });

    const body = document.createElement("div");
    body.className = thumbnail ? "panel-media-row" : "panel-meta-stack";
    const metaStack = document.createElement("div");
    metaStack.className = "panel-meta-stack";
    const aiAnalysisBlock = createAiAnalysisBlock(item, { heading: "LLaVA Analysis", includeStatus: true });
    metaStack.append(head, description);
    if (aiAnalysisBlock) {
      metaStack.append(aiAnalysisBlock);
    }
    metaStack.append(info, actions);

    if (thumbnail) {
      body.append(thumbnail, metaStack);
    } else {
      body.append(metaStack);
    }

    card.append(body);
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
    title.textContent = claim.item?.title || langText({ en: "Unavailable item", "zh-CN": "不可用物品", th: "สิ่งของไม่พร้อมใช้งาน" });
    const meta = document.createElement("p");
    meta.className = "admin-claim-meta";
    meta.textContent = langText({
      en: `User #${claim.user?.id || claim.user_id} • ${claim.user_identity || "User"} • Submitted ${formatDateTime(claim.timestamp)}`,
      "zh-CN": `用户 #${claim.user?.id || claim.user_id} • ${claim.user_identity || "用户"} • 提交于 ${formatDateTime(claim.timestamp)}`,
      th: `ผู้ใช้ #${claim.user?.id || claim.user_id} • ${claim.user_identity || "ผู้ใช้"} • ส่งเมื่อ ${formatDateTime(claim.timestamp)}`,
    });
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
    addInfo(info, langText({ en: "Initials", "zh-CN": "姓名缩写", th: "ชื่อย่อ" }), claim.user?.initials || "");
    addInfo(info, langText({ en: "Class of", "zh-CN": "毕业年份", th: "รุ่นจบ" }), claim.user?.class_of || "");
    addInfo(info, langText({ en: "Location", "zh-CN": "地点", th: "สถานที่" }), claim.lost_location);
    addInfo(info, langText({ en: "Item desc", "zh-CN": "物品描述", th: "คำอธิบายสิ่งของ" }), claim.item_description);
    addInfo(info, langText({ en: "ID info", "zh-CN": "识别信息", th: "ข้อมูลระบุตัวตน" }), claim.identifying_info);
    addInfo(info, langText({ en: "Match score", "zh-CN": "匹配分数", th: "คะแนนการจับคู่" }), `${claim.match_score ?? 0}/100`);
    addInfo(info, langText({ en: "Match reasoning", "zh-CN": "匹配说明", th: "เหตุผลของการจับคู่" }), claim.match_reasoning || "");
    addInfo(info, langText({ en: "Updated", "zh-CN": "更新时间", th: "อัปเดตเมื่อ" }), formatDateTime(claim.updated_at));

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const approveButton = document.createElement("button");
    approveButton.className = "primary-button card-button";
    approveButton.type = "button";
    approveButton.textContent = claim.status === "approved"
      ? langText({ en: "Approved", "zh-CN": "已通过", th: "อนุมัติแล้ว" })
      : langText({ en: "Approve", "zh-CN": "通过", th: "อนุมัติ" });
    const rejectButton = document.createElement("button");
    rejectButton.className = "ghost-button card-button";
    rejectButton.type = "button";
    rejectButton.textContent = claim.status === "rejected"
      ? langText({ en: "Rejected", "zh-CN": "已拒绝", th: "ปฏิเสธแล้ว" })
      : langText({ en: "Reject", "zh-CN": "拒绝", th: "ปฏิเสธ" });
    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button card-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = langText({ en: "Delete", "zh-CN": "删除", th: "ลบ" });

    const actionable = claim.status === "pending";
    approveButton.disabled = !actionable;
    rejectButton.disabled = !actionable;

    approveButton.addEventListener("click", () => handleAdminClaimDecision(claim.id, "approve", approveButton));
    rejectButton.addEventListener("click", () => handleAdminClaimDecision(claim.id, "reject", rejectButton));
    deleteButton.addEventListener("click", () => handleAdminDelete({
      path: `/admin/claims/${claim.id}`,
      confirmationMessage: langText({
        en: `Delete claim #${claim.id}?`,
        "zh-CN": `删除认领 #${claim.id}？`,
        th: `ลบคำขอ #${claim.id} ใช่หรือไม่`,
      }),
    }));
    actions.append(approveButton, rejectButton, deleteButton);

    const preview = resolveImageUrl(claim.item);
    const thumbnail = createThumbnailButton(preview, {
      title: claim.item?.title || "Claim item preview",
      caption: claim.item_description || "",
    });

    const body = document.createElement("div");
    body.className = thumbnail ? "panel-media-row" : "panel-meta-stack";
    const metaStack = document.createElement("div");
    metaStack.className = "panel-meta-stack";
    metaStack.append(head, reason, info, actions);

    if (thumbnail) {
      body.append(thumbnail, metaStack);
    } else {
      body.append(metaStack);
    }

    card.append(body);
    adminClaimsList.append(card);
  });
}

function renderAIInspection(logs) {
  adminInspectionList.replaceChildren();

  if (!logs.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = langText({ en: "No inspection records yet.", "zh-CN": "还没有检查记录。", th: "ยังไม่มีบันทึกการตรวจสอบ" });
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
    reason.className = "claim-history-reason log-summary-text";
    reason.textContent = log.input_text;

    const summaryActions = document.createElement("div");
    summaryActions.className = "log-summary-actions";

    const info = document.createElement("dl");
    info.className = "info-list log-scroll-region";
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
    promptLabel.textContent = langText({ en: "Prompt", "zh-CN": "原始提示", th: "พรอมป์ต์" });
    const promptText = document.createElement("pre");
    promptText.textContent = log.prompt_text || log.input_text || "";
    promptBlock.append(promptLabel, promptText);

    const outputBlock = document.createElement("div");
    outputBlock.className = "admin-debug-block";
    const outputLabel = document.createElement("strong");
    outputLabel.textContent = langText({ en: "Output", "zh-CN": "原始输出", th: "ผลลัพธ์" });
    const outputText = document.createElement("pre");
    outputText.textContent = log.output_text || log.raw_output || "";
    outputBlock.append(outputLabel, outputText);

    const details = document.createElement("div");
    details.className = "log-detail-region is-hidden";
    details.append(info, promptBlock, outputBlock);

    const detailsButton = createDetailsToggle(details);
    summaryActions.append(detailsButton);

    const preview = previewPayloadForRecord(log, log.route || "Inspection image");
    const thumbnail = preview
      ? createThumbnailButton(preview.src, { title: preview.title, caption: preview.caption })
      : null;

    const body = document.createElement("div");
    body.className = thumbnail ? "panel-media-row" : "panel-meta-stack";
    const metaStack = document.createElement("div");
    metaStack.className = "panel-meta-stack";
    metaStack.append(head, reason, summaryActions, details);

    if (thumbnail) {
      body.append(thumbnail, metaStack);
    } else {
      body.append(metaStack);
    }

    card.append(body);
    adminInspectionList.append(card);
  });
}

function renderAuditLogs(audits) {
  adminAuditList.replaceChildren();
  if (!audits.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = langText({ en: "No audit records yet.", "zh-CN": "还没有审计记录。", th: "ยังไม่มีบันทึกตรวจสอบ" });
    adminAuditList.append(empty);
    return;
  }

  audits.forEach((audit) => {
    const card = document.createElement("article");
    card.className = "admin-claim-card";
    const head = document.createElement("div");
    head.className = "admin-claim-head";
    const title = document.createElement("h4");
    title.textContent = audit.action_type || "-";
    const meta = document.createElement("p");
    meta.className = "admin-claim-meta";
    meta.textContent = `${audit.user_identity || "-"} • ${formatDateTime(audit.created_at)}`;
    const badge = document.createElement("span");
    badge.className = "status-badge is-safe";
    badge.textContent = audit.entity_type || "-";
    const textWrap = document.createElement("div");
    textWrap.append(title, meta);
    head.append(textWrap, badge);

    const summary = document.createElement("p");
    summary.className = "claim-history-reason log-summary-text";
    summary.textContent = `${audit.entity_type || "Entity"} #${audit.entity_id || "-"} updated`;

    const info = document.createElement("dl");
    info.className = "info-list log-scroll-region";
    addInfo(info, "Entity", `${audit.entity_type || "-"} #${audit.entity_id || "-"}`);
    addInfo(info, "Before", JSON.stringify(audit.before_state ?? null));
    addInfo(info, "After", JSON.stringify(audit.after_state ?? null));
    addInfo(info, "Metadata", JSON.stringify(audit.metadata || {}));

    const details = document.createElement("div");
    details.className = "log-detail-region is-hidden";
    details.append(info);

    const summaryActions = document.createElement("div");
    summaryActions.className = "log-summary-actions";
    summaryActions.append(createDetailsToggle(details));

    const preview = previewPayloadForRecord(audit, audit.action_type || "Audit image");
    const thumbnail = preview
      ? createThumbnailButton(preview.src, { title: preview.title, caption: preview.caption })
      : null;

    const body = document.createElement("div");
    body.className = thumbnail ? "panel-media-row" : "panel-meta-stack";
    const metaStack = document.createElement("div");
    metaStack.className = "panel-meta-stack";
    metaStack.append(head, summary, summaryActions, details);

    if (thumbnail) {
      body.append(thumbnail, metaStack);
    } else {
      body.append(metaStack);
    }

    card.append(body);
    adminAuditList.append(card);
  });
}

async function loadAdminData() {
  if (!currentUserCanAdmin()) {
    return;
  }

  setLoadingLine(adminLoading, true);
  setMessage(adminMessage, "");
  try {
    const [usersData, itemsData, claimsData, auditData, inspectionData] = await Promise.all([
      apiFetch("/admin/users"),
      apiFetch("/admin/items"),
      apiFetch("/admin/claims"),
      apiFetch("/admin/audit-logs"),
      apiFetch("/admin/ai-inspection"),
    ]);
    state.adminUsers = usersData.users || [];
    state.adminItems = itemsData.items || [];
    state.adminClaims = claimsData.claims || [];
    state.adminAudits = auditData.audits || [];
    state.aiInspectionLogs = inspectionData.logs || [];
    renderAdminUsers(state.adminUsers);
    renderAdminItems(state.adminItems);
    renderAdminClaims(state.adminClaims);
    renderAuditLogs(state.adminAudits);
    renderAIInspection(state.aiInspectionLogs);
    updateAdminSummary();
  } catch (error) {
    state.adminUsers = [];
    state.adminItems = [];
    state.adminClaims = [];
    state.adminAudits = [];
    state.aiInspectionLogs = [];
    setMessage(adminMessage, error.message, true);
    renderAdminUsers([]);
    renderAdminItems([]);
    renderAdminClaims([]);
    renderAuditLogs([]);
    renderAIInspection([]);
    updateAdminSummary();
    logClientError("loading admin data failed", error);
  } finally {
    setLoadingLine(adminLoading, false);
  }
}

async function loadAdminSurface() {
  if (!currentUserCanAdmin()) {
    return;
  }
  await Promise.all([loadAdminData(), loadAdminMonitor(), loadMapSystem()]);
  triggerHaptic("success");
}

function hideUndoToast() {
  if (state.undoTimer) {
    window.clearTimeout(state.undoTimer);
    state.undoTimer = null;
  }
  state.undoState = null;
  undoToast.classList.add("is-hidden");
}

function showUndoToast(message, onUndo) {
  hideUndoToast();
  state.undoState = typeof onUndo === "function" ? onUndo : null;
  undoToastText.textContent = message;
  undoToast.classList.remove("is-hidden");
  triggerHaptic("notification");
  state.undoTimer = window.setTimeout(hideUndoToast, 9000);
}

function closeConfirmModal() {
  state.confirmState = null;
  setMessage(confirmMessage, "");
  confirmNotesInput.value = "";
  confirmNotesWrap.classList.add("is-hidden");
  if (confirmDialog.open) {
    closeDialogWithAnimation(confirmDialog);
  }
}

function openConfirmModal({
  title,
  body,
  confirmLabel,
  notesLabel = "",
  notesValue = "",
  requireNotes = false,
  onConfirm,
}) {
  state.confirmState = {
    onConfirm,
    requireNotes,
  };
  confirmTitle.textContent = title;
  confirmBody.textContent = body;
  confirmActionLabel.textContent = confirmLabel || t("common.confirm");
  confirmNotesLabel.textContent = notesLabel || t("confirm.notes");
  confirmNotesInput.value = notesValue || "";
  confirmNotesWrap.classList.toggle("is-hidden", !requireNotes && !notesLabel);
  setMessage(confirmMessage, "");
  confirmDialog.classList.remove("is-closing");
  delete confirmDialog.dataset.closeToken;
  confirmDialog.showModal();
  triggerHaptic("open");
}

async function handleAdminClaimDecision(claimId, action, button) {
  const isApprove = action === "approve";
  openConfirmModal({
    title: langText({ en: isApprove ? "Approve claim" : "Reject claim", "zh-CN": isApprove ? "通过认领" : "拒绝认领", th: isApprove ? "อนุมัติคำขอ" : "ปฏิเสธคำขอ" }),
    body: langText({
      en: isApprove ? "Approve this claim and mark the item as claimed?" : "Reject this claim?",
      "zh-CN": isApprove ? "通过这条认领并将物品标记为已认领吗？" : "拒绝这条认领吗？",
      th: isApprove ? "ต้องการอนุมัติคำขอนี้และทำเครื่องหมายว่าสิ่งของถูกรับคืนแล้วหรือไม่" : "ต้องการปฏิเสธคำขอนี้หรือไม่",
    }),
    confirmLabel: langText({ en: isApprove ? "Approve" : "Reject", "zh-CN": isApprove ? "通过" : "拒绝", th: isApprove ? "อนุมัติ" : "ปฏิเสธ" }),
    onConfirm: async () => {
      setButtonLoading(button, true);
      setMessage(adminMessage, langText({
        en: isApprove ? "Approving claim..." : "Rejecting claim...",
        "zh-CN": isApprove ? "正在通过认领..." : "正在拒绝认领...",
        th: isApprove ? "กำลังอนุมัติคำขอ..." : "กำลังปฏิเสธคำขอ...",
      }));
      try {
        const data = await apiFetch(`/admin/claims/${claimId}/${action}`, { method: "POST" });
        closeConfirmModal();
        setMessage(adminMessage, data.message || langText({ en: "Claim updated.", "zh-CN": "认领已更新。", th: "อัปเดตคำขอแล้ว" }));
        triggerHaptic("success");
        showUndoToast(
          langText({ en: "Claim decision saved.", "zh-CN": "认领决定已保存。", th: "บันทึกผลคำขอแล้ว" }),
          async () => {
            await apiFetch(`/admin/claims/${claimId}/undo-decision`, { method: "POST" });
            hideUndoToast();
            invalidateSearchCache();
            await refreshItemSurfaces({ includeAdmin: true, includeClaims: true, includeNotifications: true });
          },
        );
        invalidateSearchCache();
        await refreshItemSurfaces({ includeAdmin: true, includeClaims: true, includeNotifications: true });
      } catch (error) {
        setMessage(adminMessage, error.message, true);
        setMessage(confirmMessage, error.message, true);
        logClientError("admin claim action failed", error, { claimId, action });
      } finally {
        setButtonLoading(button, false);
      }
    },
  });
}

async function handleAdminDelete({ path, confirmationMessage, undoMessage = "", onUndo = null }) {
  openConfirmModal({
    title: langText({ en: "Delete report", "zh-CN": "删除报告", th: "ลบรายงาน" }),
    body: confirmationMessage,
    confirmLabel: langText({ en: "Delete", "zh-CN": "删除", th: "ลบ" }),
    onConfirm: async () => {
      setMessage(adminMessage, langText({ en: "Deleting...", "zh-CN": "正在删除...", th: "กำลังลบ..." }));
      try {
        const data = await apiFetch(path, { method: "DELETE" });
        closeConfirmModal();
        setMessage(adminMessage, data.message || langText({ en: "Deleted.", "zh-CN": "已删除。", th: "ลบแล้ว" }));
        triggerHaptic("success");
        invalidateSearchCache();
        await refreshItemSurfaces({ includeAdmin: true, includeClaims: true, includeNotifications: true });
        if (onUndo) {
          showUndoToast(undoMessage || data.message || "", onUndo);
        }
      } catch (error) {
        setMessage(adminMessage, error.message, true);
        setMessage(confirmMessage, error.message, true);
        logClientError("admin delete failed", error, { path });
      }
    },
  });
}

async function handleAdminUserRoleAction(user, action) {
  const verb = action === "promote" ? "promote" : "demote";
  openConfirmModal({
    title: langText({ en: `${titleCase(verb)} user`, "zh-CN": action === "promote" ? "提升用户" : "降级用户", th: action === "promote" ? "เลื่อนสิทธิ์ผู้ใช้" : "ลดสิทธิ์ผู้ใช้" }),
    body: langText({
      en: `${titleCase(verb)} user #${user.id}?`,
      "zh-CN": `${action === "promote" ? "提升" : "取消"}用户 #${user.id} 的管理员权限？`,
      th: `${action === "promote" ? "เลื่อน" : "ลด"}สิทธิ์ผู้ใช้ #${user.id} ใช่หรือไม่`,
    }),
    confirmLabel: titleCase(verb),
    onConfirm: async () => {
      setMessage(adminMessage, langText({
        en: `${titleCase(verb)}ing user...`,
        "zh-CN": `${action === "promote" ? "正在提升" : "正在降级"}用户...`,
        th: `${action === "promote" ? "กำลังเลื่อน" : "กำลังลด"}สิทธิ์ผู้ใช้...`,
      }));
      try {
        const data = await apiFetch(`/admin/users/${user.id}/${action}`, { method: "POST" });
        closeConfirmModal();
        setMessage(adminMessage, data.message || langText({ en: `User ${verb}d.`, "zh-CN": `用户已${action === "promote" ? "提升" : "降级"}。`, th: "อัปเดตสิทธิ์ผู้ใช้แล้ว" }));
        triggerHaptic("success");
        await loadAdminData();
      } catch (error) {
        setMessage(adminMessage, error.message, true);
        setMessage(confirmMessage, error.message, true);
        logClientError("admin user role action failed", error, { userId: user.id, action });
      }
    },
  });
}

async function handleAdminSchoolRoleChange(user, role, select) {
  const previousValue = user.assigned_role || "auto";
  select.disabled = true;
  setMessage(adminMessage, "Updating school role...");
  try {
    const data = await apiFetch(`/admin/users/${user.id}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setMessage(adminMessage, data.message || "User role updated.");
    triggerHaptic("success");
    await loadAdminData();
    if (Number(user.id) === Number(state.user?.id)) {
      const sessionData = await apiFetch("/session");
      state.user = applyFreshUser(sessionData.user || state.user);
      syncModeUi({ navigateIfNeeded: true });
      renderCurrentAccountChip();
      renderAccount();
    }
  } catch (error) {
    select.value = previousValue;
    setMessage(adminMessage, error.message, true);
    logClientError("admin school role update failed", error, { userId: user.id, role });
  } finally {
    select.disabled = false;
  }
}

async function handleAdminItemReview(itemId, status) {
  openConfirmModal({
    title: langText({ en: "Update review", "zh-CN": "更新审核", th: "อัปเดตการตรวจสอบ" }),
    body: langText({
      en: `Save this item review as ${status}?`,
      "zh-CN": `将该物品的审核状态设为 ${status} 吗？`,
      th: `บันทึกสถานะการตรวจสอบเป็น ${status} ใช่หรือไม่`,
    }),
    confirmLabel: t("common.confirm"),
    notesLabel: t("confirm.notes"),
    requireNotes: true,
    onConfirm: async (notes) => {
      setMessage(adminMessage, langText({ en: `Updating item review to ${status}...`, "zh-CN": `正在更新审核状态为 ${status}...`, th: `กำลังอัปเดตสถานะเป็น ${status}...` }));
      try {
        const data = await apiFetch(`/admin/items/${itemId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, notes }),
        });
        closeConfirmModal();
        setMessage(adminMessage, data.message || langText({ en: "Item review updated.", "zh-CN": "物品审核已更新。", th: "อัปเดตการตรวจสอบแล้ว" }));
        triggerHaptic("success");
        invalidateSearchCache();
        await refreshItemSurfaces({ includeAdmin: true });
      } catch (error) {
        setMessage(adminMessage, error.message, true);
        setMessage(confirmMessage, error.message, true);
        logClientError("admin item review failed", error, { itemId, status });
      }
    },
  });
}

async function handleAdminAbuseOverride(item, status) {
  const previousStatus = item.abuse_override_status || "";
  const previousNotes = item.abuse_override_notes || "";
  openConfirmModal({
    title: langText({ en: "Confirm override", "zh-CN": "确认覆盖", th: "ยืนยันการแทนค่า" }),
    body: langText({
      en: "Save this abuse-risk override?",
      "zh-CN": "保存这项风险覆盖吗？",
      th: "ต้องการบันทึกการแทนค่านี้หรือไม่",
    }),
    confirmLabel: t("common.confirm"),
    notesLabel: t("confirm.notes"),
    notesValue: previousNotes,
    requireNotes: true,
    onConfirm: async (notes) => {
      setMessage(adminMessage, langText({ en: "Updating abuse override...", "zh-CN": "正在更新风险覆盖...", th: "กำลังอัปเดตการแทนค่า..." }));
      try {
        const data = await apiFetch(`/admin/items/${item.id}/abuse-override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, notes }),
        });
        closeConfirmModal();
        setMessage(adminMessage, data.message || langText({ en: "Abuse override updated.", "zh-CN": "风险覆盖已更新。", th: "อัปเดตการแทนค่าแล้ว" }));
        triggerHaptic("success");
        invalidateSearchCache();
        await refreshItemSurfaces({ includeAdmin: true, includeNotifications: true });
        showUndoToast(
          langText({ en: "Override saved.", "zh-CN": "覆盖已保存。", th: "บันทึกการแทนค่าแล้ว" }),
          async () => {
            await apiFetch(`/admin/items/${item.id}/abuse-override`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: previousStatus, notes: previousNotes }),
            });
            hideUndoToast();
            invalidateSearchCache();
            await refreshItemSurfaces({ includeAdmin: true, includeNotifications: true });
          },
        );
      } catch (error) {
        setMessage(adminMessage, error.message, true);
        setMessage(confirmMessage, error.message, true);
        logClientError("admin abuse override failed", error, { itemId: item.id, status });
      }
    },
  });
}

async function handleAdminMoveToRoom(item) {
  openConfirmModal({
    title: langText({ en: "Move to room", "zh-CN": "移至失物招领室", th: "ย้ายไปห้องของหาย" }),
    body: langText({
      en: "Move this report to the lost and found room?",
      "zh-CN": "将这条报告移到失物招领室吗？",
      th: "ต้องการย้ายรายงานนี้ไปห้องของหายและของพบหรือไม่",
    }),
    confirmLabel: t("common.confirm"),
    onConfirm: async () => {
      setMessage(adminMessage, langText({ en: "Moving report...", "zh-CN": "正在移动报告...", th: "กำลังย้ายรายงาน..." }));
      try {
        const data = await apiFetch(`/admin/items/${item.id}/move-to-room`, { method: "POST" });
        closeConfirmModal();
        setMessage(adminMessage, data.message || langText({ en: "Report moved.", "zh-CN": "报告已移动。", th: "ย้ายรายงานแล้ว" }));
        triggerHaptic("success");
        invalidateSearchCache();
        await refreshItemSurfaces({ includeAdmin: true, includeNotifications: true });
      } catch (error) {
        setMessage(adminMessage, error.message, true);
        setMessage(confirmMessage, error.message, true);
        logClientError("admin move to room failed", error, { itemId: item.id });
      }
    },
  });
}

function setQueryComposerEnabled(enabled, placeholder = "Ask about the selected item") {
  queryInput.disabled = !enabled;
  querySubmitButton.disabled = !enabled;
  queryFileInput.disabled = !enabled;
  if (queryCameraInput) queryCameraInput.disabled = !enabled;
  if (queryCameraButton) queryCameraButton.disabled = !enabled;
  if (queryCameraCaptureButton) queryCameraCaptureButton.disabled = !enabled;
  queryFileRemoveButton.disabled = !enabled;
  queryInput.placeholder = placeholder;
}

function renderQueryItemSelector(selectedItemId = null) {
  const previousValue = selectedItemId ? String(selectedItemId) : "";
  queryItemSelect.replaceChildren(new Option(t("query.generalInquiry"), ""));
  filterByActiveLocation(state.queryItems).forEach((item) => {
    const label = [item.title, localizeValue(item.category), localizeValue(item.location)].filter(Boolean).join(" • ");
    queryItemSelect.append(new Option(label || langText({ en: "Untitled report", "zh-CN": "未命名报告", th: "รายงานไม่มีชื่อ" }), String(item.id)));
  });
  queryItemSelect.value = previousValue;
}

function setCurrentQueryItem(item) {
  state.currentQueryItem = item || null;
  persistCurrentItemId(item?.id || null);
}

function clearQueryState() {
  stopQueryCamera();
  state.queryRequestToken = null;
  setCurrentQueryItem(null);
  state.queryMessages = [];
  state.queryStructuredResults = [];
  state.querySuggestions = [];
  queryInput.value = "";
  queryMessages.replaceChildren();
  questionThreadBody?.replaceChildren();
  questionThreadPanel?.classList.add("is-hidden");
  state.activeQuestionThread = null;
  queryItemTags.replaceChildren();
  querySuggestions.replaceChildren();
  querySuggestions.classList.add("is-hidden");
  clearSelectedQueryFile();
  setWarningCard(queryWarningCard, "");
  setMessage(queryMessage, "");
  setLoadingLine(queryLoading, false);
  if (state.progressActivityIds?.query) {
    queryProgress?.classList.add("is-hidden");
  } else {
    hideProgress("query");
  }
  renderQueryContextImage(null);
  syncQueryAdminActions();
}

function updateQueryEmptyState() {
  queryEmptyState.textContent = state.currentQueryItem ? t("query.emptyItem") : t("query.emptyGeneral");
}

function renderSelectedQueryFile() {
  const file = state.selectedQueryFile;
  queryFileInfo.classList.toggle("is-hidden", !file);
  queryFileName.textContent = file?.name || "";
  queryFileSize.textContent = file ? formatFileSize(file.size) : "";
}

function clearSelectedQueryFile() {
  state.selectedQueryFile = null;
  queryFileInput.value = "";
  if (queryCameraInput) {
    queryCameraInput.value = "";
  }
  renderSelectedQueryFile();
}

function selectQueryFile(file) {
  const validationError = validateChatFile(file);
  if (validationError) {
    clearSelectedQueryFile();
    setMessage(queryMessage, validationError, true);
    setWarningCard(queryWarningCard, validationError);
    return;
  }
  if (file) {
    stopQueryCamera();
  }
  state.selectedQueryFile = file || null;
  renderSelectedQueryFile();
  setMessage(queryMessage, "");
  setWarningCard(queryWarningCard, "");
}

function renderSelectedQuestionReplyFile() {
  const file = state.selectedQuestionReplyFile;
  questionReplyFileInfo?.classList.toggle("is-hidden", !file);
  if (questionReplyFileName) {
    questionReplyFileName.textContent = file ? `${file.name} (${formatFileSize(file.size)})` : "";
  }
}

function clearSelectedQuestionReplyFile() {
  state.selectedQuestionReplyFile = null;
  if (questionReplyFileInput) {
    questionReplyFileInput.value = "";
  }
  renderSelectedQuestionReplyFile();
}

function selectQuestionReplyFile(file) {
  const validationError = validateChatFile(file);
  if (validationError) {
    clearSelectedQuestionReplyFile();
    setMessage(questionReplyMessage, validationError, true);
    return;
  }
  state.selectedQuestionReplyFile = file || null;
  renderSelectedQuestionReplyFile();
  setMessage(questionReplyMessage, "");
}

function stopReportCamera() {
  if (state.reportCameraStream) {
    state.reportCameraStream.getTracks().forEach((track) => track.stop());
  }
  state.reportCameraStream = null;
  if (reportCameraPreview) {
    reportCameraPreview.pause?.();
    reportCameraPreview.srcObject = null;
  }
  reportCameraPanel?.classList.add("is-hidden");
}

async function openReportCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    reportCameraInput?.click();
    return;
  }
  try {
    stopReportCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    });
    state.reportCameraStream = stream;
    if (reportCameraPreview) {
      reportCameraPreview.srcObject = stream;
      await reportCameraPreview.play();
    }
    reportCameraPanel?.classList.remove("is-hidden");
    setMessage(uploadMessage, "");
    setWarningCard(reportWarningCard, "");
  } catch (error) {
    stopReportCamera();
    logClientError("opening report camera failed", error);
    reportCameraInput?.click();
  }
}

function reportCameraPhotoFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `report-photo-${stamp}.jpg`;
}

async function captureReportCameraPhoto() {
  if (!reportCameraPreview || !state.reportCameraStream) {
    reportCameraInput?.click();
    return;
  }
  const width = reportCameraPreview.videoWidth || 1280;
  const height = reportCameraPreview.videoHeight || 960;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not capture camera photo.");
  }
  context.drawImage(reportCameraPreview, 0, 0, width, height);
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.88);
  });
  if (!blob?.size) {
    throw new Error("Camera photo was empty.");
  }
  const file = new File([blob], reportCameraPhotoFilename(), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  selectFile(file);
  stopReportCamera();
  triggerHaptic("success");
}

function stopQueryCamera() {
  if (state.queryCameraStream) {
    state.queryCameraStream.getTracks().forEach((track) => track.stop());
  }
  state.queryCameraStream = null;
  if (queryCameraPreview) {
    queryCameraPreview.pause?.();
    queryCameraPreview.srcObject = null;
  }
  queryCameraPanel?.classList.add("is-hidden");
}

async function openQueryCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    queryCameraInput?.click();
    return;
  }
  try {
    stopQueryCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    });
    state.queryCameraStream = stream;
    if (queryCameraPreview) {
      queryCameraPreview.srcObject = stream;
      await queryCameraPreview.play();
    }
    queryCameraPanel?.classList.remove("is-hidden");
    setMessage(queryMessage, "");
    setWarningCard(queryWarningCard, "");
  } catch (error) {
    stopQueryCamera();
    logClientError("opening query camera failed", error);
    queryCameraInput?.click();
  }
}

function queryCameraPhotoFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `query-photo-${stamp}.jpg`;
}

async function captureQueryCameraPhoto() {
  if (!queryCameraPreview || !state.queryCameraStream) {
    queryCameraInput?.click();
    return;
  }
  const width = queryCameraPreview.videoWidth || 1280;
  const height = queryCameraPreview.videoHeight || 960;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not capture camera photo.");
  }
  context.drawImage(queryCameraPreview, 0, 0, width, height);
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.88);
  });
  if (!blob?.size) {
    throw new Error("Camera photo was empty.");
  }
  const file = new File([blob], queryCameraPhotoFilename(), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  selectQueryFile(file);
  stopQueryCamera();
  triggerHaptic("success");
}

function renderQuerySelectionState() {
  clearQueryState();
  queryItemSelect.value = "";
  queryItemTitle.textContent = t("query.generalInquiry");
  queryItemMeta.textContent = langText({
    en: "Ask about a lost item that has not been reported yet.",
    "zh-CN": "你可以咨询尚未上报的失物。",
    th: "คุณสามารถสอบถามเกี่ยวกับสิ่งของที่ยังไม่ได้ถูกรายงาน",
  });
  queryItemDescription.textContent = langText({
    en: "Use text, an uploaded image, or a camera photo to look for matching reports.",
    "zh-CN": "你可以使用文字、上传图片或相机照片查找匹配报告。",
    th: "ใช้ข้อความ รูปที่อัปโหลด หรือภาพจากกล้องเพื่อค้นหารายงานที่ตรงกัน",
  });
  queryItemStatus.textContent = langText({ en: "General", "zh-CN": "一般", th: "ทั่วไป" });
  queryItemStatus.className = "status-badge is-lost";
  renderQueryContextImage(null);
  syncQueryAdminActions();
  queryItemContextLabel.textContent = langText({ en: "General lookup results", "zh-CN": "一般查询结果", th: "ผลการค้นหาทั่วไป" });
  queryEmptyState.textContent = t("query.emptyGeneral");
  queryEmptyState.classList.remove("is-hidden");
  setQueryComposerEnabled(
    true,
    langText({
      en: "Ask about recent reports, locations, or lost items",
      "zh-CN": "询问最近的报告、地点或失物",
      th: "สอบถามเกี่ยวกับรายงานล่าสุด สถานที่ หรือของหาย",
    }),
  );
}

function renderQueryErrorState(message) {
  clearQueryState();
  queryItemTitle.textContent = langText({ en: "Item unavailable", "zh-CN": "物品不可用", th: "ไม่สามารถใช้งานสิ่งของนี้ได้" });
  queryItemMeta.textContent = langText({ en: "The selected item could not be loaded.", "zh-CN": "无法加载所选物品。", th: "ไม่สามารถโหลดสิ่งของที่เลือกได้" });
  queryItemDescription.textContent = "";
  queryItemStatus.textContent = langText({ en: "Error", "zh-CN": "错误", th: "ข้อผิดพลาด" });
  queryItemStatus.className = "status-badge is-flagged";
  queryItemContextLabel.textContent = langText({ en: "Lookup results", "zh-CN": "查询结果", th: "ผลการค้นหา" });
  queryEmptyState.textContent = langText({ en: "Select another item to continue.", "zh-CN": "请选择其他物品继续。", th: "กรุณาเลือกสิ่งของอื่นเพื่อดำเนินการต่อ" });
  queryEmptyState.classList.remove("is-hidden");
  setWarningCard(queryWarningCard, message);
  setMessage(queryMessage, message, true);
  setQueryComposerEnabled(false, langText({ en: "This item is unavailable", "zh-CN": "该物品不可用", th: "สิ่งของนี้ไม่พร้อมใช้งาน" }));
}

function tokenizeSuggestionText(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function addSuggestion(suggestions, text) {
  const value = String(text || "").trim();
  if (!value || suggestions.includes(value) || suggestions.length >= QUERY_SUGGESTION_LIMIT) {
    return;
  }
  suggestions.push(value);
}

function buildHeuristicSuggestions(item = null, messages = []) {
  try {
    const language = currentLanguage();
    const recentText = messages.slice(-4).map((entry) => entry?.message || "").join(" ");
    const tokens = new Set(tokenizeSuggestionText([
      recentText,
      item?.title,
      item?.category,
      item?.location,
      item?.description,
    ].filter(Boolean).join(" ")));
    const suggestions = [];

    if (item) {
      const itemLabel = item.title || (language === "zh-CN" ? "这个物品" : language === "th" ? "สิ่งของนี้" : "this item");
      addSuggestion(suggestions, language === "zh-CN" ? `${itemLabel}现在还在吗？` : language === "th" ? `${itemLabel} ยังอยู่ในระบบหรือไม่` : `Is ${itemLabel} still available?`);
      addSuggestion(suggestions, language === "zh-CN" ? `${itemLabel}最后记录的地点是哪里？` : language === "th" ? `${itemLabel} ถูกบันทึกสถานที่ล่าสุดไว้ที่ไหน` : `Where was ${itemLabel} last recorded?`);
      addSuggestion(suggestions, language === "zh-CN" ? "我需要提供哪些识别细节才能认领？" : language === "th" ? "ฉันควรให้รายละเอียดใดบ้างเพื่อยื่นคำขอรับคืน" : "What identifying details should I share to claim it?");
      addSuggestion(suggestions, language === "zh-CN" ? "这条报告是什么时候提交的？" : language === "th" ? "รายงานนี้ถูกส่งเมื่อใด" : "When was this report submitted?");
      addSuggestion(suggestions, language === "zh-CN" ? "这条记录里有没有额外证据或标记？" : language === "th" ? "รายงานนี้มีหลักฐานหรือจุดสังเกตเพิ่มเติมหรือไม่" : "Are there any extra evidence notes or markings on this report?");
      if (tokens.has("claim") || tokens.has("owner") || tokens.has("mine")) {
        addSuggestion(suggestions, language === "zh-CN" ? "认领审核通常需要多久？" : language === "th" ? "การตรวจสอบคำขอมักใช้เวลานานเท่าใด" : "How long does claim review usually take?");
      }
      return suggestions.slice(0, QUERY_SUGGESTION_LIMIT);
    }

    addSuggestion(suggestions, language === "zh-CN" ? "今天有哪些最新报告？" : language === "th" ? "วันนี้มีรายงานใหม่อะไรบ้าง" : "What are the newest reports today?");
    addSuggestion(suggestions, language === "zh-CN" ? "最近哪些地点的报告最多？" : language === "th" ? "ช่วงนี้สถานที่ใดมีรายงานมากที่สุด" : "Which locations have the most recent reports?");
    addSuggestion(suggestions, language === "zh-CN" ? "我该怎么认领一件物品？" : language === "th" ? "ฉันควรยื่นคำขอรับคืนสิ่งของอย่างไร" : "How do I claim an item?");
    addSuggestion(suggestions, language === "zh-CN" ? "有人上报了电子产品吗？" : language === "th" ? "มีการรายงานอุปกรณ์อิเล็กทรอนิกส์หรือไม่" : "Have any electronics been reported?");

    if (tokens.has("phone") || tokens.has("electronics")) {
      addSuggestion(suggestions, language === "zh-CN" ? "最近有手机或电子设备的记录吗？" : language === "th" ? "ช่วงนี้มีรายงานโทรศัพท์หรืออุปกรณ์อิเล็กทรอนิกส์หรือไม่" : "Are there any recent phone or electronics reports?");
    }
    if (tokens.has("wallet") || tokens.has("card") || tokens.has("id")) {
      addSuggestion(suggestions, language === "zh-CN" ? "最近有没有证件或卡片类物品？" : language === "th" ? "ช่วงนี้มีรายงานบัตรหรือเอกสารประจำตัวหรือไม่" : "Have any IDs or cards been reported recently?");
    }
    if (tokens.has("keys")) {
      addSuggestion(suggestions, language === "zh-CN" ? "最近有钥匙相关的报告吗？" : language === "th" ? "ช่วงนี้มีรายงานเกี่ยวกับกุญแจหรือไม่" : "Are there any recent reports about keys?");
    }
    if (tokens.has("library") || tokens.has("sports") || tokens.has("hall")) {
      addSuggestion(suggestions, language === "zh-CN" ? "这个地点最近还出现过哪些物品？" : language === "th" ? "ช่วงนี้บริเวณนี้มีรายงานสิ่งของอื่นอะไรบ้าง" : "What other items were reported near that location?");
    }

    return suggestions.slice(0, QUERY_SUGGESTION_LIMIT);
  } catch (error) {
    logClientError("building query suggestions failed", error, { itemId: item?.id || null });
    return [];
  }
}

function renderQuerySuggestions(suggestions = [], item = null, messages = state.queryMessages) {
  void suggestions;
  void item;
  void messages;
  state.querySuggestions = [];
  querySuggestions.replaceChildren();
  querySuggestions.classList.add("is-hidden");
}

function deleteQueryMessage(messageId) {
  openConfirmModal({
    title: langText({ en: "Delete question", "zh-CN": "删除问题", th: "ลบคำถาม" }),
    body: langText({
      en: `Delete question #${messageId}?`,
      "zh-CN": `删除问题 #${messageId}？`,
      th: `ลบคำถาม #${messageId} ใช่หรือไม่`,
    }),
    confirmLabel: t("common.confirm"),
    onConfirm: async () => {
      try {
        const data = await apiFetch(`/admin/query-messages/${messageId}`, { method: "DELETE" });
        closeConfirmModal();
        setMessage(queryMessage, data.message || "Question deleted.");
        const itemId = state.currentQueryItem?.id || null;
        invalidateQueryThread(itemId);
        await loadQueryPage(itemId);
        if (currentUserCanAdmin()) {
          await loadAdminData();
        }
      } catch (error) {
        setMessage(confirmMessage, error.message, true);
        logClientError("deleting query message failed", error, { messageId });
      }
    },
  });
}

function clearCurrentQueryThread() {
  const item = state.currentQueryItem;
  if (!currentUserCanAdmin() || !item?.id) return;
  openConfirmModal({
    title: langText({ en: "Clear item questions", "zh-CN": "清空物品问题", th: "ล้างคำถามรายการ" }),
    body: langText({
      en: `Clear all saved questions for "${item.title || `item #${item.id}`}"?`,
      "zh-CN": `清空“${item.title || `物品 #${item.id}`}”的全部已保存问题？`,
      th: `ล้างคำถามที่บันทึกไว้ทั้งหมดสำหรับ "${item.title || `รายการ #${item.id}`}" ใช่หรือไม่`,
    }),
    confirmLabel: t("common.confirm"),
    onConfirm: async () => {
      try {
        const data = await apiFetch(`/admin/items/${item.id}/query-thread`, { method: "DELETE" });
        closeConfirmModal();
        setMessage(queryMessage, data.message || "Item questions cleared.");
        invalidateQueryThread(item.id);
        await loadQueryPage(item.id);
        if (currentUserCanAdmin()) {
          await loadAdminData();
        }
      } catch (error) {
        setMessage(confirmMessage, error.message, true);
        logClientError("clearing query thread failed", error, { itemId: item.id });
      }
    },
  });
}

function appendQueryAdminControls(bubble, entry) {
  if (!currentUserCanAdmin() || !entry?.id) return;
  const actions = document.createElement("div");
  actions.className = "query-message-actions";
  const deleteButton = document.createElement("button");
  deleteButton.className = "ghost-button small-button danger-button";
  deleteButton.type = "button";
  deleteButton.textContent = langText({ en: "Delete", "zh-CN": "删除", th: "ลบ" });
  deleteButton.addEventListener("click", () => deleteQueryMessage(entry.id));
  actions.append(deleteButton);
  bubble.append(actions);
}

function scrollQueryMessagesToBottom({ smooth = false } = {}) {
  if (!queryMessages) return;
  window.requestAnimationFrame(() => {
    const behavior = smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto";
    if (typeof queryMessages.scrollTo === "function") {
      queryMessages.scrollTo({ top: queryMessages.scrollHeight, behavior });
      return;
    }
    queryMessages.scrollTop = queryMessages.scrollHeight;
  });
}

function ensureQueryComposerVisible() {
  if (state.currentView !== "query") return;
  window.requestAnimationFrame(() => {
    queryForm?.scrollIntoView({ block: "nearest", inline: "nearest" });
    scrollQueryMessagesToBottom();
  });
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
  renderQueryContextImage(item);
  syncQueryAdminActions();

  queryItemTitle.textContent = item.title;
  queryItemMeta.textContent = `${localizeValue(item.category)} • ${localizeValue(item.location)} • ${formatDateTime(item.created_at)}`;
  queryItemDescription.textContent = item.evidence_summary || item.description || "";
  queryItemStatus.textContent = itemStatusLabel(item);
  queryItemStatus.className = "status-badge";
  queryItemStatus.classList.add(itemStatusClass(item));
  queryItemContextLabel.textContent = langText({
    en: `Lookup results for ${item.title}`,
    "zh-CN": `${item.title} 的查询结果`,
    th: `ผลการค้นหาสำหรับ ${item.title}`,
  });
  updateQueryEmptyState();
  renderTags(queryItemTags, item.tags || []);
  setQueryComposerEnabled(true, t("query.askAboutItem"));
}

function latestUserQueryMessage(messages = []) {
  return [...messages].reverse().find((entry) => entry?.role !== "system" && String(entry?.message || "").trim()) || null;
}

function queryResultCacheKey(itemId, queryRecord) {
  const scope = itemId ? `item:${itemId}` : "general";
  const id = queryRecord?.id || String(queryRecord?.message || "").trim().toLowerCase().replace(/\s+/g, "-");
  return `${scope}:${id}`;
}

function querySearchText(queryText, item = null) {
  return [
    queryText,
    item?.title,
    item?.category,
    item?.location_path,
    item?.location,
    item?.secondary_location,
  ].filter(Boolean).join(" ");
}

function queryResultItem(match) {
  return assistantResultItem(match);
}

function queryResultScore(match) {
  return assistantResultScore(match);
}

function queryResultConfidence(match, item) {
  return assistantResultConfidence(match, item);
}

function queryResultLocationCode(item) {
  const source = [
    item?.location_path,
    item?.secondary_location,
    item?.location,
    item?.description,
  ].filter(Boolean).join(" ");
  return (source.match(/\b[ASP]\d{3}\b/i)?.[0] || "").toUpperCase();
}

function queryResultFloor(item) {
  const source = [
    item?.location_path,
    item?.secondary_location,
    item?.location,
  ].filter(Boolean).join(" ");
  const namedFloor = source.match(/\b(?:floor|level)\s*([1-9])\b/i)?.[1];
  if (namedFloor) return `Floor ${namedFloor}`;
  const code = queryResultLocationCode(item);
  if (code && /^\D[1-9]\d{2}$/.test(code)) {
    return `Floor ${code.slice(1, 2)}`;
  }
  return "";
}

function queryResultFloorZoneLabel(item) {
  const floor = queryResultFloor(item);
  const code = queryResultLocationCode(item);
  if (floor && code) return `${floor} - ${code}`;
  return floor || code || langText({ en: "Not specified", "zh-CN": "未指定", th: "ไม่ได้ระบุ" });
}

function appendQueryResultDetail(list, label, value) {
  if (!value && value !== 0) return;
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = String(value);
  row.append(dt, dd);
  list.append(row);
}

function createQueryResultCard(match, index = 0, topScore = 0) {
  const item = queryResultItem(match);
  if (!item) return null;

  const score = queryResultScore(match);
  const confidence = queryResultConfidence(match, item);
  const card = document.createElement("article");
  card.className = "query-result-card";
  if (index === 0 && score > 0) {
    card.classList.add("is-strongest");
  } else if (topScore > 0 && score < topScore) {
    card.classList.add("is-secondary-match");
  }

  const media = document.createElement("button");
  media.type = "button";
  media.className = "query-result-media";
  const imageSource = assistantResultImageSource(item);
  if (canPreviewImage(imageSource)) {
    const image = document.createElement("img");
    image.src = imageSource;
    image.alt = item.title || "Matched item";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      media.classList.remove("has-image");
      media.replaceChildren(document.createTextNode(langText({ en: "No image", "zh-CN": "无图片", th: "ไม่มีรูป" })));
    }, { once: true });
    media.classList.add("has-image");
    media.append(image);
    media.addEventListener("click", () => openImagePreview(imageSource, item.title || "Matched item", item.description || ""));
  } else {
    media.textContent = langText({ en: "No image", "zh-CN": "无图片", th: "ไม่มีรูป" });
    media.disabled = true;
  }

  const body = document.createElement("div");
  body.className = "query-result-body";

  const head = document.createElement("div");
  head.className = "query-result-head";
  const title = document.createElement("h4");
  title.textContent = `#${item.id || "?"} ${item.title || langText({ en: "Untitled report", "zh-CN": "未命名报告", th: "รายงานไม่มีชื่อ" })}`;
  head.append(title);
  if (confidence) {
    const badge = document.createElement("span");
    badge.className = "query-confidence-badge";
    badge.textContent = confidence.value;
    badge.title = confidence.label;
    head.append(badge);
  }

  const details = document.createElement("dl");
  details.className = "query-result-details";
  appendQueryResultDetail(details, langText({ en: "Location", "zh-CN": "地点", th: "สถานที่" }), assistantResultLocation(item));
  appendQueryResultDetail(details, langText({ en: "Floor / zone", "zh-CN": "楼层 / 区域代码", th: "ชั้น / รหัสโซน" }), queryResultFloorZoneLabel(item));
  appendQueryResultDetail(details, confidence?.label || langText({ en: "Confidence", "zh-CN": "置信度", th: "ความมั่นใจ" }), confidence?.value || "");
  appendQueryResultDetail(details, langText({ en: "Timestamp", "zh-CN": "时间戳", th: "เวลา" }), formatDateTime(item.created_at || item.updated_at || item.event_date));

  const actions = document.createElement("div");
  actions.className = "query-result-actions";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "ghost-button small-button";
  openButton.textContent = langText({ en: "View report", "zh-CN": "查看报告", th: "ดูรายงาน" });
  openButton.addEventListener("click", () => navigateTo("query", Number(item.id) || null));
  actions.append(openButton);

  body.append(head, details, actions);
  card.append(media, body);
  return card;
}

function createQuerySubmissionSummary(queryRecord, { query = "" } = {}) {
  const card = document.createElement("article");
  card.className = "query-submission-card";
  const title = document.createElement("h4");
  title.textContent = langText({ en: "Question submitted", "zh-CN": "已提交问题", th: "ส่งคำถามแล้ว" });
  const text = document.createElement("p");
  text.textContent = query || queryRecord?.message || "";
  const details = document.createElement("dl");
  details.className = "query-result-details";
  appendQueryResultDetail(details, langText({ en: "Timestamp", "zh-CN": "时间戳", th: "เวลา" }), formatDateTime(queryRecord?.created_at));
  if (queryRecord?.attachment?.url) {
    appendQueryResultDetail(details, langText({ en: "Image context", "zh-CN": "图片上下文", th: "บริบทรูปภาพ" }), queryRecord.attachment.name || "Uploaded image");
  }
  card.append(title, text, details);
  if (queryRecord?.attachment?.url) {
    const preview = createAttachmentPreview(queryRecord.attachment);
    if (preview) {
      preview.classList.add("query-attachment-preview");
      card.append(preview);
    }
  }
  appendQueryAdminControls(card, queryRecord);
  return card;
}

function renderStructuredQueryResults({ query = "", queryRecord = null, results = [], matchingQuestions = [], suggestedQuery = "", statusText = "", isLoading = false } = {}) {
  queryMessages.replaceChildren();
  queryEmptyState.classList.toggle("is-hidden", Boolean(queryRecord || results.length || statusText || isLoading));

  if (!queryRecord && !results.length && !statusText && !isLoading) {
    return;
  }

  if (queryRecord || query) {
    queryMessages.append(createQuerySubmissionSummary(queryRecord, { query }));
  }

  const summary = document.createElement("section");
  summary.className = "query-results-summary";
  const heading = document.createElement("div");
  heading.className = "query-results-head";
  const title = document.createElement("h4");
  title.textContent = langText({ en: "Matching items", "zh-CN": "匹配物品", th: "รายการที่ตรงกัน" });
  const count = document.createElement("span");
  count.className = "query-confidence-badge";
  count.textContent = isLoading ? "..." : String(results.length);
  heading.append(title, count);
  summary.append(heading);

  const queryLine = document.createElement("p");
  queryLine.className = "query-results-meta";
  queryLine.textContent = suggestedQuery && suggestedQuery !== query ? `${query} -> ${suggestedQuery}` : query;
  if (queryLine.textContent) summary.append(queryLine);

  if (isLoading) {
    const loading = document.createElement("p");
    loading.className = "status-message";
    loading.textContent = statusText || langText({ en: "Finding structured matches...", "zh-CN": "正在查找结构化匹配...", th: "กำลังค้นหารายการที่ตรงกัน..." });
    summary.append(loading);
  } else if (results.length) {
    const list = document.createElement("div");
    list.className = "query-results-list";
    const topScore = Math.max(...results.map(queryResultScore), 0);
    results.forEach((match, index) => {
      const card = createQueryResultCard(match, index, topScore);
      if (card) list.append(card);
    });
    summary.append(list);
  } else {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = statusText || langText({
      en: "No matching items found. Try a color, item type, room code, or building name.",
      "zh-CN": "未找到匹配物品。可尝试颜色、物品类型、房间代码或建筑名称。",
      th: "ไม่พบรายการที่ตรงกัน ลองระบุสี ประเภทสิ่งของ รหัสห้อง หรือชื่ออาคาร",
    });
    summary.append(empty);
  }

  if (!isLoading && matchingQuestions.length) {
    const related = document.createElement("div");
    related.className = "query-results-list";
    const relatedTitle = document.createElement("h4");
    relatedTitle.textContent = langText({ en: "Related public questions", "zh-CN": "相关公开问题", th: "คำถามสาธารณะที่เกี่ยวข้อง" });
    related.append(relatedTitle);
    matchingQuestions.slice(0, 4).forEach((question) => {
      const card = document.createElement("article");
      card.className = "question-board-card";
      const text = document.createElement("p");
      text.className = "query-text";
      text.textContent = question.question_text || "";
      const meta = document.createElement("p");
      meta.className = "query-results-meta";
      meta.textContent = [
        question.location_hint || "",
        `${Number(question.reply_count || 0)} ${langText({ en: "replies", "zh-CN": "条回复", th: "คำตอบ" })}`,
        formatDateTime(question.created_at),
      ].filter(Boolean).join(" • ");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ghost-button small-button";
      button.textContent = langText({ en: "Open thread", "zh-CN": "打开主题", th: "เปิดเธรด" });
      button.addEventListener("click", () => openQuestionThread(question.id));
      card.append(text, meta, button);
      related.append(card);
    });
    summary.append(related);
  }

  queryMessages.append(summary);
  scrollQueryMessagesToBottom();
}

function renderQueryMessages(messages) {
  updateQueryEmptyState();
  const latest = latestUserQueryMessage(messages);
  renderStructuredQueryResults({
    query: latest?.message || "",
    queryRecord: latest,
    results: state.queryStructuredResults || [],
    statusText: latest ? langText({
      en: "Question saved. Submit a lookup to refresh matches.",
      "zh-CN": "问题已保存。提交查询可刷新匹配结果。",
      th: "บันทึกคำถามแล้ว ส่งการค้นหาเพื่ออัปเดตผลลัพธ์",
    }) : "",
  });
}

function isCurrentQueryScope(itemId = null) {
  return state.currentView === "query"
    && ((state.currentQueryItem?.id || null) === (itemId || null));
}

async function refreshStructuredQueryResults(queryRecord, item = null, { requestToken = null, force = false } = {}) {
  if (!queryRecord?.message) {
    renderStructuredQueryResults();
    return null;
  }
  const itemId = item?.id || null;
  const cacheKey = queryResultCacheKey(itemId, queryRecord);
  const cached = state.queryResultCache.get(cacheKey);
  if (cached && !force) {
    state.queryStructuredResults = cached.results || [];
    renderStructuredQueryResults(cached);
    return cached;
  }

  renderStructuredQueryResults({
    query: queryRecord.message,
    queryRecord,
    isLoading: true,
  });

  try {
    const searchText = querySearchText(queryRecord.message, item);
    const data = await sendAssistantRequest({
      message: searchText,
      executeSearch: true,
      query: searchText,
    });
    if ((requestToken && state.queryRequestToken !== requestToken) || !isCurrentQueryScope(itemId)) {
      return null;
    }
    const payload = {
      query: queryRecord.message,
      queryRecord,
      results: Array.isArray(data.results) ? data.results : [],
      suggestedQuery: data.suggested_query || queryRecord.message,
    };
    state.queryStructuredResults = payload.results;
    state.queryResultCache.set(cacheKey, payload);
    renderStructuredQueryResults(payload);
    return payload;
  } catch (error) {
    if ((requestToken && state.queryRequestToken !== requestToken) || !isCurrentQueryScope(itemId)) {
      return null;
    }
    state.queryStructuredResults = [];
    renderStructuredQueryResults({
      query: queryRecord.message,
      queryRecord,
      results: [],
      statusText: error.message || langText({ en: "Could not load structured matches.", "zh-CN": "无法加载结构化匹配结果。", th: "ไม่สามารถโหลดผลลัพธ์แบบโครงสร้างได้" }),
    });
    logClientError("loading structured query results failed", error, { itemId });
    return null;
  }
}

function handleQueryItemSelection() {
  const nextItemId = Number(queryItemSelect.value) || null;
  const nextItem = nextItemId ? findItemById(nextItemId) : null;
  state.currentQueryItem = nextItem;
  persistCurrentItemId(nextItemId);
  navigateTo("query", nextItemId);
}

function questionTypeLabel(type = "") {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "seen_item") return langText({ en: "Did anyone see my item?", "zh-CN": "有人看到我的物品吗？", th: "มีใครเห็นสิ่งของของฉันไหม" });
  if (normalized === "has_this_been_found") return langText({ en: "Has this been found?", "zh-CN": "这个找到了吗？", th: "พบสิ่งนี้แล้วหรือยัง" });
  return langText({ en: "Lost something not listed", "zh-CN": "遗失了未列出的物品", th: "ทำของหายที่ยังไม่มีในรายการ" });
}

function questionReplyTypeLabel(type = "") {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "suggestion") return langText({ en: "Suggested item", "zh-CN": "建议物品", th: "แนะนำสิ่งของ" });
  if (normalized === "confirmation") return langText({ en: "Confirmation", "zh-CN": "确认", th: "ยืนยัน" });
  return langText({ en: "Reply", "zh-CN": "回复", th: "ตอบกลับ" });
}

function renderQuestionBoard(questions = state.questionBoard) {
  if (!questionBoardList) return;
  questionBoardList.replaceChildren();
  if (!questions.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = langText({ en: "No public questions yet.", "zh-CN": "暂时没有公开问题。", th: "ยังไม่มีคำถามสาธารณะ" });
    questionBoardList.append(empty);
    return;
  }

  questions.forEach((question) => {
    const card = document.createElement("article");
    card.className = "question-board-card";
    card.classList.toggle("is-active", state.activeQuestionThread?.id === question.id);

    const head = document.createElement("div");
    head.className = "query-results-head";
    const title = document.createElement("h4");
    title.textContent = question.question_text || "";
    const badge = document.createElement("span");
    badge.className = "query-confidence-badge";
    badge.textContent = String(question.reply_count || 0);
    badge.title = langText({ en: "Replies", "zh-CN": "回复数", th: "จำนวนคำตอบ" });
    head.append(title, badge);

    const meta = document.createElement("p");
    meta.className = "query-results-meta";
    meta.textContent = [
      questionTypeLabel(question.question_type),
      question.location_hint ? `${langText({ en: "Location", "zh-CN": "地点", th: "สถานที่" })}: ${question.location_hint}` : "",
      formatDateTime(question.created_at),
    ].filter(Boolean).join(" • ");

    card.append(head, meta);
    if (question.attachment?.url) {
      const preview = createAttachmentPreview(question.attachment);
      if (preview) {
        preview.classList.add("query-attachment-preview");
        card.append(preview);
      }
    }

    const actions = document.createElement("div");
    actions.className = "query-result-actions";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "primary-button small-button";
    openButton.textContent = langText({ en: "Open thread", "zh-CN": "打开主题", th: "เปิดเธรด" });
    openButton.addEventListener("click", () => openQuestionThread(question.id));
    actions.append(openButton);
    card.append(actions);
    questionBoardList.append(card);
  });
}

async function loadQuestionBoard({ openQuestionId = state.pendingQuestionThreadId || null } = {}) {
  try {
    const data = await apiFetch("/questions");
    state.questionBoard = Array.isArray(data.questions) ? data.questions : [];
    renderQuestionBoard();
    if (openQuestionId) {
      state.pendingQuestionThreadId = null;
      await openQuestionThread(openQuestionId);
    }
  } catch (error) {
    questionBoardList?.replaceChildren();
    const message = document.createElement("p");
    message.className = "status-message is-error";
    message.textContent = error.message;
    questionBoardList?.append(message);
    logClientError("loading question board failed", error);
  }
}

function renderQuestionThread(question) {
  state.activeQuestionThread = question || null;
  questionThreadPanel?.classList.toggle("is-hidden", !question);
  if (!question) {
    questionThreadBody?.replaceChildren();
    setMessage(questionReplyMessage, "");
    return;
  }

  questionThreadTitle.textContent = question.question_text || "";
  questionThreadMeta.textContent = [
    questionTypeLabel(question.question_type),
    question.location_hint || "",
    formatDateTime(question.created_at),
  ].filter(Boolean).join(" • ");
  questionThreadBody.replaceChildren();

  const original = document.createElement("article");
  original.className = "question-thread-entry is-question";
  const originalMeta = document.createElement("p");
  originalMeta.className = "query-results-meta";
  originalMeta.textContent = `${question.user_identity || "User"} • ${formatDateTime(question.created_at)}`;
  const originalText = document.createElement("p");
  originalText.className = "query-text";
  originalText.textContent = question.question_text || "";
  original.append(originalMeta, originalText);
  if (question.attachment?.url) {
    const preview = createAttachmentPreview(question.attachment);
    if (preview) original.append(preview);
  }
  questionThreadBody.append(original);

  const replies = Array.isArray(question.replies) ? question.replies : [];
  if (!replies.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = langText({ en: "No replies yet.", "zh-CN": "还没有回复。", th: "ยังไม่มีคำตอบ" });
    questionThreadBody.append(empty);
  }
  replies.forEach((reply) => {
    const entry = document.createElement("article");
    entry.className = "question-thread-entry";
    const meta = document.createElement("p");
    meta.className = "query-results-meta";
    meta.textContent = `${questionReplyTypeLabel(reply.reply_type)} • ${reply.user_identity || "User"} • ${formatDateTime(reply.created_at)}`;
    const text = document.createElement("p");
    text.className = "query-text";
    text.textContent = reply.message || "";
    entry.append(meta, text);
    if (reply.attachment?.url) {
      const preview = createAttachmentPreview(reply.attachment);
      if (preview) entry.append(preview);
    }
    questionThreadBody.append(entry);
  });
  renderQuestionBoard();
}

async function openQuestionThread(questionId) {
  if (!questionId) return;
  try {
    const data = await apiFetch(`/questions/${questionId}`);
    renderQuestionThread(data.question || null);
    questionThreadPanel?.scrollIntoView({ block: "nearest" });
  } catch (error) {
    setMessage(queryMessage, error.message, true);
    logClientError("opening question thread failed", error, { questionId });
  }
}

function closeQuestionThread() {
  renderQuestionThread(null);
}

async function submitQuestionReply(event) {
  event.preventDefault();
  const question = state.activeQuestionThread;
  if (!question?.id || questionReplySubmitButton?.disabled) return;
  const message = questionReplyInput.value.trim();
  if (!message) {
    setMessage(questionReplyMessage, langText({ en: "Type a reply first.", "zh-CN": "请先输入回复。", th: "กรุณาพิมพ์คำตอบก่อน" }), true);
    return;
  }
  const fileValidation = validateChatFile(state.selectedQuestionReplyFile);
  if (fileValidation) {
    setMessage(questionReplyMessage, fileValidation, true);
    return;
  }

  setButtonLoading(questionReplySubmitButton, true);
  setMessage(questionReplyMessage, langText({ en: "Posting reply...", "zh-CN": "正在发布回复...", th: "กำลังส่งคำตอบ..." }));
  try {
    const uploadFile = state.selectedQuestionReplyFile
      ? await prepareUploadFile(state.selectedQuestionReplyFile, "query", {
          compress: progressCopy("queryCompress"),
          prepare: progressCopy("queryPrepare"),
        })
      : null;
    let data;
    if (uploadFile) {
      const formData = new FormData();
      formData.set("message", message);
      formData.set("reply_type", questionReplyTypeSelect?.value || "reply");
      formData.set("file", uploadFile);
      data = await apiFetch(`/questions/${question.id}/replies`, {
        method: "POST",
        body: formData,
      });
    } else {
      data = await apiFetch(`/questions/${question.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          reply_type: questionReplyTypeSelect?.value || "reply",
        }),
      });
    }
    questionReplyInput.value = "";
    clearSelectedQuestionReplyFile();
    renderQuestionThread(data.question || null);
    await loadQuestionBoard();
    await loadNotifications();
    setMessage(questionReplyMessage, data.message || langText({ en: "Reply posted.", "zh-CN": "回复已发布。", th: "ส่งคำตอบแล้ว" }));
    triggerHaptic("success");
  } catch (error) {
    setMessage(questionReplyMessage, error.message, true);
    logClientError("posting question reply failed", error, { questionId: question.id });
  } finally {
    setButtonLoading(questionReplySubmitButton, false);
  }
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
    const cacheKey = hasItem ? `item:${itemId}` : "general";
    const cached = state.queryCache.get(cacheKey);
    const [itemData, queryData] = await Promise.all(cached
      ? [
          Promise.resolve(cached.itemData),
          Promise.resolve(cached.queryData),
        ]
      : hasItem
      ? [
          apiFetch(`/items/${itemId}`),
          apiFetch(`/items/${itemId}/queries?${new URLSearchParams({ language: currentLanguage() }).toString()}`),
        ]
      : [
          Promise.resolve({ item: null }),
          apiFetch(`/query?${new URLSearchParams({ language: currentLanguage() }).toString()}`),
        ]);
    if (state.queryRequestToken !== requestToken || state.currentView !== "query") {
      return;
    }
    state.queryCache.set(cacheKey, { itemData, queryData });
    const item = itemData?.item || null;
    const messages = Array.isArray(queryData?.queries) ? queryData.queries : [];
    renderQueryContext(item);
    state.queryMessages = messages;
    state.queryStructuredResults = [];
    if (Array.isArray(queryData?.questions)) {
      state.questionBoard = queryData.questions;
      renderQuestionBoard();
    } else {
      await loadQuestionBoard();
    }
    renderQueryMessages(messages);
    renderQuerySuggestions(queryData?.suggestions || [], item, messages);
    setLoadingLine(queryLoading, false);
    if (state.pendingQuestionThreadId) {
      const pendingQuestionId = state.pendingQuestionThreadId;
      state.pendingQuestionThreadId = null;
      await openQuestionThread(pendingQuestionId);
    }
    const latest = latestUserQueryMessage(messages);
    if (latest) {
      await refreshStructuredQueryResults(latest, item, { requestToken });
    }
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
  if (querySubmitButton.disabled) return;
  const itemId = state.currentQueryItem?.id || null;

  const value = queryInput.value.trim();
  const queryDraft = {
    itemId,
    item: state.currentQueryItem || null,
    message: value,
    questionType: queryTypeSelect?.value || "lost_not_listed",
    locationHint: queryLocationInput?.value?.trim() || "",
    file: state.selectedQueryFile,
  };
  const fileValidationMessage = validateChatFile(queryDraft.file);
  if (fileValidationMessage) {
    setMessage(queryMessage, fileValidationMessage, true);
    setWarningCard(queryWarningCard, fileValidationMessage);
    return;
  }
  if (!value) {
    const shortMessage = langText({
      en: "Type a question first.",
      "zh-CN": "请先输入问题。",
      th: "กรุณาพิมพ์คำถามก่อน",
    });
    setMessage(queryMessage, shortMessage, true);
    setWarningCard(queryWarningCard, shortMessage);
    return;
  }

  const activityId = createActivity({
    type: "query",
    title: queryDraft.item
      ? langText({
          en: `Lookup: ${queryDraft.item.title || "item"}`,
          "zh-CN": `查询：${queryDraft.item.title || "物品"}`,
          th: `ค้นหา: ${queryDraft.item.title || "สิ่งของ"}`,
        })
      : langText({ en: "General lookup", "zh-CN": "一般查询", th: "การค้นหาทั่วไป" }),
    stage: progressCopy("queryPrepare"),
    detail: langText({
      en: "Saving the question and preparing structured matches.",
      "zh-CN": "正在保存问题并准备结构化匹配结果。",
      th: "กำลังบันทึกคำถามและเตรียมผลลัพธ์แบบโครงสร้าง",
    }),
    progress: 0,
    status: "running",
    target: "query",
    itemId: queryDraft.itemId,
  });
  state.progressActivityIds.query = activityId;
  setButtonLoading(querySubmitButton, true);
  setProgress("query", 0, progressCopy("queryPrepare"), true);
  setMessage(queryMessage, langText({ en: "Submitting your question...", "zh-CN": "正在提交问题...", th: "กำลังส่งคำถาม..." }));
  setWarningCard(queryWarningCard, "");
  try {
    const path = queryDraft.itemId ? `/items/${queryDraft.itemId}/query` : "/query";
    const uploadFile = await prepareUploadFile(queryDraft.file, "query", {
      compress: progressCopy("queryCompress"),
      prepare: progressCopy("queryPrepare"),
    });
    let data;
    if (uploadFile) {
      const formData = new FormData();
      formData.set("message", queryDraft.message);
      formData.set("language", currentLanguage());
      formData.set("question_type", queryDraft.questionType);
      formData.set("location_hint", queryDraft.locationHint);
      formData.set("file", uploadFile);
      data = await apiRequestWithProgress(path, {
        method: "POST",
        body: formData,
        onUploadProgress: (progressEvent) => updateUploadProgress("query", progressEvent, progressCopy("queryUpload")),
        onUploadComplete: () => startProcessingProgress("query", progressCopy("queryProcess")),
      });
    } else {
      const requestBody = JSON.stringify({
        message: queryDraft.message,
        language: currentLanguage(),
        question_type: queryDraft.questionType,
        location_hint: queryDraft.locationHint,
      });
      setProgress("query", 20, progressCopy("queryUpload"), true);
      data = await apiRequestWithProgress(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        onUploadProgress: (progressEvent) => updateUploadProgress("query", progressEvent, progressCopy("queryUpload")),
        onUploadComplete: () => startProcessingProgress("query", progressCopy("queryProcess")),
      });
    }
    const nextMessages = Array.isArray(data.queries) ? data.queries : [];
    state.queryCache.set(queryDraft.itemId ? `item:${queryDraft.itemId}` : "general", {
      itemData: { item: queryDraft.item || null },
      queryData: { queries: nextMessages, suggestions: data.suggestions || [] },
    });
    const stillOnSameQuery = state.currentView === "query"
      && ((state.currentQueryItem?.id || null) === (queryDraft.itemId || null));
    if (stillOnSameQuery) {
      queryInput.value = "";
      if (queryLocationInput) {
        queryLocationInput.value = "";
      }
      clearSelectedQueryFile();
      state.queryMessages = nextMessages;
      state.queryStructuredResults = [];
      if (Array.isArray(data.questions)) {
        state.questionBoard = data.questions;
        renderQuestionBoard();
      }
      if (data.question?.id) {
        renderQuestionThread(data.question);
      }
      renderQueryMessages(state.queryMessages);
      renderQuerySuggestions(data.suggestions || [], state.currentQueryItem, state.queryMessages);
      const latest = latestUserQueryMessage(state.queryMessages);
      if (Array.isArray(data.matches)) {
        const payload = {
          query: latest?.message || queryDraft.message,
          queryRecord: latest || null,
          results: data.matches,
          matchingQuestions: Array.isArray(data.matching_questions) ? data.matching_questions : [],
          suggestedQuery: queryDraft.message,
        };
        state.queryStructuredResults = payload.results;
        renderStructuredQueryResults(payload);
      } else if (latest) {
        await refreshStructuredQueryResults(latest, state.currentQueryItem, { force: true });
      }
    }
    await completeProgress("query");
    completeActivity(activityId, {
      title: queryDraft.item
        ? langText({
            en: `Lookup complete: ${queryDraft.item.title || "item"}`,
            "zh-CN": `查询完成：${queryDraft.item.title || "物品"}`,
            th: `ค้นหาเสร็จแล้ว: ${queryDraft.item.title || "สิ่งของ"}`,
          })
        : langText({ en: "General lookup complete", "zh-CN": "一般查询完成", th: "ค้นหาทั่วไปเสร็จแล้ว" }),
      stage: langText({ en: "Results updated", "zh-CN": "结果已更新", th: "อัปเดตผลลัพธ์แล้ว" }),
      detail: langText({
        en: "Your question is saved and structured matches are shown.",
        "zh-CN": "你的问题已保存，并显示结构化匹配结果。",
        th: "บันทึกคำถามแล้วและแสดงผลลัพธ์แบบโครงสร้าง",
      }),
      target: "query",
      itemId: queryDraft.itemId,
    });
    if (stillOnSameQuery) {
      setMessage(queryMessage, langText({ en: "Question submitted. Results updated.", "zh-CN": "问题已提交，结果已更新。", th: "ส่งคำถามแล้ว อัปเดตผลลัพธ์แล้ว" }));
    }
    triggerHaptic("success");
    if (stillOnSameQuery) {
      ensureQueryComposerVisible();
    }
    await loadItems();
  } catch (error) {
    const stillOnSameQuery = state.currentView === "query"
      && ((state.currentQueryItem?.id || null) === (queryDraft.itemId || null));
    resetProgress("query");
    failActivity(activityId, error, {
      title: queryDraft.item
        ? langText({
            en: `Lookup failed: ${queryDraft.item.title || "item"}`,
            "zh-CN": `查询失败：${queryDraft.item.title || "物品"}`,
            th: `ค้นหาไม่สำเร็จ: ${queryDraft.item.title || "สิ่งของ"}`,
          })
        : langText({ en: "General lookup failed", "zh-CN": "一般查询失败", th: "ค้นหาทั่วไปไม่สำเร็จ" }),
      target: "query",
      itemId: queryDraft.itemId,
    });
    if (stillOnSameQuery) {
      setMessage(queryMessage, langText({
        en: `Could not submit your question: ${error.message}`,
        "zh-CN": `问题提交失败：${error.message}`,
        th: `ไม่สามารถส่งคำถามได้: ${error.message}`,
      }), true);
      setWarningCard(queryWarningCard, error.message);
    }
    logClientError("submitting query failed", error, { itemId: queryDraft.itemId });
  } finally {
    clearProgressActivity("query");
    setButtonLoading(querySubmitButton, false);
  }
}

function setAssistantMode(mode = "chat", { focus = true } = {}) {
  const normalizedMode = mode === "query" ? "query" : "chat";
  state.assistantMode = normalizedMode;

  assistantChatModeButton?.classList.toggle("is-active", normalizedMode === "chat");
  assistantQueryModeButton?.classList.toggle("is-active", normalizedMode === "query");
  assistantChatModeButton?.setAttribute("aria-selected", normalizedMode === "chat" ? "true" : "false");
  assistantQueryModeButton?.setAttribute("aria-selected", normalizedMode === "query" ? "true" : "false");
  assistantChatModePanel?.classList.toggle("is-hidden", normalizedMode !== "chat");
  assistantQueryModePanel?.classList.toggle("is-hidden", normalizedMode !== "query");

  if (!focus) return;
  window.requestAnimationFrame(() => {
    (normalizedMode === "query" ? assistantQueryInput : assistantInput)?.focus();
  });
}

function assistantWelcomeCopy() {
  return langText({
    en: "Tell me what you lost, where you were, or which report you are checking.",
    "zh-CN": "告诉我你丢了什么、在哪里，或想查看哪条报告。",
    th: "บอกฉันว่าสิ่งของที่หายคืออะไร อยู่ที่ไหน หรือกำลังตรวจสอบรายงานใด",
  });
}

function assistantResultItem(match) {
  return match?.item || match || null;
}

function assistantResultScore(match) {
  const numeric = Number(match?.score ?? match?.match_score ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function assistantResultImageSource(item) {
  return resolveImageUrl(item) || normalizeImageUrl(item?.image?.path || "");
}

function assistantResultLocation(item) {
  const location = item?.location_path || [item?.secondary_location, item?.location].filter(Boolean).join(" > ");
  if (!location) {
    return langText({ en: "Unknown location", "zh-CN": "未知地点", th: "ไม่ทราบสถานที่" });
  }
  return String(location).includes(">") ? locationPathLabel(location) : localizeValue(location);
}

function assistantResultConfidence(match, item) {
  const aiConfidence = analysisConfidenceValue(item);
  if (aiConfidence > 0) {
    return {
      label: langText({ en: "AI confidence", "zh-CN": "AI 置信度", th: "ความมั่นใจของ AI" }),
      value: `${aiConfidence}%`,
    };
  }
  const score = assistantResultScore(match);
  if (score > 0) {
    return {
      label: langText({ en: "Match confidence", "zh-CN": "匹配置信度", th: "ความมั่นใจในการจับคู่" }),
      value: `${Math.max(1, Math.min(100, Math.round(score)))}%`,
    };
  }
  return null;
}

function appendAssistantResultDetail(list, label, value) {
  if (!value && value !== 0) return;
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = String(value);
  row.append(dt, dd);
  list.append(row);
}

function createAssistantResultCard(match, index = 0, topScore = 0) {
  const item = assistantResultItem(match);
  if (!item) return null;

  const score = assistantResultScore(match);
  const confidence = assistantResultConfidence(match, item);
  const card = document.createElement("article");
  card.className = "assistant-result-card match-found-card";
  if (index === 0 && score > 0) {
    card.classList.add("is-strongest");
  } else if (topScore > 0 && score < topScore) {
    card.classList.add("is-weaker");
  }

  const media = document.createElement("button");
  media.type = "button";
  media.className = "assistant-result-media";
  const imageSource = assistantResultImageSource(item);
  if (canPreviewImage(imageSource)) {
    const image = document.createElement("img");
    image.src = imageSource;
    image.alt = item.title || "Matched item";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      media.classList.remove("has-image");
      media.replaceChildren(document.createTextNode(langText({ en: "No image", "zh-CN": "无图片", th: "ไม่มีรูป" })));
    }, { once: true });
    media.classList.add("has-image");
    media.append(image);
    media.addEventListener("click", () => openImagePreview(imageSource, item.title || "Matched item", item.description || ""));
  } else {
    media.textContent = langText({ en: "No image", "zh-CN": "无图片", th: "ไม่มีรูป" });
    media.disabled = true;
  }

  const body = document.createElement("div");
  body.className = "assistant-result-body";

  const head = document.createElement("div");
  head.className = "assistant-result-head";
  const title = document.createElement("h4");
  title.textContent = `#${item.id || "?"} ${item.title || langText({ en: "Untitled report", "zh-CN": "未命名报告", th: "รายงานไม่มีชื่อ" })}`;
  head.append(title);
  if (confidence) {
    const badge = document.createElement("span");
    badge.className = "assistant-score-badge";
    badge.textContent = confidence.value;
    badge.title = confidence.label;
    head.append(badge);
  }

  const details = document.createElement("dl");
  details.className = "assistant-result-details";
  appendAssistantResultDetail(details, langText({ en: "Location", "zh-CN": "地点", th: "สถานที่" }), assistantResultLocation(item));
  appendAssistantResultDetail(details, confidence?.label || langText({ en: "Confidence", "zh-CN": "置信度", th: "ความมั่นใจ" }), confidence?.value || "");
  appendAssistantResultDetail(details, langText({ en: "Reported", "zh-CN": "报告时间", th: "รายงานเมื่อ" }), formatDateTime(item.created_at || item.updated_at || item.event_date));

  const actions = document.createElement("div");
  actions.className = "assistant-result-actions";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "ghost-button small-button";
  openButton.textContent = langText({ en: "View report", "zh-CN": "查看报告", th: "ดูรายงาน" });
  openButton.addEventListener("click", () => navigateTo("query", Number(item.id) || null));
  actions.append(openButton);

  body.append(head, details, actions);
  card.append(media, body);
  return card;
}

function currentAssistantDraftLocation() {
  const selected = structuredLocationFromSelection();
  if (selected?.label) return selected.label;
  const active = activeLocationLabel();
  if (active) return active;
  const reportInput = String(optionalLocationInput?.value || "").trim();
  return reportInput || "";
}

function assistantLocationFromText(text = "") {
  const value = String(text || "");
  const roomCode = value.match(/\b[ASP]\d{3}\b/i)?.[0] || "";
  if (roomCode) {
    const manual = manualLocationFromInput(roomCode);
    if (manual?.label) return manual.label;
  }
  const normalized = normalizeLocationText(value);
  const location = state.locations.find((candidate) => {
    const names = [candidate.name, candidate.label, candidate.id].map(normalizeLocationText).filter(Boolean);
    return names.some((name) => normalized.includes(name));
  });
  if (location) {
    const floorMatch = value.match(/\bfloor\s*([1-9])\b/i) || value.match(/\blevel\s*([1-9])\b/i);
    if (floorMatch) {
      const floor = floorForLabel(location, floorLabelForNumber(Number(floorMatch[1])));
      if (floor) return locationFloorPath(location, floor);
    }
    return location.name;
  }
  return currentAssistantDraftLocation();
}

function assistantItemPhraseFromText(text = "") {
  const value = String(text || "").trim();
  const match = value.match(/\b(?:lost|missing|misplaced|looking for|find)\s+(?:my|a|an|the)?\s*([^.,;!?]+)/i);
  const rawPhrase = (match?.[1] || value)
    .replace(/\b(?:near|at|in|on|around|by|last seen|from)\b.*$/i, "")
    .replace(/\b(?:please|can you|help me|write|draft|claim|report)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return rawPhrase || langText({ en: "lost item", "zh-CN": "遗失物品", th: "สิ่งของที่หาย" });
}

function buildAssistantClaimDraft(sourceText = "") {
  const source = String(sourceText || "").trim();
  const itemPhrase = assistantItemPhraseFromText(source);
  const location = assistantLocationFromText(source);
  const color = (source.match(/\b(black|white|blue|red|green|yellow|pink|purple|orange|grey|gray|silver|gold|brown)\b/i)?.[1] || "").toLowerCase();
  const itemName = titleCase(color && !normalizeLocationText(itemPhrase).includes(color) ? `${color} ${itemPhrase}` : itemPhrase);
  const locationText = location || langText({ en: "location not specified", "zh-CN": "地点未指定", th: "ยังไม่ได้ระบุสถานที่" });
  const identifying = langText({
    en: "Add brand, stickers, scratches, contents, initials, or another unique mark.",
    "zh-CN": "请补充品牌、贴纸、划痕、内容物、姓名缩写或其他独特标记。",
    th: "เพิ่มยี่ห้อ สติกเกอร์ รอยตำหนิ สิ่งของข้างใน ชื่อย่อ หรือจุดสังเกตเฉพาะ",
  });

  return {
    title: itemName,
    location: locationText,
    reason: langText({
      en: `I am drafting this claim because I believe the ${itemName.toLowerCase()} is my lost item.`,
      "zh-CN": `我创建这条认领草稿，因为我认为${itemName}是我遗失的物品。`,
      th: `ฉันส่งข้อมูลนี้เพราะคิดว่า ${itemName} เป็นสิ่งของที่ฉันทำหาย`,
    }),
    description: langText({
      en: `${itemName}, last seen at ${locationText}. ${identifying}`,
      "zh-CN": `${itemName}，最后看到地点：${locationText}。${identifying}`,
      th: `${itemName} พบเห็นครั้งสุดท้ายที่ ${locationText}. ${identifying}`,
    }),
    identifyingInfo: identifying,
    source,
  };
}

function shouldGenerateAssistantClaimDraft(message = "") {
  const text = String(message || "").toLowerCase();
  if (!text) return false;
  if (/\bhow\s+(?:do|can|to)\b/.test(text)) return false;
  return /\b(?:i\s+lost|lost\s+my|lost\s+a|lost\s+an|misplaced|missing\s+my|draft\s+(?:a\s+)?claim|write\s+(?:a\s+)?claim)\b/.test(text);
}

function renderAssistantClaimDraft(container, draft) {
  if (!draft) return;
  const card = document.createElement("article");
  card.className = "assistant-claim-draft";

  const heading = document.createElement("h4");
  heading.textContent = langText({ en: "Private claim draft", "zh-CN": "私人认领草稿", th: "แบบร่างคำขอส่วนตัว" });

  const fields = document.createElement("dl");
  fields.className = "assistant-draft-fields";
  appendAssistantResultDetail(fields, langText({ en: "Item", "zh-CN": "物品", th: "สิ่งของ" }), draft.title);
  appendAssistantResultDetail(fields, langText({ en: "Location", "zh-CN": "地点", th: "สถานที่" }), draft.location);
  appendAssistantResultDetail(fields, langText({ en: "Description", "zh-CN": "描述", th: "คำอธิบาย" }), draft.description);
  appendAssistantResultDetail(fields, langText({ en: "Identifying info", "zh-CN": "识别信息", th: "ข้อมูลระบุตัวตน" }), draft.identifyingInfo);

  const actions = document.createElement("div");
  actions.className = "assistant-result-actions";
  const useButton = document.createElement("button");
  useButton.type = "button";
  useButton.className = "primary-button small-button";
  useButton.textContent = langText({ en: "Open draft builder", "zh-CN": "打开草稿构建器", th: "เปิดตัวสร้างแบบร่าง" });
  useButton.addEventListener("click", () => applyAssistantClaimDraft(draft));
  actions.append(useButton);

  card.append(heading, fields, actions);
  container.append(card);
}

function applyAssistantClaimDraft(draft) {
  if (!draft) return;
  openClaimDialog(null, null, draft);
  setMessage(claimMessage, langText({
    en: "Draft loaded. Select an existing report or keep it as a new private draft context.",
    "zh-CN": "草稿已载入。请选择现有报告，或保留为新的私人草稿上下文。",
    th: "โหลดแบบร่างแล้ว เลือกรายงานที่มีอยู่หรือเก็บเป็นบริบทแบบร่างส่วนตัวใหม่",
  }));
}

function assistantMessageTextFromError(error) {
  return langText({
    en: `I could not reach the assistant endpoint: ${error.message}`,
    "zh-CN": `无法连接助手接口：${error.message}`,
    th: `ไม่สามารถเชื่อมต่อผู้ช่วยได้: ${error.message}`,
  });
}

function scrollAssistantToBottom() {
  if (!assistantMessages) return;
  window.requestAnimationFrame(() => {
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
  });
}

function pushAssistantMessage(message) {
  state.assistantMessages.push({
    role: message.role || "assistant",
    text: message.text || "",
    suggestedQuery: message.suggestedQuery || "",
    canExecuteSearch: Boolean(message.canExecuteSearch),
    results: Array.isArray(message.results) ? message.results : [],
    likelyMatches: Array.isArray(message.likelyMatches) ? message.likelyMatches : [],
    claimDraft: message.claimDraft || null,
  });
  renderAssistantMessages();
}

function renderAssistantResults(container, matches = [], { limit = 4 } = {}) {
  const visibleMatches = matches.slice(0, limit);
  if (!visibleMatches.length) return;

  const list = document.createElement("div");
  list.className = "assistant-results";
  const topScore = Math.max(...visibleMatches.map(assistantResultScore), 0);
  visibleMatches.forEach((match, index) => {
    const card = createAssistantResultCard(match, index, topScore);
    if (card) list.append(card);
  });
  if (list.children.length) {
    container.append(list);
  }
}

function renderAssistantMessages() {
  if (!assistantMessages) return;
  assistantMessages.replaceChildren();
  state.assistantMessages.forEach((entry) => {
    const bubble = document.createElement("article");
    bubble.className = `assistant-message ${entry.role === "user" ? "is-user" : "is-assistant"}`;
    const text = document.createElement("p");
    text.textContent = entry.text || "";
    bubble.append(text);

    if (entry.suggestedQuery) {
      const queryRow = document.createElement("div");
      queryRow.className = "assistant-query-row";
      const queryChip = document.createElement("span");
      queryChip.className = "assistant-query-chip";
      queryChip.textContent = entry.suggestedQuery;
      queryRow.append(queryChip);
      if (entry.canExecuteSearch) {
        const runButton = document.createElement("button");
        runButton.type = "button";
        runButton.className = "ghost-button small-button";
        runButton.textContent = langText({ en: "Run search", "zh-CN": "运行搜索", th: "ค้นหา" });
        runButton.addEventListener("click", () => runAssistantSearch(entry.suggestedQuery));
        queryRow.append(runButton);
      }
      const openReportsButton = document.createElement("button");
      openReportsButton.type = "button";
      openReportsButton.className = "ghost-button small-button";
      openReportsButton.textContent = langText({ en: "Open reports", "zh-CN": "打开报告", th: "เปิดรายงาน" });
      openReportsButton.addEventListener("click", () => openAssistantQueryInReports(entry.suggestedQuery));
      queryRow.append(openReportsButton);
      bubble.append(queryRow);
    }

    renderAssistantClaimDraft(bubble, entry.claimDraft);
    renderAssistantResults(bubble, entry.results.length ? entry.results : entry.likelyMatches);
    assistantMessages.append(bubble);
  });
  scrollAssistantToBottom();
}

function ensureAssistantWelcome() {
  if (state.assistantMessages.length) return;
  pushAssistantMessage({ role: "assistant", text: assistantWelcomeCopy() });
}

function openAssistantPanel() {
  assistantPanel?.classList.remove("is-hidden");
  assistantLauncherButtons.forEach((button) => button.setAttribute("aria-expanded", "true"));
  chatbotDebugState.modalStateChanged = true;
  logChatbotDebug("open-panel");
  ensureAssistantWelcome();
  window.requestAnimationFrame(() => {
    assistantPanel?.focus({ preventScroll: true });
    (state.assistantMode === "query" ? assistantQueryInput : assistantInput)?.focus();
  });
}

function closeAssistantPanel() {
  assistantPanel?.classList.add("is-hidden");
  assistantLauncherButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
  chatbotDebugState.modalStateChanged = true;
  logChatbotDebug("close-panel");
}

function openAssistantQueryInReports(query) {
  const value = String(query || "").trim();
  if (value && searchInput) {
    searchInput.value = value;
    invalidateSearchCache();
  }
  navigateTo("reports");
  if (value) {
    void loadItems();
  }
}

async function sendAssistantRequest({ message, executeSearch = false, query = "" }) {
  return apiFetch("/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      language: currentLanguage(),
      execute_search: executeSearch,
      query,
    }),
  });
}

async function submitAssistantChat(event) {
  event.preventDefault();
  if (state.assistantRequestInFlight) return;
  const message = assistantInput.value.trim();
  if (!message) {
    setMessage(assistantStatus, langText({ en: "Type a message first.", "zh-CN": "请先输入消息。", th: "กรุณาพิมพ์ข้อความก่อน" }), true);
    return;
  }

  state.assistantLastMessage = message;
  state.assistantRequestInFlight = true;
  setButtonLoading(assistantSubmitButton, true);
  setMessage(assistantStatus, langText({ en: "Thinking...", "zh-CN": "正在思考...", th: "กำลังคิด..." }));
  assistantInput.value = "";
  pushAssistantMessage({ role: "user", text: message });

  try {
    const data = await sendAssistantRequest({ message });
    state.assistantLastQuery = data.suggested_query || "";
    pushAssistantMessage({
      role: "assistant",
      text: data.reply || assistantWelcomeCopy(),
      suggestedQuery: data.suggested_query || "",
      canExecuteSearch: data.can_execute_search,
      likelyMatches: data.likely_matches || [],
      results: data.results || [],
    });
    if (shouldGenerateAssistantClaimDraft(message)) {
      pushAssistantMessage({
        role: "assistant",
        text: langText({ en: "Structured claim draft", "zh-CN": "结构化认领草稿", th: "แบบร่างคำขอแบบมีโครงสร้าง" }),
        claimDraft: buildAssistantClaimDraft(message),
      });
    }
    setMessage(assistantStatus, "");
    triggerHaptic("success");
  } catch (error) {
    pushAssistantMessage({ role: "assistant", text: assistantMessageTextFromError(error) });
    setMessage(assistantStatus, error.message, true);
    logClientError("assistant chat failed", error);
  } finally {
    state.assistantRequestInFlight = false;
    setButtonLoading(assistantSubmitButton, false);
  }
}

async function runAssistantSearch(query) {
  const searchQuery = String(query || state.assistantLastQuery || "").trim();
  const message = state.assistantLastMessage || searchQuery || "Search reports";
  if (!searchQuery || state.assistantRequestInFlight) return;

  state.assistantRequestInFlight = true;
  setButtonLoading(assistantSubmitButton, true);
  setMessage(assistantStatus, langText({ en: "Searching reports...", "zh-CN": "正在搜索报告...", th: "กำลังค้นหารายงาน..." }));
  try {
    const data = await sendAssistantRequest({ message, executeSearch: true, query: searchQuery });
    pushAssistantMessage({
      role: "assistant",
      text: data.reply || langText({ en: "Search complete.", "zh-CN": "搜索完成。", th: "ค้นหาเสร็จแล้ว" }),
      suggestedQuery: data.suggested_query || searchQuery,
      canExecuteSearch: false,
      likelyMatches: [],
      results: data.results || [],
    });
    setMessage(assistantStatus, "");
    triggerHaptic("success");
  } catch (error) {
    pushAssistantMessage({ role: "assistant", text: assistantMessageTextFromError(error) });
    setMessage(assistantStatus, error.message, true);
    logClientError("assistant search failed", error, { query: searchQuery });
  } finally {
    state.assistantRequestInFlight = false;
    setButtonLoading(assistantSubmitButton, false);
  }
}

function handleAssistantClaimDraft() {
  const source = assistantInput.value.trim() || state.assistantLastMessage || "";
  if (!source) {
    setMessage(assistantStatus, langText({
      en: "Type what you lost first.",
      "zh-CN": "请先输入你遗失的物品。",
      th: "กรุณาพิมพ์สิ่งที่คุณทำหายก่อน",
    }), true);
    return;
  }
  const draft = buildAssistantClaimDraft(source);
  assistantInput.value = "";
  pushAssistantMessage({
    role: "assistant",
    text: langText({ en: "Structured claim draft", "zh-CN": "结构化认领草稿", th: "แบบร่างคำขอแบบมีโครงสร้าง" }),
    claimDraft: draft,
  });
  setMessage(assistantStatus, "");
}

function renderAssistantQueryResults({ query = "", results = [], suggestedQuery = "", actions = [] } = {}) {
  if (!assistantQueryResults) return;
  assistantQueryResults.replaceChildren();

  const panel = document.createElement("article");
  panel.className = "assistant-query-summary";

  const heading = document.createElement("div");
  heading.className = "assistant-query-summary-head";
  const title = document.createElement("h4");
  title.textContent = langText({ en: "Matched items", "zh-CN": "匹配物品", th: "รายการที่ตรงกัน" });
  const count = document.createElement("span");
  count.className = "assistant-score-badge";
  count.textContent = String(results.length);
  heading.append(title, count);

  const queryLine = document.createElement("p");
  queryLine.className = "assistant-structured-meta";
  queryLine.textContent = suggestedQuery && suggestedQuery !== query ? `${query} -> ${suggestedQuery}` : query;

  panel.append(heading, queryLine);
  if (results.length) {
    renderAssistantResults(panel, results, { limit: 10 });
  } else {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = langText({
      en: "No ranked matches. Try fewer words, a category, or a campus location.",
      "zh-CN": "没有排序匹配结果。可以减少关键词，或输入分类、校园地点。",
      th: "ไม่พบรายการที่ตรงกัน ลองใช้คำให้น้อยลง หมวดหมู่ หรือสถานที่ในโรงเรียน",
    });
    panel.append(empty);
  }

  const suggestions = uniqueValues([
    suggestedQuery,
    ...actions.map((action) => typeof action === "string" ? action : action?.label || action?.query || ""),
  ].filter(Boolean)).slice(0, 4);
  if (suggestions.length) {
    const suggestionRow = document.createElement("div");
    suggestionRow.className = "assistant-query-suggestions";
    suggestions.forEach((suggestion) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ghost-button small-button";
      button.textContent = suggestion;
      button.addEventListener("click", () => {
        assistantQueryInput.value = suggestion;
        assistantQueryForm?.requestSubmit();
      });
      suggestionRow.append(button);
    });
    panel.append(suggestionRow);
  }

  assistantQueryResults.append(panel);
}

async function submitAssistantQuery(event) {
  event.preventDefault();
  if (state.assistantRequestInFlight) return;
  const query = assistantQueryInput.value.trim();
  if (!query) {
    setMessage(assistantQueryStatus, langText({
      en: "Enter a search query first.",
      "zh-CN": "请先输入搜索内容。",
      th: "กรุณาใส่คำค้นหาก่อน",
    }), true);
    return;
  }

  state.assistantQueryLastQuery = query;
  state.assistantRequestInFlight = true;
  setButtonLoading(assistantQuerySubmitButton, true);
  setMessage(assistantQueryStatus, langText({ en: "Searching...", "zh-CN": "正在搜索...", th: "กำลังค้นหา..." }));
  assistantQueryResults?.replaceChildren();

  try {
    const data = await sendAssistantRequest({ message: query, executeSearch: true, query });
    const results = Array.isArray(data.results) ? data.results : [];
    state.assistantQueryResults = results;
    renderAssistantQueryResults({
      query,
      results,
      suggestedQuery: data.suggested_query || query,
      actions: data.suggested_actions || [],
    });
    setMessage(assistantQueryStatus, "");
    triggerHaptic("success");
  } catch (error) {
    setMessage(assistantQueryStatus, error.message, true);
    assistantQueryResults.replaceChildren();
    const message = document.createElement("p");
    message.className = "status-message is-error";
    message.textContent = error.message;
    assistantQueryResults.append(message);
    logClientError("assistant structured query failed", error, { query });
  } finally {
    state.assistantRequestInFlight = false;
    setButtonLoading(assistantQuerySubmitButton, false);
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const shouldPlayIntro = state.authView === "login";
  const registerError = validateRegisterFields();
  if (registerError) {
    setMessage(authMessage, registerError, true);
    return;
  }
  if (state.authView === "login" && !authEmailLooksValid()) {
    setMessage(authMessage, langText({
      en: "Enter a valid email address.",
      "zh-CN": "请输入有效邮箱地址。",
      th: "กรุณาใส่อีเมลที่ถูกต้อง",
    }), true);
    return;
  }

  setButtonLoading(authSubmitButton, true);
  setMessage(authMessage, langText({
    en: `${titleCase(state.authView)} in progress...`,
    "zh-CN": `${state.authView === "login" ? "正在登录" : "正在注册"}...`,
    th: `${state.authView === "login" ? "กำลังเข้าสู่ระบบ" : "กำลังสมัครสมาชิก"}...`,
  }));

  try {
    const payload = state.authView === "register"
      ? {
          email: authEmailValue(),
          password: authPassword.value,
          email_verification_token: state.emailVerificationToken,
        }
      : {
          email: authEmailValue(),
          password: authPassword.value,
        };

    const data = await apiFetch(state.authView === "login" ? "/login" : "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    persistSession(data.token);
    state.user = applyFreshUser(data.user);
    setLanguage(state.user?.preferred_language || state.language);
    authForm.reset();
    resetEmailVerificationState({ keepMessage: true });
    setMessage(authMessage, state.authView === "login"
      ? langText({ en: "Logged in.", "zh-CN": "已登录。", th: "เข้าสู่ระบบแล้ว" })
      : langText({ en: "Account created.", "zh-CN": "账号已创建。", th: "สร้างบัญชีแล้ว" }));
    await enterAuthenticatedApp({ playIntro: shouldPlayIntro });
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
    state.user = applyFreshUser(data.user);
    setLanguage(state.user?.preferred_language || state.language);
    await enterAuthenticatedApp();
  } catch (error) {
    clearSession();
    showAuthScreen();
    logClientError("restoring session failed", error);
  }
}

async function enterAuthenticatedApp({ playIntro = false } = {}) {
  const introPromise = playIntro ? playLoginLoadingVideo() : Promise.resolve(false);
  if (!playIntro) {
    showAppShell();
  }
  renderCurrentAccountChip();
  syncModeUi();
  prefillReporter();
  dateInput.value = todayIso();
  updateLocationUi();
  renderAccount();
  const loadPromise = Promise.all([
    loadMapSystem(),
    loadFilters(),
    loadItems(),
    loadRoomItems(),
    loadReturnedItems(),
    loadClaims(),
    loadNotifications(),
    loadStatsSummary(),
    currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
  ]);
  await Promise.all([loadPromise, introPromise]);
  if (playIntro) {
    hideLoginLoadingVideo();
    showAppShell();
  }
  startNotificationPolling();
  if (playIntro) {
    const landingSection = currentUserIsStudent() ? "query" : "map";
    const landingHash = buildHash(landingSection);
    if (window.location.hash !== landingHash) {
      window.location.hash = landingHash;
    }
    await activateRoute({ section: landingSection, itemId: null });
  } else {
    await activateRoute(readRoute());
    await maybeStartTutorial();
  }
}

async function submitReport(event) {
  event.preventDefault();
  if (!currentUserCanCreateContent()) {
    setMessage(uploadMessage, "Student accounts cannot create reports.", true);
    setWarningCard(reportWarningCard, "Student accounts cannot create reports.");
    return;
  }
  if (submitButton.disabled) return;
  setWarningCard(reportWarningCard, "");
  const validationMessage = validateReportForm();
  if (validationMessage) {
    setMessage(uploadMessage, validationMessage, true);
    setWarningCard(reportWarningCard, validationMessage);
    return;
  }

  const location = currentLocation();
  const reportDraft = {
    file: state.selectedFile,
    reporterName: reporterInput.value.trim(),
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    evidenceDetails: evidenceDetailsInput.value.trim(),
    locationValue: location.value,
    locationMeta: location.meta,
    category: categoryInput.value,
    eventDate: dateInput.value,
    claimRequired: reportClaimRequiredValue(),
  };
  const activityId = createActivity({
    type: "report",
    title: langText({
      en: `Report: ${reportDraft.title}`,
      "zh-CN": `报告：${reportDraft.title}`,
      th: `รายงาน: ${reportDraft.title}`,
    }),
    stage: progressCopy("reportPrepare"),
    detail: langText({
      en: "Publishing in the background. You can close this window.",
      "zh-CN": "正在后台发布。你可以关闭这个窗口。",
      th: "กำลังเผยแพร่ในพื้นหลัง คุณสามารถปิดหน้าต่างนี้ได้",
    }),
    progress: 0,
    status: "running",
    target: "reports",
  });
  state.progressActivityIds.report = activityId;

  setButtonLoading(submitButton, true);
  setProgress("report", 0, progressCopy("reportPrepare"), true);
  setMessage(uploadMessage, langText({ en: "Publishing your report...", "zh-CN": "正在发布你的报告...", th: "กำลังเผยแพร่รายงานของคุณ..." }));
  try {
    const uploadFile = await prepareUploadFile(reportDraft.file, "report", {
      compress: progressCopy("reportCompress"),
      prepare: progressCopy("reportPrepare"),
    });
    const imagePayload = uploadFile
      ? {
          filename: uploadFile.name,
          content_type: uploadFile.type || "application/octet-stream",
          data: await readFileAsDataUrl(uploadFile),
        }
      : null;
    const requestBody = {
      reporter_name: reportDraft.reporterName,
      title: reportDraft.title,
      description: reportDraft.description,
      evidence_details: reportDraft.evidenceDetails,
      location: reportDraft.locationValue,
      secondary_location: reportDraft.locationMeta,
      category: reportDraft.category,
      event_date: reportDraft.eventDate,
      claim_required: reportDraft.claimRequired,
      time_slot: "Unknown",
      student_id: "",
      contact_info: "",
      color: "",
      image: imagePayload,
    };
    const serializedBody = JSON.stringify(requestBody);
    setProgress("report", 20, progressCopy("reportUpload"), true);

    const data = await apiRequestWithProgress("/items/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: serializedBody,
      onUploadProgress: (progressEvent) => updateUploadProgress("report", progressEvent, progressCopy("reportUpload")),
      onUploadComplete: () => startProcessingProgress("report", progressCopy("reportProcess")),
    });

    const item = data.item;
    if (uploadFile && item?.id) {
      state.previewUrls.set(item.id, URL.createObjectURL(uploadFile));
    }
    if (item?.id) {
      state.items = [
        item,
        ...state.items.filter((existingItem) => existingItem.id !== item.id),
      ];
      invalidateSearchCache();
      renderLocationScopedSurfaces();
    }
    form.reset();
    state.selectedFile = null;
    dropTitle.textContent = t("report.dropTitle");
    dropHint.textContent = t("report.dropHint");
    dateInput.value = todayIso();
    if (claimRequiredInput) claimRequiredInput.checked = true;
    if (noClaimRequiredInput) noClaimRequiredInput.checked = false;
    prefillReporter();
    updateLocationUi();
    updateReportClaimStatusUi();
    updateReportSubmitState();
    await completeProgress("report");
    completeActivity(activityId, {
      title: langText({
        en: `Report live: ${item?.title || reportDraft.title}`,
        "zh-CN": `报告已发布：${item?.title || reportDraft.title}`,
        th: `เผยแพร่รายงานแล้ว: ${item?.title || reportDraft.title}`,
      }),
      stage: langText({ en: "Report live", "zh-CN": "报告已发布", th: "รายงานเผยแพร่แล้ว" }),
      detail: langText({
        en: "Your report is live. AI review, matching, and notifications will continue in the background.",
        "zh-CN": "你的报告已上线。AI 审核、匹配和通知会继续在后台进行。",
        th: "รายงานเผยแพร่แล้ว การตรวจสอบ AI การจับคู่ และการแจ้งเตือนจะทำงานต่อในพื้นหลัง",
      }),
      target: "reports",
      itemId: item?.id || null,
    });
    setMessage(uploadMessage, langText({
      en: "Your report is now live. We'll notify you if a match is found.",
      "zh-CN": "你的报告已发布。如果发现匹配项，我们会通知你。",
      th: "รายงานของคุณเผยแพร่แล้ว เราจะแจ้งให้ทราบหากพบสิ่งของที่ตรงกัน",
    }));
    triggerHaptic("success");
    window.setTimeout(() => {
      closeReportModal();
    }, 700);
    setWarningCard(reportWarningCard, "");
    invalidateSearchCache();
    await Promise.all([loadItems(), loadStatsSummary()]);
  } catch (error) {
    resetProgress("report");
    failActivity(activityId, error, {
      title: langText({
        en: `Report failed: ${reportDraft.title}`,
        "zh-CN": `报告失败：${reportDraft.title}`,
        th: `รายงานไม่สำเร็จ: ${reportDraft.title}`,
      }),
      target: "reports",
    });
    setMessage(uploadMessage, langText({
      en: `Could not submit your report: ${error.message}`,
      "zh-CN": `报告提交失败：${error.message}`,
      th: `ไม่สามารถส่งรายงานได้: ${error.message}`,
    }), true);
    setWarningCard(reportWarningCard, error.message);
    logClientError("submitting report failed", error);
  } finally {
    clearProgressActivity("report");
    setButtonLoading(submitButton, false);
  }
}

async function uploadProfileImage() {
  const file = profileImageInput?.files?.[0];
  if (!file) {
    setMessage(profileImageMessage, langText({ en: "Choose an image first.", "zh-CN": "请先选择图片。", th: "กรุณาเลือกรูปภาพก่อน" }), true);
    return;
  }

  const validationMessage = validateReportImageFile(file);
  if (validationMessage) {
    setMessage(profileImageMessage, validationMessage, true);
    return;
  }

  const activityId = createActivity({
    type: "upload",
    title: langText({ en: "Profile photo upload", "zh-CN": "头像上传", th: "อัปโหลดรูปโปรไฟล์" }),
    stage: progressCopy("profileCompress"),
    detail: langText({
      en: "Uploading in the background.",
      "zh-CN": "正在后台上传。",
      th: "กำลังอัปโหลดในพื้นหลัง",
    }),
    progress: 0,
    status: "running",
    target: "account",
  });
  state.progressActivityIds.profile = activityId;
  setButtonLoading(profileImageButton, true);
  setProgress("profile", 0, progressCopy("profileCompress"), true);
  setMessage(profileImageMessage, langText({ en: "Uploading profile image...", "zh-CN": "正在上传头像...", th: "กำลังอัปโหลดรูปโปรไฟล์..." }));
  try {
    if (!state.profilePreviewUrl) {
      state.profilePreviewUrl = URL.createObjectURL(file);
      applyAvatar(accountAvatar, state.profilePreviewUrl, userAvatarLabel(state.user));
    }
    const uploadFile = await prepareUploadFile(file, "profile", {
      compress: progressCopy("profileCompress"),
      prepare: progressCopy("profileUpload"),
    });
    const requestBody = JSON.stringify({
      filename: uploadFile.name,
      content_type: uploadFile.type || "application/octet-stream",
      data: await readFileAsDataUrl(uploadFile),
    });
    setProgress("profile", 20, progressCopy("profileUpload"), true);
    const data = await apiRequestWithProgress("/account/profile-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      onUploadProgress: (progressEvent) => updateUploadProgress("profile", progressEvent, progressCopy("profileUpload")),
      onUploadComplete: () => startProcessingProgress("profile", progressCopy("profileProcess")),
    });
    const avatarVersion = data.avatar_version || Date.now();
    state.user = applyFreshUser(data.user || state.user, avatarVersion);
    const sessionData = await apiFetch("/session");
    state.user = applyFreshUser(sessionData.user || state.user, avatarVersion);
    if (!state.user?.avatar_url) {
      throw new Error("Upload completed, but the server did not return a profile image URL.");
    }
    const avatarLoaded = await probeImageUrl(state.user.avatar_url);
    if (!avatarLoaded) {
      logClientError("uploaded profile image could not be loaded", new Error("Avatar image failed to load"), {
        avatarUrl: state.user.avatar_url,
      });
      throw new Error("Profile image saved, but the browser could not load it from the uploads route.");
    }
    revokeProfilePreviewUrl();
    renderAccount();
    renderCurrentAccountChip();
    await completeProgress("profile");
    completeActivity(activityId, {
      stage: langText({ en: "Photo updated", "zh-CN": "头像已更新", th: "อัปเดตรูปแล้ว" }),
      detail: langText({
        en: "Your account photo is updated.",
        "zh-CN": "你的账号头像已更新。",
        th: "รูปบัญชีของคุณอัปเดตแล้ว",
      }),
      target: "account",
    });
    setMessage(profileImageMessage, data.message || langText({ en: "Profile image updated.", "zh-CN": "头像已更新。", th: "อัปเดตรูปโปรไฟล์แล้ว" }));
    triggerHaptic("success");
    invalidateSearchCache();
    state.queryCache.clear();
    state.queryResultCache.clear();
    await Promise.all([
      loadItems(),
      loadNotifications(),
      currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
      state.currentView === "query" ? loadQueryPage(state.currentQueryItem?.id || null) : Promise.resolve(),
    ]);
    renderAccount();
    renderCurrentAccountChip();
    renderNotifications();
    if (currentUserCanAdmin() && state.currentView === "admin") {
      await loadAdminMonitor();
    }
    if (profileImageInput) profileImageInput.value = "";
  } catch (error) {
    resetProgress("profile");
    failActivity(activityId, error, {
      title: langText({ en: "Profile upload failed", "zh-CN": "头像上传失败", th: "อัปโหลดรูปไม่สำเร็จ" }),
      target: "account",
    });
    setMessage(profileImageMessage, error.message, true);
    logClientError("uploading profile image failed", error);
  } finally {
    clearProgressActivity("profile");
    setButtonLoading(profileImageButton, false);
  }
}

async function uploadRoomItems() {
  if (!currentUserCanCreateContent()) {
    setMessage(roomUploadMessage, "Student accounts cannot create returned-item posts.", true);
    return;
  }
  const files = Array.from(roomUploadInput.files || []);
  if (!files.length) {
    setMessage(roomUploadMessage, langText({
      en: "Choose at least one image for the room.",
      "zh-CN": "请至少选择一张招领室图片。",
      th: "กรุณาเลือกรูปภาพอย่างน้อยหนึ่งรูป",
    }), true);
    return;
  }

  const activityId = createActivity({
    type: "upload",
    title: langText({
      en: `Room upload (${files.length})`,
      "zh-CN": `招领室上传（${files.length}）`,
      th: `อัปโหลดเข้าห้อง (${files.length})`,
    }),
    stage: langText({ en: "Preparing room images", "zh-CN": "正在准备招领室图片", th: "กำลังเตรียมรูปภาพ" }),
    detail: langText({
      en: "Adding items to the Lost & Found Room in the background.",
      "zh-CN": "正在后台添加物品到失物招领室。",
      th: "กำลังเพิ่มสิ่งของเข้าห้องของหายในพื้นหลัง",
    }),
    progress: 8,
    status: "running",
    target: "room",
  });
  state.progressActivityIds.room = activityId;
  setButtonLoading(uploadRoomButton, true);
  setMessage(roomUploadMessage, langText({
    en: "Uploading room items...",
    "zh-CN": "正在上传招领室物品...",
    th: "กำลังอัปโหลดสิ่งของเข้าห้องของหาย...",
  }));

  try {
    const images = [];
    for (const [index, file] of files.entries()) {
      updateActivity(activityId, {
        progress: 10 + Math.round((index / Math.max(1, files.length)) * 42),
        stage: langText({
          en: `Preparing image ${index + 1} of ${files.length}`,
          "zh-CN": `正在准备第 ${index + 1}/${files.length} 张图片`,
          th: `กำลังเตรียมรูป ${index + 1} จาก ${files.length}`,
        }),
      });
      const validationMessage = validateReportImageFile(file);
      if (validationMessage) {
        throw new Error(validationMessage);
      }
      let uploadFile = file;
      if (REPORT_ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension(file.name))) {
        try {
          uploadFile = await compressImageFile(file);
        } catch (error) {
          if (!SERVER_SIDE_IMAGE_CONVERSION_EXTENSIONS.includes(fileExtension(file.name))) {
            throw error;
          }
        }
      }
      images.push({
        filename: uploadFile.name,
        content_type: uploadFile.type || "application/octet-stream",
        data: await readFileAsDataUrl(uploadFile),
      });
    }

    updateActivity(activityId, {
      progress: 68,
      stage: langText({ en: "Uploading to room", "zh-CN": "正在上传到招领室", th: "กำลังอัปโหลดเข้าห้อง" }),
    });
    const data = await apiFetch("/room/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: roomLabelInput.value.trim(),
        images,
      }),
    });
    roomUploadInput.value = "";
    roomLabelInput.value = "";
    setMessage(roomUploadMessage, data.message || "Item added to Lost & Found Room");
    triggerHaptic("success");
    await refreshItemSurfaces({ includeAdmin: currentUserCanAdmin(), includeNotifications: true });
    completeActivity(activityId, {
      stage: langText({ en: "Room upload complete", "zh-CN": "招领室上传完成", th: "อัปโหลดเข้าห้องเสร็จแล้ว" }),
      detail: data.message || langText({
        en: "Items added to Lost & Found Room.",
        "zh-CN": "物品已添加到失物招领室。",
        th: "เพิ่มสิ่งของเข้าห้องของหายแล้ว",
      }),
      target: "room",
    });
  } catch (error) {
    failActivity(activityId, error, {
      title: langText({ en: "Room upload failed", "zh-CN": "招领室上传失败", th: "อัปโหลดเข้าห้องไม่สำเร็จ" }),
      target: "room",
    });
    setMessage(roomUploadMessage, error.message, true);
    logClientError("uploading room items failed", error);
  } finally {
    clearProgressActivity("room");
    setButtonLoading(uploadRoomButton, false);
  }
}

function formatRoomPreviewCoord(value) {
  return Number(Number(value).toFixed(4));
}

function cloneRoomPreviewPoints(points = []) {
  return points.map((point) => ({
    x: Number(point.x),
    y: Number(point.y),
  }));
}

function clampRoomPreviewPoint(point) {
  return {
    x: Math.min(1, Math.max(0, Number(point.x || 0))),
    y: Math.min(1, Math.max(0, Number(point.y || 0))),
  };
}

function roomPreviewCircleSelection() {
  return {
    x: Number(roomPreviewCircle.dataset.x || 0.5),
    y: Number(roomPreviewCircle.dataset.y || 0.5),
    radius: Number(roomPreviewCircle.dataset.radius || 0.18),
  };
}

function pointDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roomPreviewPointBounds(points = []) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), {
    minX: 1,
    minY: 1,
    maxX: 0,
    maxY: 0,
  });
}

function roomPreviewSelection() {
  const points = state.roomPreviewPathPoints || [];
  if (points.length >= 3) {
    const bounds = roomPreviewPointBounds(points);
    return {
      type: "path",
      points: points.map((point) => [
        formatRoomPreviewCoord(point.x),
        formatRoomPreviewCoord(point.y),
      ]),
      bounding_box: {
        left: formatRoomPreviewCoord(bounds.minX),
        top: formatRoomPreviewCoord(bounds.minY),
        right: formatRoomPreviewCoord(bounds.maxX),
        bottom: formatRoomPreviewCoord(bounds.maxY),
      },
    };
  }
  return roomPreviewCircleSelection();
}

function applyRoomPreviewSelection(selection = roomPreviewCircleSelection()) {
  const x = Math.min(1, Math.max(0, Number(selection.x || 0.5)));
  const y = Math.min(1, Math.max(0, Number(selection.y || 0.5)));
  const radius = Math.min(0.48, Math.max(0.04, Number(selection.radius || 0.18)));
  roomPreviewCircle.dataset.x = String(x);
  roomPreviewCircle.dataset.y = String(y);
  roomPreviewCircle.dataset.radius = String(radius);
  roomPreviewCircle.style.left = `${(x - radius) * 100}%`;
  roomPreviewCircle.style.top = `${(y - radius) * 100}%`;
  roomPreviewCircle.style.width = `${radius * 200}%`;
  roomPreviewCircle.style.height = `${radius * 200}%`;
}

function roomPreviewImageLayerRect() {
  const stageRect = roomPreviewStage?.getBoundingClientRect();
  if (!stageRect?.width || !stageRect?.height) return null;

  const naturalWidth = roomPreviewImage?.naturalWidth || 0;
  const naturalHeight = roomPreviewImage?.naturalHeight || 0;
  if (!naturalWidth || !naturalHeight) {
    return {
      left: 0,
      top: 0,
      width: stageRect.width,
      height: stageRect.height,
      stageRect,
    };
  }

  const stageRatio = stageRect.width / stageRect.height;
  const imageRatio = naturalWidth / naturalHeight;
  let width = stageRect.width;
  let height = stageRect.height;
  let left = 0;
  let top = 0;

  if (imageRatio > stageRatio) {
    height = width / imageRatio;
    top = (stageRect.height - height) / 2;
  } else {
    width = height * imageRatio;
    left = (stageRect.width - width) / 2;
  }

  return { left, top, width, height, stageRect };
}

function syncRoomPreviewSelectionLayer() {
  if (!roomPreviewSelectionLayer) return;
  const layerRect = roomPreviewImageLayerRect();
  if (!layerRect) return;
  roomPreviewSelectionLayer.style.left = `${layerRect.left}px`;
  roomPreviewSelectionLayer.style.top = `${layerRect.top}px`;
  roomPreviewSelectionLayer.style.width = `${layerRect.width}px`;
  roomPreviewSelectionLayer.style.height = `${layerRect.height}px`;
}

function scheduleRoomPreviewLayerSync() {
  if (state.roomPreviewLayerFrame) return;
  state.roomPreviewLayerFrame = window.requestAnimationFrame(() => {
    state.roomPreviewLayerFrame = 0;
    syncRoomPreviewSelectionLayer();
    renderRoomPreviewSelection();
  });
}

function roomPreviewPointFromClient(clientX, clientY) {
  const layerRect = roomPreviewImageLayerRect();
  if (!layerRect?.width || !layerRect?.height) return null;
  const x = (clientX - layerRect.stageRect.left - layerRect.left) / layerRect.width;
  const y = (clientY - layerRect.stageRect.top - layerRect.top) / layerRect.height;
  return clampRoomPreviewPoint({ x, y });
}

function roomPreviewEventPoints(event) {
  const events = typeof event.getCoalescedEvents === "function"
    ? event.getCoalescedEvents()
    : [event];
  return events
    .map((coalescedEvent) => roomPreviewPointFromClient(coalescedEvent.clientX, coalescedEvent.clientY))
    .filter(Boolean);
}

function roomPreviewPointsToPath(points = [], { closed = true } = {}) {
  if (!points.length) return "";
  const command = (point) => `${formatRoomPreviewCoord(point.x)} ${formatRoomPreviewCoord(point.y)}`;
  if (points.length === 1) {
    return `M ${command(points[0])}`;
  }
  const lineCommands = points.slice(1).map((point) => `L ${command(point)}`).join(" ");
  return `M ${command(points[0])} ${lineCommands}${closed ? " Z" : ""}`;
}

function perpendicularRoomPreviewDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return pointDistance(point, start);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
}

function simplifyRoomPreviewPoints(points, epsilon) {
  if (points.length <= 2) return cloneRoomPreviewPoints(points);

  let index = 0;
  let maxDistance = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
    const distance = perpendicularRoomPreviewDistance(points[pointIndex], start, end);
    if (distance > maxDistance) {
      index = pointIndex;
      maxDistance = distance;
    }
  }

  if (maxDistance <= epsilon) {
    return [start, end];
  }

  const left = simplifyRoomPreviewPoints(points.slice(0, index + 1), epsilon);
  const right = simplifyRoomPreviewPoints(points.slice(index), epsilon);
  return left.slice(0, -1).concat(right);
}

function smoothRoomPreviewPoints(points, iterations = 2) {
  let current = cloneRoomPreviewPoints(points);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (current.length < 3) break;
    const next = [];
    for (let index = 0; index < current.length; index += 1) {
      const point = current[index];
      const nextPoint = current[(index + 1) % current.length];
      next.push({
        x: point.x * 0.75 + nextPoint.x * 0.25,
        y: point.y * 0.75 + nextPoint.y * 0.25,
      });
      next.push({
        x: point.x * 0.25 + nextPoint.x * 0.75,
        y: point.y * 0.25 + nextPoint.y * 0.75,
      });
    }
    current = next;
  }
  return current;
}

function limitRoomPreviewPoints(points, maxPoints = ROOM_SELECTION_MAX_POINTS) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const limited = points.filter((_, index) => index % step === 0);
  return limited.length >= 3 ? limited : points.slice(0, maxPoints);
}

function cleanupRoomPreviewPath(points = []) {
  const deduped = [];
  points.forEach((point) => {
    const clamped = clampRoomPreviewPoint(point);
    const previous = deduped[deduped.length - 1];
    if (!previous || pointDistance(previous, clamped) >= ROOM_SELECTION_MIN_DISTANCE) {
      deduped.push(clamped);
    }
  });

  if (deduped.length > 2 && pointDistance(deduped[0], deduped[deduped.length - 1]) < ROOM_SELECTION_MIN_DISTANCE * 1.5) {
    deduped.pop();
  }
  if (deduped.length < 3) return deduped;

  const simplified = simplifyRoomPreviewPoints(deduped, ROOM_SELECTION_SMOOTHING_EPSILON);
  const smoothed = smoothRoomPreviewPoints(simplified.length >= 3 ? simplified : deduped, 2);
  return limitRoomPreviewPoints(smoothed.map(clampRoomPreviewPoint));
}

function roomPreviewPointInPolygon(point, polygon = []) {
  if (!point || polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && (point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 0.00001) + current.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function renderRoomPreviewSelection() {
  const drawing = state.roomPreviewDrag?.mode === "drawPath";
  const points = drawing ? state.roomPreviewDraftPoints : state.roomPreviewPathPoints;
  const hasPath = points.length >= (drawing ? 2 : 3);
  if (roomPreviewSelectionPath) {
    roomPreviewSelectionPath.setAttribute("d", hasPath ? roomPreviewPointsToPath(points, { closed: !drawing }) : "");
  }
  roomPreviewStage?.classList.toggle("has-freehand-selection", hasPath);
  roomPreviewStage?.classList.toggle("is-drawing-selection", drawing);
  roomPreviewStage?.classList.toggle("is-moving-selection", state.roomPreviewDrag?.mode === "movePath");
  roomPreviewStage?.classList.toggle("is-circle-tool", state.roomPreviewTool === "circle" && !hasPath);
}

function requestRoomPreviewSelectionRender() {
  if (state.roomPreviewRenderFrame) return;
  state.roomPreviewRenderFrame = window.requestAnimationFrame(() => {
    state.roomPreviewRenderFrame = 0;
    renderRoomPreviewSelection();
  });
}

function captureRoomPreviewSnapshot() {
  return {
    tool: state.roomPreviewTool || "draw",
    circle: roomPreviewCircleSelection(),
    pathPoints: cloneRoomPreviewPoints(state.roomPreviewPathPoints),
  };
}

function roomPreviewSnapshotKey(snapshot) {
  return JSON.stringify({
    tool: snapshot.tool,
    circle: snapshot.circle,
    pathPoints: snapshot.pathPoints.map((point) => [
      formatRoomPreviewCoord(point.x),
      formatRoomPreviewCoord(point.y),
    ]),
  });
}

function updateRoomPreviewToolButtons() {
  roomDrawButton?.classList.toggle("is-active", state.roomPreviewTool !== "circle");
  roomCircleToolButton?.classList.toggle("is-active", state.roomPreviewTool === "circle");
  if (roomUndoSelectionButton) {
    roomUndoSelectionButton.disabled = state.roomPreviewUndoStack.length === 0;
  }
  renderRoomPreviewSelection();
}

function pushRoomPreviewUndoSnapshot() {
  const snapshot = captureRoomPreviewSnapshot();
  const currentKey = roomPreviewSnapshotKey(snapshot);
  const lastSnapshot = state.roomPreviewUndoStack[state.roomPreviewUndoStack.length - 1];
  if (lastSnapshot && roomPreviewSnapshotKey(lastSnapshot) === currentKey) return;
  state.roomPreviewUndoStack.push(snapshot);
  if (state.roomPreviewUndoStack.length > 12) {
    state.roomPreviewUndoStack.shift();
  }
  updateRoomPreviewToolButtons();
}

function markRoomPreviewSelectionChanged() {
  state.roomPreviewAnalysis = null;
  roomConfirmButton.disabled = true;
  renderTags(roomPreviewTags, []);
  roomPreviewResult.textContent = langText({
    en: "Selection ready. Analyze the selected area when it looks right.",
    "zh-CN": "选区已准备好。确认无误后分析选中区域。",
    th: "เลือกบริเวณแล้ว เมื่อตรงตามต้องการให้วิเคราะห์บริเวณที่เลือก",
  });
}

function restoreRoomPreviewSnapshot(snapshot) {
  if (!snapshot) return;
  state.roomPreviewTool = snapshot.tool || "draw";
  state.roomPreviewPathPoints = cloneRoomPreviewPoints(snapshot.pathPoints);
  state.roomPreviewDraftPoints = [];
  applyRoomPreviewSelection(snapshot.circle || { x: 0.5, y: 0.5, radius: 0.18 });
  markRoomPreviewSelectionChanged();
  updateRoomPreviewToolButtons();
}

function undoRoomPreviewSelection() {
  const snapshot = state.roomPreviewUndoStack.pop();
  restoreRoomPreviewSnapshot(snapshot);
  updateRoomPreviewToolButtons();
  triggerHaptic("selection");
}

function setRoomPreviewTool(tool) {
  if (tool === "circle") {
    if ((state.roomPreviewPathPoints || []).length) {
      pushRoomPreviewUndoSnapshot();
      state.roomPreviewPathPoints = [];
      state.roomPreviewDraftPoints = [];
      markRoomPreviewSelectionChanged();
    }
    state.roomPreviewTool = "circle";
  } else {
    state.roomPreviewTool = "draw";
  }
  updateRoomPreviewToolButtons();
}

function clearRoomPreviewSelection() {
  pushRoomPreviewUndoSnapshot();
  state.roomPreviewTool = "draw";
  state.roomPreviewPathPoints = [];
  state.roomPreviewDraftPoints = [];
  applyRoomPreviewSelection({ x: 0.5, y: 0.5, radius: 0.18 });
  markRoomPreviewSelectionChanged();
  updateRoomPreviewToolButtons();
  triggerHaptic("selection");
}

function resetRoomPreviewState() {
  state.roomPreviewAnalysis = null;
  state.roomPreviewDrag = null;
  state.roomPreviewTool = "draw";
  state.roomPreviewPathPoints = [];
  state.roomPreviewDraftPoints = [];
  state.roomPreviewUndoStack = [];
  setMessage(roomPreviewMessage, "");
  roomPreviewResult.textContent = langText({
    en: "No selection analysis yet.",
    "zh-CN": "还没有选区分析结果。",
    th: "ยังไม่มีผลการวิเคราะห์บริเวณที่เลือก",
  });
  roomConfirmButton.disabled = true;
  renderTags(roomPreviewTags, []);
  applyRoomPreviewSelection({ x: 0.5, y: 0.5, radius: 0.18 });
  scheduleRoomPreviewLayerSync();
  updateRoomPreviewToolButtons();
}

function closeRoomClaimPreview() {
  state.activeRoomPreviewItem = null;
  resetRoomPreviewState();
  if (roomClaimPreviewDialog.open) {
    closeDialogWithAnimation(roomClaimPreviewDialog);
  }
}

function openRoomClaimPreview(item) {
  if (!item?.image_url && !item?.image_path) {
    setWarningCard(roomWarningCard, langText({
      en: "This room item does not have a preview image yet.",
      "zh-CN": "这件招领室物品暂时没有预览图片。",
      th: "สิ่งของชิ้นนี้ยังไม่มีภาพตัวอย่าง",
    }));
    return;
  }
  state.activeRoomPreviewItem = item;
  roomClaimPreviewLabel.textContent = `${item.title || "Room item"} • ${roomItemTimestamp(item)}`;
  roomPreviewImage.src = resolveImageUrl(item);
  roomPreviewImage.alt = item.title || "Room item";
  resetRoomPreviewState();
  roomClaimPreviewDialog.classList.remove("is-closing");
  delete roomClaimPreviewDialog.dataset.closeToken;
  roomClaimPreviewDialog.showModal();
  scheduleRoomPreviewLayerSync();
  triggerHaptic("open");
}

function updateRoomPreviewPointer(clientX, clientY, mode) {
  const rect = roomPreviewImageLayerRect();
  if (!rect?.width || !rect?.height || !state.roomPreviewDrag) return;
  const start = state.roomPreviewDrag.start;
  const current = state.roomPreviewDrag.selection;
  const deltaX = (clientX - start.clientX) / rect.width;
  const deltaY = (clientY - start.clientY) / rect.height;
  let next = { ...current };

  if (mode === "move") {
    next.x = Math.min(1 - current.radius, Math.max(current.radius, start.x + deltaX));
    next.y = Math.min(1 - current.radius, Math.max(current.radius, start.y + deltaY));
  } else {
    const radiusDelta = Math.max(deltaX, deltaY);
    next.radius = Math.min(
      Math.min(start.x, start.y, 1 - start.x, 1 - start.y),
      Math.max(0.04, start.radius + radiusDelta),
    );
  }

  applyRoomPreviewSelection(next);
}

function handleRoomPreviewPointerDown(event) {
  if (!roomClaimPreviewDialog.open) return;
  const isResize = event.target === roomPreviewHandle;
  const selection = roomPreviewCircleSelection();
  pushRoomPreviewUndoSnapshot();
  state.roomPreviewTool = "circle";
  state.roomPreviewPathPoints = [];
  state.roomPreviewDraftPoints = [];
  state.roomPreviewDrag = {
    mode: isResize ? "resize" : "move",
    pointerId: event.pointerId,
    selection,
    start: {
      clientX: event.clientX,
      clientY: event.clientY,
      x: selection.x,
      y: selection.y,
      radius: selection.radius,
    },
  };
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
  markRoomPreviewSelectionChanged();
  updateRoomPreviewToolButtons();
}

function startRoomPreviewCircleMove(event, point) {
  pushRoomPreviewUndoSnapshot();
  state.roomPreviewPathPoints = [];
  state.roomPreviewDraftPoints = [];
  state.roomPreviewTool = "circle";
  const current = roomPreviewCircleSelection();
  const radius = Math.min(
    current.radius,
    Math.max(0.04, Math.min(point.x, point.y, 1 - point.x, 1 - point.y) || current.radius),
  );
  applyRoomPreviewSelection({
    x: Math.min(1 - radius, Math.max(radius, point.x)),
    y: Math.min(1 - radius, Math.max(radius, point.y)),
    radius,
  });
  const selection = roomPreviewCircleSelection();
  state.roomPreviewDrag = {
    mode: "move",
    pointerId: event.pointerId,
    selection,
    start: {
      clientX: event.clientX,
      clientY: event.clientY,
      x: selection.x,
      y: selection.y,
      radius: selection.radius,
    },
  };
  markRoomPreviewSelectionChanged();
  updateRoomPreviewToolButtons();
}

function startRoomPreviewPathMove(event, point) {
  pushRoomPreviewUndoSnapshot();
  state.roomPreviewDrag = {
    mode: "movePath",
    pointerId: event.pointerId,
    startPoint: point,
    points: cloneRoomPreviewPoints(state.roomPreviewPathPoints),
  };
  roomPreviewStage?.classList.add("is-moving-selection");
  markRoomPreviewSelectionChanged();
  requestRoomPreviewSelectionRender();
}

function startRoomPreviewPathDraw(event, point) {
  pushRoomPreviewUndoSnapshot();
  state.roomPreviewTool = "draw";
  state.roomPreviewPathPoints = [];
  state.roomPreviewDraftPoints = [point];
  state.roomPreviewDrag = {
    mode: "drawPath",
    pointerId: event.pointerId,
  };
  markRoomPreviewSelectionChanged();
  updateRoomPreviewToolButtons();
  requestRoomPreviewSelectionRender();
  triggerHaptic("selection");
}

function handleRoomPreviewStagePointerDown(event) {
  if (!roomClaimPreviewDialog.open) return;
  if (event.button !== undefined && event.button !== 0) return;
  if (event.target === roomPreviewHandle || roomPreviewCircle?.contains(event.target)) return;

  const point = roomPreviewPointFromClient(event.clientX, event.clientY);
  if (!point) return;

  event.preventDefault();
  event.stopPropagation();
  roomPreviewStage?.setPointerCapture?.(event.pointerId);

  if (state.roomPreviewTool === "circle") {
    startRoomPreviewCircleMove(event, point);
    return;
  }

  if (state.roomPreviewPathPoints.length >= 3 && roomPreviewPointInPolygon(point, state.roomPreviewPathPoints)) {
    startRoomPreviewPathMove(event, point);
    return;
  }

  startRoomPreviewPathDraw(event, point);
}

function appendRoomPreviewDraftPoint(point) {
  const lastPoint = state.roomPreviewDraftPoints[state.roomPreviewDraftPoints.length - 1];
  if (!lastPoint || pointDistance(lastPoint, point) >= ROOM_SELECTION_MIN_DISTANCE) {
    state.roomPreviewDraftPoints.push(point);
  }
}

function updateRoomPreviewPathMove(point) {
  const drag = state.roomPreviewDrag;
  if (!drag?.points?.length || !point) return;
  const bounds = roomPreviewPointBounds(drag.points);
  const rawDeltaX = point.x - drag.startPoint.x;
  const rawDeltaY = point.y - drag.startPoint.y;
  const deltaX = Math.min(1 - bounds.maxX, Math.max(-bounds.minX, rawDeltaX));
  const deltaY = Math.min(1 - bounds.maxY, Math.max(-bounds.minY, rawDeltaY));
  state.roomPreviewPathPoints = drag.points.map((sourcePoint) => ({
    x: sourcePoint.x + deltaX,
    y: sourcePoint.y + deltaY,
  }));
}

function handleRoomPreviewPointerMove(event) {
  if (state.activeLayoutResize) {
    updateLayoutResize(event.clientX, event.clientY);
    return;
  }
  if (!state.roomPreviewDrag) return;
  if (state.roomPreviewDrag.pointerId !== undefined && event.pointerId !== state.roomPreviewDrag.pointerId) return;

  if (state.roomPreviewDrag.mode === "drawPath") {
    roomPreviewEventPoints(event).forEach(appendRoomPreviewDraftPoint);
    requestRoomPreviewSelectionRender();
    event.preventDefault();
    return;
  }

  if (state.roomPreviewDrag.mode === "movePath") {
    updateRoomPreviewPathMove(roomPreviewPointFromClient(event.clientX, event.clientY));
    requestRoomPreviewSelectionRender();
    event.preventDefault();
    return;
  }

  updateRoomPreviewPointer(event.clientX, event.clientY, state.roomPreviewDrag.mode);
  event.preventDefault();
}

function finishRoomPreviewPathDraw() {
  const cleaned = cleanupRoomPreviewPath(state.roomPreviewDraftPoints);
  const bounds = roomPreviewPointBounds(cleaned);
  if (cleaned.length >= 3 && bounds.maxX - bounds.minX >= 0.015 && bounds.maxY - bounds.minY >= 0.015) {
    state.roomPreviewPathPoints = cleaned;
  } else {
    const startPoint = state.roomPreviewDraftPoints[0] || { x: 0.5, y: 0.5 };
    state.roomPreviewPathPoints = [];
    state.roomPreviewTool = "circle";
    applyRoomPreviewSelection({
      x: startPoint.x,
      y: startPoint.y,
      radius: 0.08,
    });
  }
  state.roomPreviewDraftPoints = [];
  markRoomPreviewSelectionChanged();
}

function handleRoomPreviewPointerUp(event) {
  endLayoutResize();
  if (state.roomPreviewDrag?.pointerId !== undefined && event?.pointerId !== undefined && event.pointerId !== state.roomPreviewDrag.pointerId) return;
  if (state.roomPreviewDrag?.mode === "drawPath") {
    roomPreviewEventPoints(event).forEach(appendRoomPreviewDraftPoint);
    finishRoomPreviewPathDraw();
    triggerHaptic("selection");
  } else if (state.roomPreviewDrag?.mode === "movePath" || state.roomPreviewDrag?.mode === "move" || state.roomPreviewDrag?.mode === "resize") {
    markRoomPreviewSelectionChanged();
  }
  const pointerId = state.roomPreviewDrag?.pointerId;
  state.roomPreviewDrag = null;
  if (pointerId !== undefined) {
    roomPreviewStage?.releasePointerCapture?.(pointerId);
    roomPreviewCircle?.releasePointerCapture?.(pointerId);
  }
  updateRoomPreviewToolButtons();
  requestRoomPreviewSelectionRender();
}

async function analyzeRoomPreview() {
  const previewItem = state.activeRoomPreviewItem;
  if (!previewItem) return;
  const selection = roomPreviewSelection();
  const activityId = createActivity({
    type: "analysis",
    title: langText({
      en: `AI analysis: ${previewItem.title || "room item"}`,
      "zh-CN": `AI 分析：${previewItem.title || "招领室物品"}`,
      th: `วิเคราะห์ AI: ${previewItem.title || "สิ่งของ"}`,
    }),
    stage: langText({ en: "Analyzing item", "zh-CN": "正在分析物品", th: "กำลังวิเคราะห์สิ่งของ" }),
    detail: langText({
      en: "Analyzing the selected area in the background.",
      "zh-CN": "正在后台分析选中的区域。",
      th: "กำลังวิเคราะห์บริเวณที่เลือกในพื้นหลัง",
    }),
    progress: 30,
    status: "running",
    target: "room",
    itemId: previewItem.id,
  });
  state.progressActivityIds.analysis = activityId;
  roomConfirmButton.disabled = true;
  setButtonLoading(roomAnalyzeButton, true);
  setMessage(roomPreviewMessage, langText({
    en: "Analyzing the selected area...",
    "zh-CN": "正在分析选中的区域...",
    th: "กำลังวิเคราะห์บริเวณที่เลือก...",
  }));

  try {
    updateActivity(activityId, {
      progress: 72,
      stage: langText({ en: "Checking visual evidence", "zh-CN": "正在检查视觉证据", th: "กำลังตรวจสอบหลักฐานภาพ" }),
    });
    const data = await apiFetch(`/items/${previewItem.id}/claim-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selection }),
    });
    const stillOpen = roomClaimPreviewDialog.open && state.activeRoomPreviewItem?.id === previewItem.id;
    if (stillOpen) {
      state.roomPreviewAnalysis = data.preview || null;
      roomPreviewResult.textContent = data.preview?.description || "Selected area analyzed.";
      renderTags(roomPreviewTags, data.preview?.tags || []);
      roomConfirmButton.disabled = !state.roomPreviewAnalysis;
    }
    completeActivity(activityId, {
      stage: langText({ en: "Analysis ready", "zh-CN": "分析已完成", th: "วิเคราะห์พร้อมแล้ว" }),
      detail: data.preview?.description || langText({
        en: "Selected area analyzed. Reopen the room item if you want to continue claiming it.",
        "zh-CN": "选区已分析。如果要继续认领，请重新打开招领室物品。",
        th: "วิเคราะห์บริเวณที่เลือกแล้ว เปิดสิ่งของอีกครั้งหากต้องการยื่นคำขอต่อ",
      }),
      target: "room",
      itemId: previewItem.id,
    });
    triggerHaptic("success");
    if (stillOpen) {
      setMessage(roomPreviewMessage, langText({
        en: "If this matches your item, confirm and continue to the claim form.",
        "zh-CN": "如果这和你的物品一致，请确认并继续填写认领表单。",
        th: "หากตรงกับสิ่งของของคุณ ให้ยืนยันและดำเนินการต่อไปยังแบบฟอร์มคำขอ",
      }));
    }
  } catch (error) {
    failActivity(activityId, error, {
      title: langText({
        en: `AI analysis failed: ${previewItem.title || "room item"}`,
        "zh-CN": `AI 分析失败：${previewItem.title || "招领室物品"}`,
        th: `วิเคราะห์ AI ไม่สำเร็จ: ${previewItem.title || "สิ่งของ"}`,
      }),
      target: "room",
      itemId: previewItem.id,
    });
    if (roomClaimPreviewDialog.open && state.activeRoomPreviewItem?.id === previewItem.id) {
      setMessage(roomPreviewMessage, error.message, true);
    }
    logClientError("analyzing room preview failed", error, { itemId: previewItem.id });
  } finally {
    clearProgressActivity("analysis");
    setButtonLoading(roomAnalyzeButton, false);
  }
}

function confirmRoomPreviewSelection() {
  if (!state.activeRoomPreviewItem || !state.roomPreviewAnalysis) return;
  const item = state.activeRoomPreviewItem;
  const analysis = state.roomPreviewAnalysis;
  closeRoomClaimPreview();
  openClaimDialog(item, analysis);
}

function renderClaimDraftItemOptions(selectedItem = null) {
  if (!claimItemSelect) return;
  const selectedId = selectedItem?.id ? String(selectedItem.id) : "";
  claimItemSelect.replaceChildren(new Option(langText({
    en: "Create new claim draft context",
    "zh-CN": "创建新的认领草稿上下文",
    th: "สร้างบริบทแบบร่างคำขอใหม่",
  }), ""));
  const seen = new Set();
  const items = [...(state.queryItems || []), ...(state.items || [])].filter((item) => {
    if (!item?.id || seen.has(item.id) || item.claimed || item.claim_required === false) return false;
    seen.add(item.id);
    return true;
  });
  items.forEach((item) => {
    const label = [item.title, localizeValue(item.location), `#${item.id}`].filter(Boolean).join(" • ");
    claimItemSelect.append(new Option(label, String(item.id)));
  });
  claimItemSelect.value = selectedId;
}

function handleClaimDraftItemSelection() {
  const itemId = Number(claimItemSelect?.value || "") || null;
  const item = itemId ? findItemById(itemId) : null;
  state.activeClaimItem = item;
  claimItemLabel.textContent = item
    ? `${item.title} • ${item.location}`
    : langText({ en: "New private claim draft context", "zh-CN": "新的私人认领草稿上下文", th: "บริบทแบบร่างคำขอส่วนตัวใหม่" });
  if (item && !claimDraftTitleInput.value.trim()) {
    claimDraftTitleInput.value = `${item.title} claim`;
  }
}

function openClaimDialog(item = null, previewAnalysis = null, draft = null) {
  if (item?.claimed) {
    setMessage(uploadMessage, langText({ en: "This item has already been marked as claimed.", "zh-CN": "该物品已被标记为已认领。", th: "สิ่งของนี้ถูกทำเครื่องหมายว่ารับคืนแล้ว" }), true);
    return;
  }
  if (item && item.claim_required === false) {
    const message = directCollectionMessage(item);
    setWarningCard(searchWarningCard, message);
    setMessage(claimMessage, message);
    return;
  }

  state.activeClaimItem = item || null;
  state.roomPreviewAnalysis = previewAnalysis;
  claimForm.reset();
  renderClaimDraftItemOptions(item);
  setMessage(claimMessage, "");
  claimItemLabel.textContent = item
    ? `${item.title} • ${item.location}`
    : langText({ en: "Choose a report to attach this draft, or save it as new draft context.", "zh-CN": "请选择要关联的报告，或保存为新的草稿上下文。", th: "เลือกรายงานเพื่อแนบแบบร่าง หรือบันทึกเป็นบริบทแบบร่างใหม่" });
  claimDraftTitleInput.value = draft?.title || (item ? `${item.title} claim` : "");
  if (draft) {
    claimReasonInput.value = draft.reason || draft.claim_reason || "";
    claimDescriptionInput.value = draft.description || draft.item_description || "";
    claimLocationInput.value = draft.location || draft.lost_location || "";
    claimIdentifyingInput.value = draft.identifyingInfo || draft.identifying_info || "";
  }
  if (previewAnalysis) {
    claimReasonInput.value = langText({
      en: "The circled detail matches my item.",
      "zh-CN": "我圈出的细节和我的物品一致。",
      th: "รายละเอียดที่วงไว้ตรงกับสิ่งของของฉัน",
    });
    claimDescriptionInput.value = previewAnalysis.description || item.title || "";
    claimIdentifyingInput.value = (previewAnalysis.tags || []).join(", ");
  }
  claimDialog.classList.remove("is-closing");
  delete claimDialog.dataset.closeToken;
  claimDialog.showModal();
  triggerHaptic("open");
}

function closeClaimModal() {
  state.activeClaimItem = null;
  state.roomPreviewAnalysis = null;
  if (claimDialog.open) {
    closeDialogWithAnimation(claimDialog);
  }
}

async function submitClaim(event) {
  event.preventDefault();
  const selectedItemId = Number(claimItemSelect?.value || "") || null;
  const activeClaimItem = selectedItemId ? findItemById(selectedItemId) : state.activeClaimItem;

  const validationMessage = validateClaimForm();
  if (validationMessage) {
    setMessage(claimMessage, validationMessage, true);
    return;
  }

  const claimDraft = {
    item: activeClaimItem || null,
    title: claimDraftTitleInput.value.trim(),
    reason: claimReasonInput.value.trim(),
    description: claimDescriptionInput.value.trim(),
    lostLocation: claimLocationInput.value.trim(),
    identifyingInfo: claimIdentifyingInput.value.trim(),
    visualSelection: state.roomPreviewAnalysis?.selection || null,
    visualSummary: state.roomPreviewAnalysis?.description || "",
    visualTags: state.roomPreviewAnalysis?.tags || [],
  };
  const activityId = createActivity({
    type: "claim",
    title: langText({
      en: `Draft: ${claimDraft.item?.title || claimDraft.title || "claim"}`,
      "zh-CN": `草稿：${claimDraft.item?.title || claimDraft.title || "认领"}`,
      th: `แบบร่าง: ${claimDraft.item?.title || claimDraft.title || "คำขอ"}`,
    }),
    stage: langText({ en: "Saving draft", "zh-CN": "正在保存草稿", th: "กำลังบันทึกแบบร่าง" }),
    detail: langText({
      en: "Saving a private draft. It will not be submitted until you send it from My Claims.",
      "zh-CN": "正在保存私人草稿。你稍后可在我的认领中提交。",
      th: "กำลังบันทึกแบบร่างส่วนตัว จะยังไม่ส่งจนกว่าคุณจะส่งจากหน้าคำขอของฉัน",
    }),
    progress: 15,
    status: "running",
    target: "claims",
    itemId: claimDraft.item?.id || null,
  });
  state.progressActivityIds.claim = activityId;
  setButtonLoading(claimSubmitButton, true);
  setMessage(claimMessage, langText({ en: "Saving private claim draft...", "zh-CN": "正在保存私人认领草稿...", th: "กำลังบันทึกแบบร่างคำขอส่วนตัว..." }));
  updateActivity(activityId, {
    progress: 35,
    stage: langText({ en: "Preparing draft", "zh-CN": "正在准备草稿", th: "กำลังเตรียมแบบร่าง" }),
  });

  try {
    const data = await apiFetch("/claim-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: claimDraft.item?.id || null,
        title: claimDraft.title || claimDraft.item?.title || "",
        claim_reason: claimDraft.reason,
        item_description: claimDraft.description,
        lost_location: claimDraft.lostLocation,
        identifying_info: claimDraft.identifyingInfo,
        visual_selection: claimDraft.visualSelection,
        visual_summary: claimDraft.visualSummary,
        visual_tags: claimDraft.visualTags,
        source: "claim-builder",
      }),
    });
    updateActivity(activityId, {
      sourceKey: data.draft?.draft_id ? `claim-draft:${data.draft.draft_id}` : "",
      sourceStatus: "draft",
      progress: 100,
      status: "success",
      stage: langText({ en: "Draft saved", "zh-CN": "草稿已保存", th: "บันทึกแบบร่างแล้ว" }),
      detail: langText({
        en: "Open My Claims when you are ready to submit it for review.",
        "zh-CN": "准备好后，在我的认领中提交审核。",
        th: "เปิดหน้าคำขอของฉันเมื่อพร้อมส่งตรวจสอบ",
      }),
      claimId: data.draft?.draft_id || null,
    });
    setMessage(claimMessage, langText({
      en: "Claim draft saved. Submit it from My Claims when ready.",
      "zh-CN": "认领草稿已保存。准备好后可在我的认领中提交。",
      th: "บันทึกแบบร่างคำขอแล้ว ส่งจากหน้าคำขอของฉันเมื่อพร้อม",
    }));
    triggerHaptic("success");
    invalidateSearchCache();
    await Promise.all([loadClaims(), loadNotifications(), loadReturnedItems(), loadStatsSummary()]);
    window.setTimeout(closeClaimModal, 450);
  } catch (error) {
    failActivity(activityId, error, {
      title: langText({
        en: `Draft failed: ${claimDraft.item?.title || claimDraft.title || "claim"}`,
        "zh-CN": `草稿失败：${claimDraft.item?.title || claimDraft.title || "认领"}`,
        th: `บันทึกแบบร่างไม่สำเร็จ: ${claimDraft.item?.title || claimDraft.title || "คำขอ"}`,
      }),
      target: "claims",
      itemId: claimDraft.item?.id || null,
    });
    if (claimDialog.open) {
      setMessage(claimMessage, langText({
        en: `Could not save your draft: ${error.message}`,
        "zh-CN": `草稿保存失败：${error.message}`,
        th: `ไม่สามารถบันทึกแบบร่างได้: ${error.message}`,
      }), true);
    }
    logClientError("saving claim draft failed", error, { itemId: claimDraft.item?.id || null });
  } finally {
    clearProgressActivity("claim");
    setButtonLoading(claimSubmitButton, false);
  }
}

async function markItemClaimed(itemId, button) {
  setButtonLoading(button, true);
  try {
    await apiFetch(`/items/${itemId}/mark-claimed`, { method: "POST" });
    invalidateSearchCache();
    await Promise.all([
      loadItems(),
      loadRoomItems(),
      loadReturnedItems(),
      loadClaims(),
      loadStatsSummary(),
      currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
    ]);
    triggerHaptic("success");
  } catch (error) {
    setMessage(uploadMessage, error.message, true);
    logClientError("marking item claimed failed", error, { itemId });
  } finally {
    setButtonLoading(button, false);
  }
}

async function updateItemClaimRequirement(itemId, claimRequired, button) {
  setButtonLoading(button, true);
  try {
    await apiFetch(`/items/${itemId}/claim-requirement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim_required: Boolean(claimRequired) }),
    });
    invalidateSearchCache();
    await Promise.all([
      loadItems(),
      loadRoomItems(),
      loadReturnedItems(),
      currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
    ]);
    triggerHaptic("success");
  } catch (error) {
    setWarningCard(searchWarningCard, error.message);
    logClientError("updating claim requirement failed", error, { itemId, claimRequired });
  } finally {
    setButtonLoading(button, false);
  }
}

function selectFile(file) {
  if (!file) {
    state.selectedFile = null;
    if (dropTitle) {
      dropTitle.textContent = t("report.dropTitle");
    }
    if (dropHint) {
      dropHint.textContent = t("report.dropHint");
    }
    updateReportSubmitState();
    return;
  }
  const validationError = validateReportImageFile(file);
  if (validationError) {
    setMessage(uploadMessage, validationError, true);
    setWarningCard(reportWarningCard, validationError);
    state.selectedFile = null;
    return;
  }
  state.selectedFile = file;
  dropTitle.textContent = file.name;
  dropHint.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB selected`;
  updateReportSubmitState();
}

function debounceLoadItems() {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(loadItems, SEARCH_DEBOUNCE_MS);
}

function resetPreviewUrls() {
  state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  state.previewUrls.clear();
}

function logout() {
  const logoutUser = state.user ? (state.user.username || userDisplayName(state.user)) : "";
  const logoutRole = state.user ? currentUserRole() : "";
  stopQueryCamera();
  clearSession();
  closeTutorial({ markSeen: false, rememberSession: false });
  closeReportModal({ navigate: false });
  closeConfirmModal();
  closeImagePreview();
  closeRoomClaimPreview();
  renderClaimSuccessBanner(null);
  hideUndoToast();
  stopAdminMonitorPolling();
  stopNotificationPolling();
  resetPreviewUrls();
  revokeProfilePreviewUrl();
  if (state.layoutResizeFrame) {
    window.cancelAnimationFrame(state.layoutResizeFrame);
    state.layoutResizeFrame = 0;
  }
  state.searchCache.clear();
  state.queryCache.clear();
  state.queryResultCache.clear();
  state.items = [];
  state.roomItems = [];
  state.returnedItems = [];
  state.notifications = [];
  state.notificationsLoadedOnce = false;
  state.unreadNotifications = 0;
  state.activities = [];
  state.activityCollapsed = true;
  state.dismissedActivityKeys = new Set();
  localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  localStorage.removeItem(ACTIVITY_DISMISSED_STORAGE_KEY);
  state.queryItems = [];
  state.claims = [];
  state.adminUsers = [];
  state.adminItems = [];
  state.adminClaims = [];
  state.adminAudits = [];
  state.aiInspectionLogs = [];
  state.mapImageUrl = MAP_IMAGE_URL;
  state.mapImageVersion = Date.now();
  state.loadingVideoUrl = LOGIN_LOADING_VIDEO_URL;
  state.locations = normalizeSchoolLocations(SCHOOL_LOCATIONS);
  state.mapZones = [...SCHOOL_ZONES];
  state.mapRegions = [];
  state.mapStats = { regions: {}, zones: {} };
  state.selectedZone = null;
  state.selectedBox = null;
  state.expandedBox = null;
  state.selectedFloor = null;
  state.selectedLocation = null;
  state.selectedSubLocation = null;
  state.heatmapEnabled = true;
  state.cameraZoomState = { scale: 1, x: 0.5, y: 0.5 };
  state.activeReportFormContext = false;
  state.hoverLocation = null;
  state.hoverState = null;
  state.expandedMapTarget = null;
  state.adminMonitor = emptyAdminMonitor();
  state.adminTab = "users";
  state.statsSummary = { items_returned_this_week: 0 };
  state.activeLocationFilter = "";
  state.locationFilterSource = "";
  state.locationDrawerOpen = false;
  state.currentQueryItem = null;
  state.queryMessages = [];
  state.queryStructuredResults = [];
  state.selectedQueryFile = null;
  state.selectedQuestionReplyFile = null;
  state.questionBoard = [];
  state.activeQuestionThread = null;
  state.pendingQuestionThreadId = null;
  state.assistantMessages = [];
  state.assistantMode = "chat";
  state.assistantLastQuery = "";
  state.assistantLastMessage = "";
  state.assistantRequestInFlight = false;
  state.assistantQueryLastQuery = "";
  state.assistantQueryResults = [];
  state.tutorialDismissedForSession = false;
  state.panelState = {};
  state.autoMinimizedReports = false;
  state.multitaskRequested = false;
  state.multitaskActive = false;
  state.activeClaimSuccessNotificationId = null;
  state.activeLayoutResize = null;
  state.pendingLayoutResize = null;
  state.layoutSizes = {
    sidebarWidth: initialSidebarWidth,
    secondaryHeight: 320,
    secondaryWidth: 420,
  };
  gallery.replaceChildren();
  roomGallery.replaceChildren();
  returnedList.replaceChildren();
  claimsList.replaceChildren();
  adminUsersBody.replaceChildren();
  adminItemsList.replaceChildren();
  adminClaimsList.replaceChildren();
  adminAuditList.replaceChildren();
  adminInspectionList.replaceChildren();
  resetAdminMonitor();
  notificationList.replaceChildren();
  notificationPageList?.replaceChildren();
  notificationDropdown.classList.add("is-hidden");
  queryMessages.replaceChildren();
  questionBoardList?.replaceChildren();
  questionThreadBody?.replaceChildren();
  questionThreadPanel?.classList.add("is-hidden");
  assistantMessages?.replaceChildren();
  assistantQueryResults?.replaceChildren();
  assistantInput.value = "";
  assistantQueryInput.value = "";
  setAssistantMode("chat", { focus: false });
  closeAssistantPanel();
  showAdminButton.classList.add("is-hidden");
  showReportItemButton?.classList.remove("is-hidden");
  closeNewWindowMenu();
  syncNewWindowMenu();
  syncModeUi();
  setMessage(adminMessage, "");
  setWarningCard(reportWarningCard, "");
  setWarningCard(searchWarningCard, "");
  setWarningCard(queryWarningCard, "");
  setWarningCard(roomWarningCard, "");
  setWarningCard(returnedWarningCard, "");
  setMessage(queryMessage, "");
  setMessage(assistantStatus, "");
  setMessage(assistantQueryStatus, "");
  setMessage(profileImageMessage, "");
  setMessage(roomUploadMessage, "");
  setMessage(returnedMessage, "");
  renderStatsSummary();
  hideProgress("report");
  hideProgress("query");
  hideProgress("profile");
  Object.keys(state.progressActivityIds || {}).forEach(clearProgressActivity);
  renderActivityTracker();
  form.reset();
  clearSelectedQueryFile();
  clearSelectedQuestionReplyFile();
  stopReportCamera();
  updateReportSubmitState();
  switchAdminTab("users");
  persistCurrentItemId(null);
  showAuthScreen();
  setAuthView("login");
  window.location.hash = "";
  state.currentView = "dashboard";
  renderDefaultLayout();
  console.info("[LOGOUT DEBUG]", "user=", logoutUser, "role=", logoutRole, "success=", !state.user && !state.token);
}

function bindEvents() {
  bindWindowPanelEvents();
  bindGlobalHapticFeedback();
  [
    [authForm, "submit", submitAuth, "auth form submit"],
    [loginTab, "click", () => setAuthView("login"), "login tab"],
    [registerTab, "click", () => setAuthView("register"), "register tab"],
    [authEmail, "input", () => resetEmailVerificationState({ keepMessage: true }), "auth email change"],
    [authSendCodeButton, "click", requestEmailVerificationCode, "send email verification code"],
    [authVerificationCode, "input", syncEmailVerificationUi, "auth code input"],
    [authVerifyCodeButton, "click", verifyEmailCode, "verify email code"],
    [accountEmailInput, "input", () => resetAccountEmailChangeState({ keepMessage: true }), "account email input"],
    [accountEmailSendCodeButton, "click", requestAccountEmailChangeCode, "account email send code"],
    [accountEmailCodeInput, "input", syncAccountEmailChangeUi, "account email code input"],
    [accountEmailForm, "submit", submitAccountEmailChange, "account email change submit"],
    [authPasswordToggle, "click", () => setAuthPasswordVisibility(authPassword?.type === "password"), "password visibility"],
    [authConfirmPasswordToggle, "click", () => setAuthConfirmPasswordVisibility(authConfirmPassword?.type === "password"), "confirm password visibility"],
    [showDashboardButton, "click", () => navigateTo("dashboard"), "dashboard nav"],
    [showMapButton, "click", () => navigateTo("map"), "school map nav"],
    [showReportsButton, "click", () => navigateTo("reports"), "reports nav"],
    [showReportItemButton, "click", openReportModal, "report item nav"],
    [showRoomButton, "click", () => navigateTo("room"), "room nav"],
    [showReturnedButton, "click", () => navigateTo("returned"), "returned nav"],
    [showQueryButton, "click", () => navigateTo("query"), "query nav"],
    [showClaimsButton, "click", () => navigateTo("claims"), "claims nav"],
    [showNotificationsButton, "click", () => navigateTo("notifications"), "notifications nav"],
    [showAccountButton, "click", () => navigateTo("account"), "account nav"],
    [showAdminButton, "click", () => navigateTo("admin"), "admin nav"],
    [newWindowButton, "click", toggleNewWindowMenu, "new window menu"],
    [topbarReportButton, "click", openReportModal, "topbar report"],
    [topbarRefreshButton, "click", () => { void refreshCurrentView(); }, "topbar refresh"],
    [helpButton, "click", () => { void openTutorial(); }, "help walkthrough"],
    [topbarAccountButton, "click", () => navigateTo("account"), "topbar account"],
    [sidebarLauncherButton, "click", openLocationDrawer, "location browser launcher"],
    [sidebarDrawerBackdrop, "click", closeLocationDrawer, "location browser backdrop"],
    [sidebarCollapseButton, "click", toggleSidebarCollapse, "sidebar collapse"],
    [sidebarModeSelect, "change", () => setSidebarMode(sidebarModeSelect.value), "sidebar mode"],
    [mapBackButton, "click", () => goBackToPreviousRoute("dashboard"), "school map back"],
    [mapResetButton, "click", () => clearMapNavigation(), "school map campus reset"],
    [locationBackButton, "click", returnFromLocationFilter, "location filter back"],
    [clearLocationFilterButton, "click", () => setActiveLocationFilter("", { load: true, closeDrawer: false }), "clear location filter"],
    [queryBackButton, "click", () => navigateTo("reports"), "query back"],
    [themeToggleButton, "click", toggleThemeMode, "theme toggle"],
    [openReportModalButton, "click", openReportModal, "open report modal"],
    [assistantCloseButton, "click", closeAssistantPanel, "close assistant panel"],
    [assistantChatModeButton, "click", () => setAssistantMode("chat"), "assistant chat mode"],
    [assistantQueryModeButton, "click", () => setAssistantMode("query"), "assistant query mode"],
    [assistantClaimDraftButton, "click", handleAssistantClaimDraft, "assistant claim draft"],
    [assistantForm, "submit", submitAssistantChat, "assistant form submit"],
    [assistantQueryForm, "submit", submitAssistantQuery, "assistant query form submit"],
    [dashboardReportButton, "click", openReportModal, "dashboard report"],
    [dashboardRefreshButton, "click", () => { void refreshCurrentView(); }, "dashboard refresh"],
    [closeReportDialog, "click", closeReportModal, "close report modal"],
    [logoutButton, "click", logout, "logout"],
    [form, "submit", submitReport, "report form submit"],
    [imageInput, "change", () => selectFile(imageInput?.files?.[0] || null), "report image input"],
    [reportCameraInput, "change", () => selectFile(reportCameraInput?.files?.[0] || null), "report camera input"],
    [claimRequiredInput, "change", updateReportClaimStatusUi, "claim required option"],
    [noClaimRequiredInput, "change", updateReportClaimStatusUi, "no claim required option"],
    [reportCameraButton, "click", () => { void openReportCamera(); }, "report camera button"],
    [reportCameraCaptureButton, "click", async () => {
      try {
        await captureReportCameraPhoto();
      } catch (error) {
        setMessage(uploadMessage, error.message, true);
        setWarningCard(reportWarningCard, error.message);
        logClientError("capturing report camera photo failed", error);
      }
    }, "report camera capture"],
    [reportCameraCancelButton, "click", stopReportCamera, "report camera cancel"],
    [refreshButton, "click", loadItems, "refresh reports"],
    [refreshRoomButton, "click", loadRoomItems, "refresh room"],
    [refreshReturnedButton, "click", loadReturnedItems, "refresh returned"],
    [uploadRoomButton, "click", uploadRoomItems, "upload room items"],
    [refreshQueryItemsButton, "click", loadQueryItemOptions, "refresh query items"],
    [refreshClaimsButton, "click", loadClaims, "refresh claims"],
    [refreshNotificationsButton, "click", loadNotifications, "refresh notifications"],
    [refreshAdminButton, "click", loadAdminSurface, "refresh admin"],
    [adminUsersTab, "click", () => switchAdminTab("users"), "admin users tab"],
    [adminItemsTab, "click", () => switchAdminTab("items"), "admin items tab"],
    [adminClaimsTab, "click", () => switchAdminTab("claims"), "admin claims tab"],
    [adminInspectionTab, "click", () => switchAdminTab("inspection"), "admin inspection tab"],
    [startOllamaButton, "click", () => { void updateOllamaService("start", startOllamaButton); }, "start ollama"],
    [stopOllamaButton, "click", () => { void updateOllamaService("stop", stopOllamaButton); }, "stop ollama"],
    [schoolMapImage, "load", () => syncMapImageAspect(schoolMapImage), "school map image load"],
    [searchInput, "input", debounceLoadItems, "report search"],
    [categoryFilter, "change", loadItems, "category filter"],
    [statusFilter, "change", loadItems, "status filter"],
    [locationFilter, "change", () => setActiveLocationFilter(locationFilter.value, {
      updateSelect: false,
      load: true,
      focusDashboard: false,
      closeDrawer: false,
      source: "manual",
    }), "location filter"],
    [optionalLocationInput, "input", handleManualLocationInput, "manual location input"],
    [queryItemSelect, "change", handleQueryItemSelection, "query item select"],
    [queryForm, "submit", submitQuery, "query form submit"],
    [queryFileInput, "change", () => selectQueryFile(queryFileInput?.files?.[0] || null), "query file input"],
    [queryCameraInput, "change", () => selectQueryFile(queryCameraInput?.files?.[0] || null), "query camera input"],
    [queryCameraButton, "click", () => { void openQueryCamera(); }, "query camera button"],
    [queryCameraCaptureButton, "click", async () => {
      try {
        await captureQueryCameraPhoto();
      } catch (error) {
        setMessage(queryMessage, error.message, true);
        setWarningCard(queryWarningCard, error.message);
        logClientError("capturing query camera photo failed", error);
      }
    }, "query camera capture"],
    [queryCameraCancelButton, "click", stopQueryCamera, "query camera cancel"],
    [queryFileRemoveButton, "click", clearSelectedQueryFile, "clear query file"],
    [queryClearThreadButton, "click", clearCurrentQueryThread, "clear query thread"],
    [refreshQuestionBoardButton, "click", () => loadQuestionBoard(), "refresh question board"],
    [closeQuestionThreadButton, "click", closeQuestionThread, "close question thread"],
    [questionReplyForm, "submit", submitQuestionReply, "question reply form submit"],
    [questionReplyFileInput, "change", () => selectQuestionReplyFile(questionReplyFileInput?.files?.[0] || null), "question reply file input"],
    [questionReplyFileRemoveButton, "click", clearSelectedQuestionReplyFile, "clear question reply file"],
    [claimItemSelect, "change", handleClaimDraftItemSelection, "claim draft item select"],
    [claimForm, "submit", submitClaim, "claim form submit"],
    [cancelClaimButton, "click", closeClaimModal, "cancel claim"],
    [closeClaimDialog, "click", closeClaimModal, "close claim dialog"],
    [closeRoomClaimPreviewDialog, "click", closeRoomClaimPreview, "close room preview"],
    [roomPreviewCancelButton, "click", closeRoomClaimPreview, "cancel room preview"],
    [roomAnalyzeButton, "click", analyzeRoomPreview, "analyze room preview"],
    [roomConfirmButton, "click", confirmRoomPreviewSelection, "confirm room preview"],
    [roomDrawButton, "click", () => setRoomPreviewTool("draw"), "room preview draw tool"],
    [roomCircleToolButton, "click", () => setRoomPreviewTool("circle"), "room preview circle tool"],
    [roomUndoSelectionButton, "click", undoRoomPreviewSelection, "room preview undo selection"],
    [roomClearSelectionButton, "click", clearRoomPreviewSelection, "room preview clear selection"],
    [roomPreviewStage, "pointerdown", handleRoomPreviewStagePointerDown, "room preview freehand draw"],
    [roomPreviewCircle, "pointerdown", handleRoomPreviewPointerDown, "room preview drag circle"],
    [roomPreviewHandle, "pointerdown", handleRoomPreviewPointerDown, "room preview drag handle"],
    [roomPreviewImage, "load", scheduleRoomPreviewLayerSync, "room preview image loaded"],
    [cancelConfirmButton, "click", closeConfirmModal, "cancel confirm"],
    [closeConfirmDialog, "click", closeConfirmModal, "close confirm dialog"],
    [closeImagePreviewDialog, "click", closeImagePreview, "close image preview"],
    [undoToastClose, "click", hideUndoToast, "close undo toast"],
    [profileImageInput, "change", () => selectProfileImage(profileImageInput?.files?.[0] || null), "profile image input"],
    [profileImageButton, "click", uploadProfileImage, "upload profile image"],
    [advancedModeToggle, "change", () => setAdvancedMode(advancedModeToggle.checked), "advanced mode toggle"],
    [accountLogoutButton, "click", logout, "account logout"],
    [claimSuccessViewButton, "click", async () => {
      const notificationId = state.activeClaimSuccessNotificationId;
      if (notificationId) {
        await markNotificationRead(notificationId);
      }
      navigateTo("claims");
    }, "claim success view"],
    [claimSuccessDismissButton, "click", async () => {
      const notificationId = state.activeClaimSuccessNotificationId;
      if (notificationId) {
        await markNotificationRead(notificationId);
      } else {
        renderClaimSuccessBanner(null);
      }
    }, "claim success dismiss"],
    [activityTrackerToggle, "click", toggleActivityTracker, "activity tracker toggle"],
    [activityClearButton, "click", dismissCompletedActivities, "activity tracker clear completed"],
    [activityList, "click", handleActivityListClick, "activity tracker card action"],
    [tutorialBackButton, "click", () => { void rewindTutorial(); }, "tutorial back"],
    [tutorialNextButton, "click", () => { void advanceTutorial(); }, "tutorial next"],
    [tutorialSkipButton, "click", () => {
      tutorialDontShowAgain.checked = true;
      closeTutorial({ markSeen: false });
    }, "tutorial skip"],
    [tutorialCloseButton, "click", () => {
      closeTutorial({ markSeen: false });
    }, "tutorial close"],
  ].forEach(([target, eventName, handler, label]) => {
    bindListener(target, eventName, handler, { label });
  });

  chatbotDebugState.clickHandlerAttached = bindListener(openAssistantButton, "click", openAssistantPanel, {
    label: "open assistant panel",
  });
  logChatbotDebug("listener-bound");

  newWindowMenuButtons.forEach((button) => {
    bindListener(button, "click", () => openNewWindowTarget(button.dataset.newWindowTarget || "reports"), {
      label: `new window ${button.dataset.newWindowTarget || "unknown"}`,
    });
  });

  dashboardLinkButtons.forEach((button) => {
    bindListener(button, "click", () => navigateTo(button.dataset.dashboardTarget || "reports"), {
      label: `dashboard link ${button.dataset.dashboardTarget || "reports"}`,
    });
  });

  locationBrowserButtons.forEach((button) => {
    bindListener(button, "click", () => handleLocationBrowserClick(button), {
      label: `location filter ${button.dataset.locationFilter || "all"}`,
    });
  });

  bindListener(locationBrowserTree, "click", (event) => {
    const button = event.target?.closest?.("[data-location-filter]");
    if (!button || !locationBrowserTree.contains(button)) return;
    handleLocationBrowserClick(button);
  }, { label: "location browser tree" });

  bindListener(languageSelect, "change", async () => {
    setLanguage(languageSelect.value);
    if (state.user) {
      try {
        const data = await apiFetch("/account/preferences/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: state.language }),
        });
        state.user = applyFreshUser(data.user || state.user);
      } catch (error) {
        logClientError("saving language preference failed", error);
      }
      await Promise.all([
        loadMapSystem(),
        loadFilters(),
        loadItems(),
        loadRoomItems(),
        loadReturnedItems(),
        state.currentView === "claims" ? loadClaims() : Promise.resolve(),
        loadNotifications(),
        loadStatsSummary(),
        currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
      ]);
      if (currentUserCanAdmin()) {
        renderAdminMonitor();
        if (state.currentView === "admin") {
          await loadAdminMonitor();
        }
      }
      if (state.currentView === "query") {
        await loadQueryPage(state.currentQueryItem?.id || null);
      } else if (state.currentView === "account") {
        renderAccount();
      }
    }
  }, { label: "language select" });

  bindListener(claimDialog, "cancel", (event) => {
    event.preventDefault();
    closeClaimModal();
  }, { label: "claim dialog cancel" });
  bindListener(confirmDialog, "cancel", (event) => {
    event.preventDefault();
    closeConfirmModal();
  }, { label: "confirm dialog cancel" });
  bindListener(roomClaimPreviewDialog, "cancel", (event) => {
    event.preventDefault();
    closeRoomClaimPreview();
  }, { label: "room preview dialog cancel" });

  bindListener(notificationButton, "click", async () => {
    if (!notificationDropdown) {
      logMissingElement("notificationDropdown");
      return;
    }
    const willOpen = notificationDropdown.classList.contains("is-hidden");
    notificationDropdown.classList.toggle("is-hidden", !willOpen);
    notificationButton?.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      await loadNotifications();
    }
  }, { label: "notification toggle" });

  bindListener(adminMonitorTab, "click", async () => {
    switchAdminTab("monitor");
    if (currentUserCanAdmin() && state.currentView === "admin") {
      await loadAdminMonitor();
    }
  }, { label: "admin monitor tab" });
  bindListener(adminSmtpTestForm, "submit", sendAdminSmtpTestEmail, { label: "admin smtp test submit" });

  bindListener(queryInput, "keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      queryForm?.requestSubmit();
    }
  }, { label: "query submit shortcut" });
  bindListener(assistantInput, "keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      assistantForm?.requestSubmit();
    }
  }, { label: "assistant submit shortcut" });
  bindListener(assistantQueryInput, "keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      assistantQueryForm?.requestSubmit();
    }
  }, { label: "assistant structured query shortcut" });
  bindListener(queryInput, "focus", ensureQueryComposerVisible, { label: "query input focus" });
  bindListener(queryInput, "input", ensureQueryComposerVisible, { label: "query input resize guard" });

  bindListener(window, "pointermove", handleRoomPreviewPointerMove, { label: "window room preview pointer move" });
  bindListener(window, "pointerup", handleRoomPreviewPointerUp, { label: "window room preview pointer up" });
  bindListener(window, "pointercancel", handleRoomPreviewPointerUp, { label: "window room preview pointer cancel" });
  bindListener(confirmForm, "submit", async (event) => {
    event.preventDefault();
    if (!state.confirmState?.onConfirm) return;
    const notes = confirmNotesInput.value.trim();
    if (state.confirmState.requireNotes && !notes) {
      setMessage(confirmMessage, langText({ en: "Please add notes before confirming.", "zh-CN": "请先填写备注。", th: "กรุณาเพิ่มบันทึกก่อนยืนยัน" }), true);
      return;
    }
    triggerHaptic("light");
    await state.confirmState.onConfirm(notes);
  }, { label: "confirm form submit" });

  bindListener(imagePreviewDialog, "cancel", (event) => {
    event.preventDefault();
    closeImagePreview();
  }, { label: "image preview cancel" });

  bindListener(undoToastButton, "click", async () => {
    if (!state.undoState) return;
    try {
      await state.undoState();
    } catch (error) {
      logClientError("undo action failed", error);
    }
  }, { label: "undo toast action" });

  tutorialBackdropPanes.forEach((pane) => {
    bindListener(pane, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, { label: `tutorial backdrop ${pane.dataset.tutorialBackdrop || "pane"} click` });
    bindListener(pane, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, { label: `tutorial backdrop ${pane.dataset.tutorialBackdrop || "pane"} pointerdown` });
  });

  bindListener(window, "hashchange", () => {
    if (state.user) {
      void activateRoute(readRoute());
    }
  }, { label: "window hashchange" });
  bindListener(window, "resize", () => {
    scheduleLayoutSync();
    scheduleRoomPreviewLayerSync();
  }, { label: "window resize" });
  bindListener(window, "orientationchange", () => {
    window.setTimeout(scheduleLayoutSync, 80);
    window.setTimeout(scheduleRoomPreviewLayerSync, 80);
  }, { label: "window orientation change" });
  if (window.visualViewport) {
    bindListener(window.visualViewport, "resize", () => {
      scheduleLayoutSync();
      scheduleRoomPreviewLayerSync();
      ensureQueryComposerVisible();
    }, { label: "visual viewport resize" });
    bindListener(window.visualViewport, "scroll", scheduleTutorialSpotlightUpdate, {
      label: "visual viewport scroll",
      options: { passive: true },
    });
  }
  bindListener(window, "scroll", () => {
    scheduleTutorialSpotlightUpdate();
  }, { label: "window scroll", options: { passive: true, capture: true } });
  bindListener(document, "scroll", () => {
    scheduleTutorialSpotlightUpdate();
  }, { label: "document scroll", options: { passive: true, capture: true } });
  bindListener(document, "click", (event) => {
    if (newWindowMenu && !newWindowMenu.classList.contains("is-hidden")) {
      const clickedInsideMenu = newWindowMenu.contains(event.target) || newWindowButton?.contains(event.target);
      if (!clickedInsideMenu) {
        closeNewWindowMenu();
      }
    }
    if (!notificationDropdown || notificationDropdown.classList.contains("is-hidden")) return;
    if (notificationDropdown.contains(event.target) || notificationButton?.contains(event.target)) return;
    notificationDropdown.classList.add("is-hidden");
    notificationButton?.setAttribute("aria-expanded", "false");
  }, { label: "document notification dismiss" });
  bindListener(document, "keydown", (event) => {
    if (event.altKey && String(event.key || "").toLowerCase() === "f") {
      showFinderEasterEgg();
    }
    if (event.key === "Escape") {
      closeNewWindowMenu();
      if (state.locationDrawerOpen) {
        closeLocationDrawer();
      }
    }
  }, { label: "document escape dismiss" });

  ["dragenter", "dragover"].forEach((eventName) => {
    bindListener(dropZone, eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    }, { label: `report drop zone ${eventName}` });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    bindListener(dropZone, eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    }, { label: `report drop zone ${eventName}` });
  });

  bindListener(dropZone, "drop", (event) => {
    selectFile(event.dataTransfer?.files?.[0] || null);
  }, { label: "report drop zone file drop" });

  logUiInfo(`Listener summary: ${uiBindingStats.attached} attached, ${uiBindingStats.missing} missing`);
}

async function initUI() {
  if (uiInitialized) {
    logUiInfo("initUI skipped because the UI is already initialized");
    return;
  }
  uiInitialized = true;
  ensureLayoutStructure();
  ensureLoginBackground();
  initializeTheme();
  setLanguage(state.language);
  setAuthView("login");
  await loadLoginBubbleImages();
  resetAdminMonitor();
  switchAdminTab("users");
  renderDefaultLayout();
  syncModeUi();
  bindEvents();
  renderSelectedQueryFile();
  updateReportSubmitState();
  renderActivityTracker();
  if (dateInput) {
    dateInput.value = todayIso();
  }
  await restoreSession();
}

document.addEventListener("DOMContentLoaded", () => {
  void initUI();
}, { once: true });

if (document.readyState !== "loading") {
  void initUI();
}
