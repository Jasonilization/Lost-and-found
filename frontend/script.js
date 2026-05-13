const API_BASE = window.location.origin || "";
const SESSION_STORAGE_KEY = "lostfound_session";
const THEME_STORAGE_KEY = "theme";
const CURRENT_ITEM_STORAGE_KEY = "lostfound_current_item";
const LANGUAGE_STORAGE_KEY = "lostfound_language";
const SIDEBAR_MODE_STORAGE_KEY = "lostfound_sidebar_mode";
const SIDEBAR_WIDTH_STORAGE_KEY = "lostfound_sidebar_width";
const ADVANCED_MODE_STORAGE_KEY = "lostfound_advanced_mode";
const TUTORIAL_STORAGE_KEY = "lostfound_tutorial_seen";
const INITIALS_PATTERN = /^[a-z]+(?:\.[a-z]+)+$/;
const THEME_MODES = ["dark", "light"];
const SUPPORTED_LANGUAGES = ["en", "zh-CN", "th"];
const SIDEBAR_MODES = ["left", "top", "bottom", "minimal"];
const CHAT_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const CHAT_ALLOWED_FILE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".txt"];
const CHAT_ALLOWED_FILE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "text/plain",
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
const GLOBAL_BACKGROUND_URL = "/uploads/background.png";
const TUTORIAL_CARD_MARGIN = 16;
const TUTORIAL_VIEWPORT_PADDING = 12;
const UI_DEBUG_PREFIX = "[LostFound UI]";
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
const savedSidebarMode = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
const savedSidebarWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) || "");
const initialSidebarWidth = Number.isFinite(savedSidebarWidth)
  ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(savedSidebarWidth)))
  : SIDEBAR_DEFAULT_WIDTH;

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
    "auth.hero": "Sign in to report lost items, track claims, and move item questions into a dedicated chat page.",
    "auth.tabs": "Authentication tabs",
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.showPassword": "Show password",
    "auth.hidePassword": "Hide password",
    "auth.initials": "Initials",
    "auth.classOf": "Class of",
    "topbar.eyebrow": "Local campus desk",
    "topbar.hero": "Reports stay local, admin actions stay guarded, and item questions live in their own chat page.",
    "topbar.theme": "Theme",
    "topbar.language": "Language",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "theme.aurora": "Aurora",
    "theme.transparent": "Transparent",
    "nav.reports": "Reports",
    "nav.room": "Lost & Found Room",
    "nav.returned": "Recently Returned",
    "nav.query": "Query",
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
    "query.eyebrow": "Item chat",
    "query.title": "Query page",
    "query.back": "Back to reports",
    "query.selectItem": "Select item",
    "query.generalInquiry": "General inquiry",
    "query.generalNote": "Use general inquiry for questions without a selected item.",
    "query.messagingNote": "Messages stay in this conversation and never trigger automated replies.",
    "query.refreshItems": "Refresh item list",
    "query.selectAnItem": "Select an item",
    "query.selectOrGeneral": "Select a report or use general inquiry mode.",
    "query.noMessages": "No questions yet. Start with a message below.",
    "query.emptyGeneral": "No general questions yet. Ask about recent reports or a missing item to get started.",
    "query.emptyItem": "No questions for this item yet. Ask for location details, evidence, or claim guidance.",
    "query.askAboutItem": "Ask about this item",
    "query.send": "Send message",
    "tutorial.stepOf": "Step {current} of {total}",
    "tutorial.welcomeTitle": "Welcome to Lost and Found",
    "tutorial.welcomeBody": "This walkthrough points to the live interface so you can see where reports, claims, messaging, and admin tools live.",
    "tutorial.reportsTitle": "Use the + Button",
    "tutorial.reportsBody": "Tap the floating + button to open the only report form. Clear titles, locations, and identifying details make matching much easier.",
    "tutorial.browseTitle": "Browse Reports",
    "tutorial.browseBody": "Use the report board to scan recent items, filter by category or location, and open a report before taking action.",
    "tutorial.claimsTitle": "Claim an Item",
    "tutorial.claimsBody": "Claim buttons live on report cards. Share specific details like color, brand, and unique marks so admins can review accurately.",
    "tutorial.messagingTitle": "Send Messages",
    "tutorial.messagingBody": "Messages are simple conversation records only. Pick a report for item-aware context, or stay in general inquiry for broader questions.",
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
    "auth.hero": "登录后即可提交失物报告、追踪认领记录，并在独立聊天页中咨询物品问题。",
    "auth.tabs": "身份验证标签",
    "auth.login": "登录",
    "auth.register": "注册",
    "auth.username": "用户名",
    "auth.password": "密码",
    "auth.showPassword": "显示密码",
    "auth.hidePassword": "隐藏密码",
    "auth.initials": "姓名缩写",
    "auth.classOf": "毕业年份",
    "topbar.eyebrow": "校园服务台",
    "topbar.hero": "报告仅保存在本地，管理员操作受到保护，物品问题会进入独立聊天页。",
    "topbar.theme": "主题",
    "topbar.language": "语言",
    "theme.dark": "深色",
    "theme.light": "浅色",
    "theme.aurora": "极光",
    "theme.transparent": "透明",
    "nav.reports": "报告",
    "nav.room": "失物招领室",
    "nav.returned": "最近归还",
    "nav.query": "聊天",
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
    "query.eyebrow": "物品聊天",
    "query.title": "咨询页面",
    "query.back": "返回报告",
    "query.selectItem": "选择物品",
    "query.generalInquiry": "一般咨询",
    "query.generalNote": "未选择具体物品时可使用一般咨询。",
    "query.messagingNote": "消息只会保存在当前会话中，不会触发自动回复。",
    "query.refreshItems": "刷新物品列表",
    "query.selectAnItem": "选择一个物品",
    "query.selectOrGeneral": "选择一条报告，或使用一般咨询模式。",
    "query.noMessages": "还没有提问。可以在下方开始。",
    "query.emptyGeneral": "还没有一般咨询。你可以先问最近的报告或丢失物品线索。",
    "query.emptyItem": "这个物品还没有提问记录。你可以询问地点、证据或认领方式。",
    "query.askAboutItem": "询问这个物品",
    "query.send": "发送消息",
    "tutorial.stepOf": "第 {current} / {total} 步",
    "tutorial.welcomeTitle": "欢迎使用失物招领",
    "tutorial.welcomeBody": "这个引导会直接指向真实界面，帮助你快速找到报告、认领、消息和管理员工具的位置。",
    "tutorial.reportsTitle": "使用 + 按钮",
    "tutorial.reportsBody": "需要登记失物时，请点击右下角浮动的 + 按钮。报告表单只有这一个入口。标题、地点和识别细节越清晰，匹配就越容易。",
    "tutorial.browseTitle": "浏览报告",
    "tutorial.browseBody": "使用报告看板查看最新物品，并按分类或地点筛选，再决定是否继续操作。",
    "tutorial.claimsTitle": "认领物品",
    "tutorial.claimsBody": "认领按钮就在报告卡片上。尽量提供颜色、品牌和独特标记等具体信息，方便管理员核验。",
    "tutorial.messagingTitle": "发送消息",
    "tutorial.messagingBody": "这里现在是纯消息记录。你可以选择具体报告来保留物品上下文，或使用一般咨询。",
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

const translationEnhancements = {
  en: {
    "notifications.button": "Notifications",
    "notifications.title": "Notifications",
    "notifications.empty": "No notifications yet.",
    "notifications.markRead": "Mark as read",
    "admin.audit": "Audit log",
    "admin.auditTitle": "Sensitive activity",
    "claim.eyebrow": "Ownership check",
    "claim.title": "Claim item",
    "claim.close": "Close claim form",
    "claim.reason": "Why are you claiming this item?",
    "claim.description": "Description of item",
    "claim.location": "Where did you lose it?",
    "claim.identifying": "Additional identifying info",
    "claim.submit": "Claim Item",
    "confirm.eyebrow": "Confirm action",
    "confirm.title": "Please confirm",
    "confirm.close": "Close confirmation",
    "confirm.notes": "Notes",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.undo": "Undo",
    "common.close": "Close",
    "tutorial.searchTitle": "How Search Works",
    "tutorial.searchBody": "Use the search bar to find reports with typo-tolerant matching across titles, tags, categories, and locations.",
    "tutorial.claimFlowTitle": "How Claims Work",
    "tutorial.claimFlowBody": "Use the claim button on a report and add specific identifying details so admins can review ownership safely.",
    "tutorial.chatTitle": "How Chat Works",
    "tutorial.chatBody": "The chat page stores non-AI messages only. Pick a report for item context or use general inquiry for broader questions.",
  },
  "zh-CN": {
    "notifications.button": "通知",
    "notifications.title": "通知中心",
    "notifications.empty": "暂时没有通知。",
    "notifications.markRead": "标记为已读",
    "admin.audit": "审计日志",
    "admin.auditTitle": "敏感操作记录",
    "claim.eyebrow": "所有权核验",
    "claim.title": "认领物品",
    "claim.close": "关闭认领表单",
    "claim.reason": "你为什么认领这件物品？",
    "claim.description": "物品描述",
    "claim.location": "你在哪里丢失的？",
    "claim.identifying": "补充识别信息",
    "claim.submit": "提交认领",
    "confirm.eyebrow": "确认操作",
    "confirm.title": "请确认",
    "confirm.close": "关闭确认窗口",
    "confirm.notes": "备注",
    "common.cancel": "取消",
    "common.confirm": "确认",
    "common.undo": "撤销",
    "common.close": "关闭",
    "tutorial.searchTitle": "搜索方式",
    "tutorial.searchBody": "使用搜索栏时，系统会按标题、标签、分类和地点进行容错匹配，支持轻微拼写错误。",
    "tutorial.claimFlowTitle": "认领流程",
    "tutorial.claimFlowBody": "在报告卡片上点击认领，并填写具体识别信息，管理员才能更安全地核验所有权。",
    "tutorial.chatTitle": "消息说明",
    "tutorial.chatBody": "聊天页只保存非 AI 消息。你可以选择具体报告保留物品上下文，或使用一般咨询。",
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
    "auth.hero": "ลงชื่อเข้าใช้เพื่อส่งรายงานของหาย ติดตามคำขอรับคืน และส่งข้อความเกี่ยวกับสิ่งของในหน้าสนทนาเฉพาะ",
    "auth.tabs": "แท็บยืนยันตัวตน",
    "auth.login": "เข้าสู่ระบบ",
    "auth.register": "สมัครสมาชิก",
    "auth.username": "ชื่อผู้ใช้",
    "auth.password": "รหัสผ่าน",
    "auth.showPassword": "แสดงรหัสผ่าน",
    "auth.hidePassword": "ซ่อนรหัสผ่าน",
    "auth.initials": "ชื่อย่อ",
    "auth.classOf": "รุ่นจบ",
    "topbar.eyebrow": "จุดบริการภายในโรงเรียน",
    "topbar.hero": "รายงานจะอยู่ภายในระบบท้องถิ่น การดำเนินการของผู้ดูแลจะถูกควบคุม และคำถามเกี่ยวกับสิ่งของจะอยู่ในหน้าสนทนาเฉพาะ",
    "topbar.theme": "ธีม",
    "topbar.language": "ภาษา",
    "theme.dark": "เข้ม",
    "theme.light": "สว่าง",
    "theme.aurora": "ออโรรา",
    "theme.transparent": "โปร่งใส",
    "nav.reports": "รายงาน",
    "nav.room": "ห้องของหายและของพบ",
    "nav.returned": "เพิ่งถูกรับคืน",
    "nav.query": "สนทนา",
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
    "query.eyebrow": "สนทนาเรื่องสิ่งของ",
    "query.title": "หน้าสนทนา",
    "query.back": "กลับสู่รายงาน",
    "query.selectItem": "เลือกสิ่งของ",
    "query.generalInquiry": "สอบถามทั่วไป",
    "query.generalNote": "ใช้การสอบถามทั่วไปเมื่อยังไม่ได้เลือกสิ่งของ",
    "query.messagingNote": "ข้อความจะถูกเก็บไว้ในบทสนทนานี้เท่านั้น และจะไม่เรียกใช้การตอบกลับอัตโนมัติ",
    "query.refreshItems": "รีเฟรชรายการสิ่งของ",
    "query.selectAnItem": "เลือกสิ่งของ",
    "query.selectOrGeneral": "เลือกหนึ่งรายงาน หรือใช้โหมดสอบถามทั่วไป",
    "query.noMessages": "ยังไม่มีข้อความ เริ่มพิมพ์ได้ด้านล่าง",
    "query.emptyGeneral": "ยังไม่มีการสอบถามทั่วไป ลองถามเกี่ยวกับรายงานล่าสุดหรือสิ่งของที่หายไป",
    "query.emptyItem": "ยังไม่มีข้อความสำหรับสิ่งของนี้ ลองถามเรื่องสถานที่ หลักฐาน หรือวิธีการยื่นคำขอ",
    "query.askAboutItem": "สอบถามเกี่ยวกับสิ่งของนี้",
    "query.send": "ส่งข้อความ",
    "tutorial.stepOf": "ขั้นตอน {current} จาก {total}",
    "tutorial.welcomeTitle": "ยินดีต้อนรับสู่ระบบของหายและของพบ",
    "tutorial.welcomeBody": "คู่มือนี้จะชี้ไปยังหน้าจอจริง เพื่อให้เห็นว่ารายงาน คำขอ ข้อความ และเครื่องมือผู้ดูแลอยู่ตรงไหน",
    "tutorial.reportsTitle": "ใช้ปุ่ม +",
    "tutorial.reportsBody": "เมื่อต้องการส่งรายงานของหาย ให้กดปุ่ม + แบบลอยที่มุมขวาล่าง แบบฟอร์มรายงานมีทางเข้าเพียงจุดเดียวนี้เท่านั้น รายละเอียดยิ่งชัดก็ยิ่งจับคู่ได้ง่าย",
    "tutorial.searchTitle": "การค้นหา",
    "tutorial.searchBody": "แถบค้นหารองรับการค้นหาแบบยืดหยุ่น โดยให้ความสำคัญกับชื่อ แท็ก หมวดหมู่ และคำสำคัญของสถานที่",
    "tutorial.claimFlowTitle": "การยื่นคำขอ",
    "tutorial.claimFlowBody": "ปุ่มยื่นคำขออยู่บนการ์ดรายงาน โปรดให้รายละเอียดเฉพาะเพื่อให้ผู้ดูแลตรวจสอบได้อย่างปลอดภัย",
    "tutorial.chatTitle": "การใช้งานแชต",
    "tutorial.chatBody": "หน้าสนทนานี้เก็บเฉพาะข้อความที่ผู้ใช้ส่งจริง ไม่มีการตอบกลับด้วย AI เลือกรายงานเพื่อคงบริบทของสิ่งของได้",
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
    "claim.eyebrow": "ตรวจสอบความเป็นเจ้าของ",
    "claim.title": "ยื่นคำขอรับคืน",
    "claim.close": "ปิดแบบฟอร์มคำขอ",
    "claim.reason": "เหตุใดคุณจึงขอรับสิ่งของนี้คืน",
    "claim.description": "คำอธิบายสิ่งของ",
    "claim.location": "คุณทำหายที่ไหน",
    "claim.identifying": "ข้อมูลระบุตัวตนเพิ่มเติม",
    "claim.submit": "ยื่นคำขอ",
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
    "common.confirm": "ยืนยัน",
    "common.undo": "เลิกทำ",
    "common.close": "ปิด",
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
    "Long Court": "สนามลองคอร์ต",
    Library: "ห้องสมุด",
    "Morris Forum": "มอร์ริสฟอรัม",
    "Senior Building": "อาคารมัธยม",
    "Primary Building": "อาคารประถม",
    "Innovation Building": "อาคารนวัตกรรม",
    "Lost & Found Room": "ห้องของหายและของพบ",
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
    "Lost & Found Room",
  ],
};

const state = {
  authView: "login",
  user: null,
  token: localStorage.getItem(SESSION_STORAGE_KEY) || "",
  items: [],
  roomItems: [],
  returnedItems: [],
  notifications: [],
  notificationsLoadedOnce: false,
  unreadNotifications: 0,
  claims: [],
  adminUsers: [],
  adminItems: [],
  adminClaims: [],
  adminAudits: [],
  aiInspectionLogs: [],
  adminTab: "users",
  filters: fallbackFilters,
  selectedFile: null,
  selectedQueryFile: null,
  profilePreviewUrl: "",
  previewUrls: new Map(),
  searchCache: new Map(),
  queryCache: new Map(),
  avatarVersion: Date.now(),
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
  },
};

const authScreen = document.querySelector("#authScreen");
const appShell = document.querySelector("#appShell");
const authForm = document.querySelector("#authForm");
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
let workspaceLayout = document.querySelector("#workspace");
let windowWorkspace = document.querySelector("#windowWorkspace");
let sidebarLauncherButton = document.querySelector("#sidebarLauncherButton");
let sidebarPanel = document.querySelector("#sidebarPanel");
let sidebarSplitter = document.querySelector("#sidebarSplitter");
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
let reportsSection = document.querySelector("#reportsSection");
let reportsPanel = document.querySelector("#reportsPanel");
let roomSection = document.querySelector("#roomSection");
let returnedSection = document.querySelector("#returnedSection");
let claimsSection = document.querySelector("#claimsSection");
let notificationsSection = document.querySelector("#notificationsSection");
let accountSection = document.querySelector("#accountSection");
let adminSection = document.querySelector("#adminSection");
let querySection = document.querySelector("#querySection");

const openReportModalButton = document.querySelector("#openReportModalButton");
const reportDialog = document.querySelector("#reportDialog");
const closeReportDialog = document.querySelector("#closeReportDialog");
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
const optionalLocationInput = document.querySelector("#optionalLocationInput");
const dateInput = document.querySelector("#dateInput");
const descriptionInput = document.querySelector("#descriptionInput");
const evidenceDetailsInput = document.querySelector("#evidenceDetailsInput");
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
const queryFileInput = document.querySelector("#queryFileInput");
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
    reports: reportsPanel,
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
  reportsSection = document.querySelector("#reportsSection");
  reportsPanel = document.querySelector("#reportsPanel");
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

const secondaryPanelNames = ["room", "returned", "claims", "notifications", "account", "admin", "query"];
const simpleModeSections = new Set(["reports", "room", "claims", "notifications", "account"]);
const advancedModeSections = new Set(["returned", "query", "admin"]);
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

function sectionAvailableInCurrentMode(section) {
  if (section === "admin") {
    return state.advancedMode && currentUserCanAdmin();
  }
  if (simpleModeSections.has(section)) return true;
  if (advancedModeSections.has(section)) return state.advancedMode;
  return section === "reports";
}

function syncModeLabels() {
  const setShortLabel = (button, value) => {
    if (button) button.dataset.shortLabel = value;
  };
  if (state.advancedMode) {
    showReportsButton.textContent = t("nav.reports");
    showReportItemButton.textContent = langText({ en: "Report item", "zh-CN": "提交报告", th: "ส่งรายงาน" });
    showRoomButton.textContent = t("nav.room");
    showReportsButton.dataset.navIcon = "R";
    showRoomButton.dataset.navIcon = "L";
    showClaimsButton.textContent = t("nav.claims");
    showNotificationsButton.textContent = t("notifications.title");
    showAccountButton.textContent = t("nav.account");
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

  showReportsButton.textContent = langText({ en: "Claim item", "zh-CN": "认领物品", th: "รับของคืน" });
  showReportItemButton.textContent = langText({ en: "Report", "zh-CN": "报告", th: "รายงาน" });
  showRoomButton.textContent = langText({ en: "Lost & Found Room", "zh-CN": "失物招领室", th: "ห้องของหาย" });
  showReportsButton.dataset.navIcon = "C";
  showReportItemButton.dataset.navIcon = "+";
  showRoomButton.dataset.navIcon = "L";
  showClaimsButton.textContent = langText({ en: "Claims", "zh-CN": "认领", th: "คำขอ" });
  showNotificationsButton.textContent = t("notifications.title");
  showAccountButton.textContent = langText({ en: "Profile", "zh-CN": "个人资料", th: "โปรไฟล์" });
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
  appShell?.classList.toggle("is-advanced-mode", state.advancedMode);
  appShell?.classList.toggle("is-simple-mode", !state.advancedMode);
  document.body.dataset.experienceMode = state.advancedMode ? "advanced" : "simple";

  if (advancedModeToggle) {
    advancedModeToggle.checked = state.advancedMode;
    advancedModeToggle.setAttribute("aria-checked", String(state.advancedMode));
  }

  const showAdvancedNav = state.advancedMode;
  showReportItemButton?.classList.toggle("is-hidden", showAdvancedNav);
  showRoomButton?.classList.remove("is-hidden");
  showReturnedButton?.classList.toggle("is-hidden", !showAdvancedNav);
  showQueryButton?.classList.toggle("is-hidden", !showAdvancedNav);
  showAdminButton?.classList.toggle("is-hidden", !(showAdvancedNav && currentUserCanAdmin()));
  logoutButton?.classList.toggle("is-hidden", !showAdvancedNav);
  roomAdminPanel?.classList.toggle("is-hidden", !(showAdvancedNav && currentUserCanAdmin()));

  syncModeLabels();
  syncNewWindowMenu();

  if (!state.advancedMode) {
    state.multitaskRequested = false;
    state.multitaskActive = false;
  }

  if (navigateIfNeeded && state.user && !sectionAvailableInCurrentMode(state.currentView)) {
    navigateTo("reports");
  }
}

function setAdvancedMode(enabled, { persist = true, navigateIfNeeded = true } = {}) {
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
    closed: !["sidebar", "reports"].includes(name),
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

  sidebarState.closed = false;
  sidebarState.collapsed = false;
  state.layoutSizes.sidebarWidth = STABLE_SIDEBAR_WIDTH;

  if (phoneLayout) {
    sidebarState.closed = false;
    sidebarState.collapsed = false;
    reportsState.minimized = false;
    if (secondaryState) {
      secondaryState.minimized = false;
    }
  }

  const sidebarVisible = phoneLayout ? true : !sidebarState.closed;
  const reportsVisible = phoneLayout ? state.currentView === "reports" : !reportsState.closed;
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
  appShell?.classList.toggle("is-phone-layout", phoneLayout);
  appShell?.classList.toggle("is-tablet-layout", tabletLayout);
  appShell?.classList.toggle("is-desktop-layout", responsiveMode === "desktop");
  if (appShell) {
    appShell.dataset.layoutMode = responsiveMode;
  }
  workspaceLayout.classList.toggle("is-phone-layout", phoneLayout);
  workspaceLayout.classList.toggle("is-tablet-layout", tabletLayout);
  workspaceLayout.classList.toggle("is-desktop-layout", responsiveMode === "desktop");
  workspaceLayout.dataset.layoutMode = responsiveMode;
  document.body.dataset.layoutMode = responsiveMode;
  syncResponsiveNavigationSlots(responsiveMode);
  applySidebarMode();
  sidebarPanel?.classList.toggle("is-top-mode", sidebarMode === "top");
  sidebarPanel?.classList.toggle("is-bottom-mode", sidebarMode === "bottom");
  sidebarPanel?.classList.toggle("is-minimal-mode", sidebarMode === "minimal");
  sidebarState.collapsed = sidebarMode === "minimal" ? true : Boolean(sidebarState.collapsed && sidebarMode === "left");
  sidebarState.collapsed = false;
  applyPanelLayout("sidebar");
  sidebarPanel?.classList.toggle("is-hidden", false);
  sidebarLauncherButton?.classList.toggle("is-hidden", true);
  const canResizeSidebar = false;
  sidebarSplitter?.classList.toggle("is-hidden", !canResizeSidebar);
  contentSplitter?.classList.toggle("is-hidden", !(canResizeContent && state.advancedMode && state.multitaskActive));
  contentSplitter?.classList.toggle("is-vertical", splitContentSideBySide);
  contentSplitter?.classList.toggle("is-horizontal", !splitContentSideBySide);
  contentSplitter?.setAttribute("aria-orientation", splitContentSideBySide ? "vertical" : "horizontal");
  reportsSection?.classList.toggle("is-hidden", !reportsVisible);
  secondaryStack?.classList.toggle("is-hidden", !secondaryVisible);
  windowWorkspace.classList.toggle("has-secondary", secondaryVisible);
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
    const sidebarWidth = STABLE_SIDEBAR_WIDTH;
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
  const panelName = state.currentView === "reports" ? "reports" : currentSecondaryPanelName();
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
  if (section === "reports") {
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
    setSidebarMode("left");
    return;
  }
  if (name === "reports" && state.currentView === "reports") {
    return;
  }
  if (secondaryPanelNames.includes(name) && state.currentView === name) {
    navigateTo("reports");
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
  setSidebarMode("left");
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
  const host = window.location.hostname;
  const isDevelopment = !host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  if (!isDevelopment) return;
  console.info(`[LostFound] ${context}`, details);
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
  renderNotifications(state.notifications);
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

function ensureGlobalBackground() {
  const probe = new Image();
  probe.onload = () => {
    document.body.classList.remove("background-missing");
  };
  probe.onerror = () => {
    document.body.classList.add("background-missing");
  };
  probe.src = GLOBAL_BACKGROUND_URL;
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
  state.language = SUPPORTED_LANGUAGES.includes(language) ? language : "en";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  state.queryCache.clear();
  languageSelect.value = state.language;
  applyTranslations();
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
    return;
  }
  state.queryCache.delete(itemId == null ? "general" : `item:${itemId}`);
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

function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

function validateChatFile(file) {
  if (!file) return "";
  const extension = fileExtension(file.name);
  if (!CHAT_ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return langText({
      en: "Chat attachments must be PNG, JPG, JPEG, PDF, or TXT.",
      "zh-CN": "聊天附件仅支持 PNG、JPG、JPEG、PDF 或 TXT。",
      th: "ไฟล์แนบในแชตรองรับเฉพาะ PNG, JPG, JPEG, PDF หรือ TXT",
    });
  }
  if (file.size > CHAT_UPLOAD_LIMIT_BYTES) {
    return langText({
      en: "Chat attachments must be 5 MB or smaller.",
      "zh-CN": "聊天附件必须小于或等于 5 MB。",
      th: "ไฟล์แนบในแชตต้องมีขนาดไม่เกิน 5 MB",
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
  const handle = progressHandles[kind];
  if (!handle) return;

  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
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
    xhr.open(requestMethod, ensureApiBase(path));
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
      let payload = xhr.responseText;
      if (contentType.includes("application/json")) {
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch {
          payload = {};
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(extractApiMessage(payload, "Request failed.")));
    };

    xhr.onerror = () => reject(new Error(`Could not reach backend at ${API_BASE}. Make sure start.sh is running.`));
    xhr.ontimeout = () => reject(new Error("Request timed out."));
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
  closeTutorial({ markSeen: false, rememberSession: false });
  authScreen?.classList.remove("is-hidden");
  appShell?.classList.add("is-hidden");
}

function showAppShell() {
  authScreen?.classList.add("is-hidden");
  appShell?.classList.remove("is-hidden");
  syncModeUi();
  window.requestAnimationFrame(() => {
    syncAllPanels(Object.keys(state.panelState).length === 0);
    openPanel("sidebar");
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
  form?.reset();
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
  updateReportSubmitState();
  hideProgress("report");
  setMessage(uploadMessage, "");
  setWarningCard(reportWarningCard, "");
}

function openReportModal() {
  if (!reportDialog) return;
  reportDialog.classList.remove("is-closing");
  delete reportDialog.dataset.closeToken;
  reportDialog.showModal();
  triggerHaptic("open");
  setWarningCard(reportWarningCard, "");
  window.setTimeout(() => {
    titleInput?.focus();
  }, 0);
}

function closeReportModal() {
  if (!reportDialog) return;
  if (reportDialog.open) {
    closeDialogWithAnimation(reportDialog);
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
  authSubmitLabel.textContent = t(view === "login" ? "auth.login" : "auth.register");
  loginTab.classList.toggle("is-active", view === "login");
  registerTab.classList.toggle("is-active", view === "register");
  registerFields.classList.toggle("is-hidden", view !== "register");
  authPassword.setAttribute("autocomplete", view === "login" ? "current-password" : "new-password");
  if (authConfirmPassword) {
    authConfirmPassword.required = view === "register";
    authConfirmPassword.disabled = view !== "register";
    authConfirmPassword.value = "";
  }
  setAuthPasswordVisibility(false);
  setAuthConfirmPasswordVisibility(false);
}

function currentUserCanAdmin() {
  return Boolean(state.user?.is_admin);
}

function tutorialSteps() {
  const steps = [
    {
      section: "reports",
      selector: ".topbar",
      title: t("tutorial.welcomeTitle"),
      body: t("tutorial.welcomeBody"),
    },
    {
      section: "reports",
      selector: "#openReportModalButton",
      title: t("tutorial.reportsTitle"),
      body: t("tutorial.reportsBody"),
      requiresInteraction: true,
    },
    {
      section: "reports",
      selector: "#searchInput",
      title: t("tutorial.searchTitle"),
      body: t("tutorial.searchBody"),
      requiresInteraction: true,
      onEnter: () => {
        closeReportModal();
      },
    },
    {
      section: "reports",
      selector: () => document.querySelector("[data-claim-button]") ? "[data-claim-button]" : "#reportsSection .browse-panel",
      title: t("tutorial.claimFlowTitle"),
      body: t("tutorial.claimFlowBody"),
      requiresInteraction: true,
    },
  ];

  if (state.advancedMode) {
    steps.push({
      section: "query",
      selector: "#queryForm",
      title: t("tutorial.chatTitle"),
      body: t("tutorial.chatBody"),
      requiresInteraction: true,
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
  accountName.textContent = userDisplayName(state.user);
  accountMeta.textContent = currentUserCanAdmin()
    ? langText({ en: "Admin access", "zh-CN": "管理员权限", th: "สิทธิ์ผู้ดูแล" })
    : `@${state.user.username}`;
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

function currentLocation() {
  const value = String(optionalLocationInput?.value || "").trim();
  return {
    valid: true,
    value: value || "Unknown",
    meta: value ? "optional-text" : "unknown",
  };
}

function updateLocationUi() {
  return currentLocation();
}

function prefillReporter() {
  if (!state.user) return;
  reporterInput.value = state.user.identity || state.user.username || "";
}

function validateRegisterFields() {
  if (state.authView !== "register") return null;

  const initials = authInitials.value.trim();
  const classOf = Number(authClassOf.value);
  if (authConfirmPassword && authPassword.value !== authConfirmPassword.value) {
    return langText({
      en: "Passwords do not match.",
      "zh-CN": "两次输入的密码不一致。",
      th: "รหัสผ่านไม่ตรงกัน",
    });
  }

  if (!INITIALS_PATTERN.test(initials)) {
    return langText({
      en: "Initials must be lowercase and formatted like name.initial.",
      "zh-CN": "姓名缩写必须为小写，并采用 name.initial 的格式。",
      th: "ชื่อย่อต้องเป็นตัวพิมพ์เล็กและอยู่ในรูปแบบ name.initial",
    });
  }
  if (!Number.isInteger(classOf) || classOf < 2025 || classOf > 2035) {
    return langText({
      en: "Class of must be a year between 2025 and 2035.",
      "zh-CN": "毕业年份必须在 2025 到 2035 之间。",
      th: "รุ่นจบต้องอยู่ระหว่างปี 2025 ถึง 2035",
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
  element.textContent = fallbackText;
  element.style.backgroundImage = "";
  element.style.color = "";
  element.classList.remove("has-avatar-image", "is-avatar-broken");
  const source = normalizeAvatarUrl(imageUrl);
  element.dataset.avatarSource = source;
  if (!source) return;

  const probe = new Image();
  probe.onload = () => {
    if (element.dataset.avatarSource !== source) return;
    element.style.backgroundImage = `url("${source}")`;
    element.style.color = "transparent";
    element.classList.add("has-avatar-image");
    element.classList.remove("is-avatar-broken");
  };
  probe.onerror = () => {
    if (element.dataset.avatarSource !== source) return;
    element.style.backgroundImage = "";
    element.style.color = "";
    element.classList.remove("has-avatar-image");
    element.classList.add("is-avatar-broken");
    element.textContent = fallbackText;
    logClientDebug("avatar image failed to load", {
      elementId: element.id || "",
      source,
      fallbackText,
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
  if (section === "query") {
    return itemId ? `#query-${itemId}` : "#query";
  }
  return `#${section}`;
}

function readRoute() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) {
    return {
      section: "reports",
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
  if (["reports", "room", "returned", "claims", "notifications", "account", "admin"].includes(raw)) {
    return { section: raw, itemId: state.currentItemId };
  }
  return { section: "reports", itemId: state.currentItemId };
}

function navigateTo(section, itemId = null, options = {}) {
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
    navigateTo("reports");
    return;
  }
  navigateTo(section, null, { multitask: state.advancedMode });
}

function updateTopbarState() {
  const toggle = (button, active) => button.classList.toggle("is-active", active);
  toggle(showReportsButton, state.currentView === "reports");
  toggle(showReportItemButton, false);
  toggle(showRoomButton, state.currentView === "room");
  toggle(showReturnedButton, state.currentView === "returned");
  toggle(showQueryButton, state.currentView === "query");
  toggle(showClaimsButton, state.currentView === "claims");
  toggle(showNotificationsButton, state.currentView === "notifications");
  toggle(showAccountButton, state.currentView === "account");
  toggle(showAdminButton, state.currentView === "admin");
  syncModeUi();
  syncNewWindowMenu();
}

function switchSection(section) {
  state.currentView = section;
  if (section === "reports") {
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

  const section = route.section || "reports";
  if (!sectionAvailableInCurrentMode(section)) {
    navigateTo("reports");
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

  if (section === "returned") {
    switchSection("returned");
    await loadReturnedItems();
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
    await loadAdminSurface();
    startAdminMonitorPolling();
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
    const method = String(options.method || "GET").toUpperCase();
    response = await fetch(ensureApiBase(path), {
      ...options,
      method,
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
  let retryAfter = null;
  try {
    const data = await response.json();
    message = extractApiMessage(data, message);
    retryAfter = Number(data?.retry_after || 0) || null;
  } catch {
    try {
      message = await response.text();
    } catch {
      message = "Request failed";
    }
  }

  if (response.status === 429 && retryAfter) {
    message = langText({
      en: `${message} Please wait about ${retryAfter} second(s).`,
      "zh-CN": `${message} 请大约等待 ${retryAfter} 秒后再试。`,
      th: `${message} โปรดรอประมาณ ${retryAfter} วินาทีก่อนลองใหม่`,
    });
  }
  logClientError("api request failed", new Error(message), { path, status: response.status });
  throw new Error(message);
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
  fillSelect(locationFilter, state.filters.locations, true);
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
      key: "chat-reply",
      label: langText({ en: "New chat reply", "zh-CN": "新聊天回复", th: "ข้อความใหม่" }),
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
    renderNotifications(state.notifications);
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
    renderReturnedItems(state.returnedItems);
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
  if (locationFilter.value) params.set("location", locationFilter.value);

  try {
    const suffix = params.toString();
    const cacheKey = suffix || "__all__";
    const cached = state.searchCache.get(cacheKey);
    const data = cached || await apiFetch(`/items${suffix ? `?${suffix}` : ""}`);
    state.searchCache.set(cacheKey, data);
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
  resultCount.textContent = langText({
    en: `${items.length} report${items.length === 1 ? "" : "s"}`,
    "zh-CN": `${items.length} 条报告`,
    th: `${items.length} รายงาน`,
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    const hasFilters = Boolean(searchInput.value.trim() || categoryFilter.value || statusFilter.value || locationFilter.value);
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
    const claimButton = card.querySelector("[data-claim-button]");
    const openQueryButton = card.querySelector("[data-open-query-button]");
    const markClaimedButton = card.querySelector("[data-mark-claimed-button]");

    title.textContent = item.title || langText({ en: "Untitled item", "zh-CN": "未命名物品", th: "สิ่งของไม่มีชื่อ" });
    const reporterLine = document.createElement("span");
    reporterLine.className = "person-line";
    reporterLine.append(
      createMiniAvatar(item.reporter_identity || item.reporter_name || "Reporter", item.reporter_avatar_url || ""),
      document.createTextNode(item.ai_summary || langText({
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

    const preview = state.previewUrls.get(item.id) || resolveImageUrl(item);
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

    renderTags(tags, item.tags || []);
    addInfo(info, langText({ en: "Status", "zh-CN": "状态", th: "สถานะ" }), statusLabel);
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
    claimButton.textContent = item.claimed
      ? langText({ en: "Already claimed", "zh-CN": "已被认领", th: "มีผู้รับคืนแล้ว" })
      : langText({ en: "Claim Item", "zh-CN": "认领物品", th: "ยื่นคำขอรับคืน" });
    claimButton.addEventListener("click", () => openClaimDialog(item));

    openQueryButton.addEventListener("click", () => navigateTo("query", item.id));

    if (currentUserCanAdmin()) {
      markClaimedButton.classList.remove("is-hidden");
      markClaimedButton.disabled = item.claimed;
      markClaimedButton.textContent = langText({ en: "Mark as Claimed", "zh-CN": "标记为已认领", th: "ทำเครื่องหมายว่ารับคืนแล้ว" });
      markClaimedButton.addEventListener("click", () => markItemClaimed(item.id, markClaimedButton));
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
      card.querySelector(".claim-history-card")?.prepend(thumbnail);
    }

    title.textContent = claim.item?.title || langText({ en: "Unavailable item", "zh-CN": "不可用物品", th: "สิ่งของไม่พร้อมใช้งาน" });
    meta.textContent = langText({
      en: `${claim.user_identity || "User"} • Submitted ${formatDateTime(claim.timestamp)}`,
      "zh-CN": `${claim.user_identity || "用户"} • 提交于 ${formatDateTime(claim.timestamp)}`,
      th: `${claim.user_identity || "ผู้ใช้"} • ส่งเมื่อ ${formatDateTime(claim.timestamp)}`,
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
  addInfo(accountInfoList, langText({ en: "Initials", "zh-CN": "姓名缩写", th: "ชื่อย่อ" }), state.user.initials || "-");
  addInfo(accountInfoList, langText({ en: "Class of", "zh-CN": "毕业年份", th: "รุ่นจบ" }), state.user.class_of || "-");
  addInfo(accountInfoList, langText({ en: "Created", "zh-CN": "创建时间", th: "สร้างเมื่อ" }), formatDateTime(state.user.created_at));
  addInfo(accountInfoList, langText({ en: "Admin", "zh-CN": "管理员", th: "ผู้ดูแล" }), currentUserCanAdmin() ? t("common.yes") : t("common.no"));
  syncModeUi();
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
}

function resetAdminMonitor() {
  state.adminMonitor = emptyAdminMonitor();
  renderAdminMonitor();
}

async function loadAdminMonitor() {
  if (!currentUserCanAdmin() || state.adminMonitorRequestInFlight) {
    return;
  }

  state.adminMonitorRequestInFlight = true;
  try {
    const data = await apiFetch("/health/detailed");
    state.adminMonitor = {
      ...emptyAdminMonitor(),
      ...data,
      fetched_at: new Date().toISOString(),
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
    roleCell.textContent = user.is_admin
      ? langText({ en: "Admin", "zh-CN": "管理员", th: "ผู้ดูแล" })
      : langText({ en: "User", "zh-CN": "用户", th: "ผู้ใช้" });

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
    clearChatButton.textContent = langText({ en: "Clear chat", "zh-CN": "清空聊天", th: "ล้างแชต" });
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
    metaStack.append(head, description, info, actions);

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
  await Promise.all([loadAdminData(), loadAdminMonitor()]);
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
  queryFileRemoveButton.disabled = !enabled;
  queryInput.placeholder = placeholder;
}

function renderQueryItemSelector(selectedItemId = null) {
  const previousValue = selectedItemId ? String(selectedItemId) : "";
  queryItemSelect.replaceChildren(new Option(t("query.generalInquiry"), ""));
  state.queryItems.forEach((item) => {
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
  state.queryRequestToken = null;
  setCurrentQueryItem(null);
  state.queryMessages = [];
  state.querySuggestions = [];
  queryInput.value = "";
  queryMessages.replaceChildren();
  queryItemTags.replaceChildren();
  querySuggestions.replaceChildren();
  querySuggestions.classList.add("is-hidden");
  clearSelectedQueryFile();
  setWarningCard(queryWarningCard, "");
  setMessage(queryMessage, "");
  setLoadingLine(queryLoading, false);
  hideProgress("query");
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
  state.selectedQueryFile = file || null;
  renderSelectedQueryFile();
  setMessage(queryMessage, "");
  setWarningCard(queryWarningCard, "");
}

function renderQuerySelectionState() {
  clearQueryState();
  queryItemSelect.value = "";
  queryItemTitle.textContent = t("query.generalInquiry");
  queryItemMeta.textContent = langText({
    en: "Ask about a lost item that hasn't been reported yet.",
    "zh-CN": "你可以咨询尚未上报的失物。",
    th: "คุณสามารถสอบถามเกี่ยวกับสิ่งของที่ยังไม่ได้ถูกรายงาน",
  });
  queryItemDescription.textContent = langText({
    en: "You can ask general questions without selecting an item, or choose a specific report for item-aware chat.",
    "zh-CN": "你可以在不选择物品的情况下提一般问题，或选择某条报告进行物品相关聊天。",
    th: "คุณสามารถถามคำถามทั่วไปโดยไม่ต้องเลือกสิ่งของ หรือเลือกหนึ่งรายงานเพื่อสนทนาแบบมีบริบทของสิ่งของ",
  });
  queryItemStatus.textContent = langText({ en: "General", "zh-CN": "一般", th: "ทั่วไป" });
  queryItemStatus.className = "status-badge is-lost";
  renderQueryContextImage(null);
  syncQueryAdminActions();
  queryItemContextLabel.textContent = langText({ en: "General conversation", "zh-CN": "一般对话", th: "บทสนทนาทั่วไป" });
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
  queryItemContextLabel.textContent = langText({ en: "Conversation", "zh-CN": "对话", th: "บทสนทนา" });
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
  const nextSuggestions = Array.isArray(suggestions) && suggestions.length
    ? suggestions.slice(0, QUERY_SUGGESTION_LIMIT)
    : buildHeuristicSuggestions(item, messages);
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
      triggerHaptic("selection");
      ensureQueryComposerVisible();
    });
    querySuggestions.append(button);
  });

  querySuggestions.classList.remove("is-hidden");
}

function deleteQueryMessage(messageId) {
  openConfirmModal({
    title: langText({ en: "Delete message", "zh-CN": "删除消息", th: "ลบข้อความ" }),
    body: langText({
      en: `Delete message #${messageId}?`,
      "zh-CN": `删除消息 #${messageId}？`,
      th: `ลบข้อความ #${messageId} ใช่หรือไม่`,
    }),
    confirmLabel: t("common.confirm"),
    onConfirm: async () => {
      try {
        const data = await apiFetch(`/admin/query-messages/${messageId}`, { method: "DELETE" });
        closeConfirmModal();
        setMessage(queryMessage, data.message || "Message deleted.");
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
    title: langText({ en: "Clear item chat", "zh-CN": "清空物品聊天", th: "ล้างแชตรายการ" }),
    body: langText({
      en: `Clear all query messages for "${item.title || `item #${item.id}`}"?`,
      "zh-CN": `清空“${item.title || `物品 #${item.id}`}”的全部咨询消息？`,
      th: `ล้างข้อความทั้งหมดสำหรับ "${item.title || `รายการ #${item.id}`}" ใช่หรือไม่`,
    }),
    confirmLabel: t("common.confirm"),
    onConfirm: async () => {
      try {
        const data = await apiFetch(`/admin/items/${item.id}/query-thread`, { method: "DELETE" });
        closeConfirmModal();
        setMessage(queryMessage, data.message || "Item chat cleared.");
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
    en: `Conversation for ${item.title}`,
    "zh-CN": `${item.title} 的对话`,
    th: `บทสนทนาสำหรับ ${item.title}`,
  });
  updateQueryEmptyState();
  renderTags(queryItemTags, item.tags || []);
  setQueryComposerEnabled(true, t("query.askAboutItem"));
}

function renderQueryMessages(messages) {
  updateQueryEmptyState();
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

    if (entry.attachment?.url) {
      const attachment = document.createElement("a");
      attachment.className = "query-attachment";
      attachment.href = entry.attachment.url.startsWith("/")
        ? `${API_BASE}${entry.attachment.url}`
        : entry.attachment.url;
      attachment.target = "_blank";
      attachment.rel = "noopener noreferrer";
      attachment.textContent = `${entry.attachment.name || "Attachment"} • ${formatFileSize(entry.attachment.size || 0)}`;
      bubble.append(attachment);
      const preview = createAttachmentPreview(entry.attachment);
      if (preview) {
        preview.classList.add("query-attachment-preview");
        bubble.append(preview);
      }
    }

    appendQueryAdminControls(bubble, entry);
    queryMessages.append(bubble);
  });

  scrollQueryMessagesToBottom();
}

function handleQueryItemSelection() {
  const nextItemId = Number(queryItemSelect.value) || null;
  const nextItem = nextItemId ? findItemById(nextItemId) : null;
  state.currentQueryItem = nextItem;
  persistCurrentItemId(nextItemId);
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
    renderQueryMessages(messages);
    renderQuerySuggestions(queryData?.suggestions || [], item, messages);
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
  if (querySubmitButton.disabled) return;
  const itemId = state.currentQueryItem?.id || null;

  const value = queryInput.value.trim();
  const fileValidationMessage = validateChatFile(state.selectedQueryFile);
  if (fileValidationMessage) {
    setMessage(queryMessage, fileValidationMessage, true);
    setWarningCard(queryWarningCard, fileValidationMessage);
    return;
  }
  if (!value) {
    const shortMessage = langText({
      en: "Type a message first.",
      "zh-CN": "请先输入消息。",
      th: "กรุณาพิมพ์ข้อความก่อน",
    });
    setMessage(queryMessage, shortMessage, true);
    setWarningCard(queryWarningCard, shortMessage);
    return;
  }

  setButtonLoading(querySubmitButton, true);
  setProgress("query", 0, progressCopy("queryPrepare"), true);
  setMessage(queryMessage, langText({ en: "Sending your message...", "zh-CN": "正在发送消息...", th: "กำลังส่งข้อความ..." }));
  setWarningCard(queryWarningCard, "");
  try {
    const path = itemId ? `/items/${itemId}/query` : "/query";
    const uploadFile = await prepareUploadFile(state.selectedQueryFile, "query", {
      compress: progressCopy("queryCompress"),
      prepare: progressCopy("queryPrepare"),
    });
    let data;
    if (uploadFile) {
      const formData = new FormData();
      formData.set("message", value);
      formData.set("language", currentLanguage());
      formData.set("file", uploadFile);
      data = await apiRequestWithProgress(path, {
        method: "POST",
        body: formData,
        onUploadProgress: (progressEvent) => updateUploadProgress("query", progressEvent, progressCopy("queryUpload")),
        onUploadComplete: () => startProcessingProgress("query", progressCopy("queryProcess")),
      });
    } else {
      const requestBody = JSON.stringify({ message: value, language: currentLanguage() });
      setProgress("query", 20, progressCopy("queryUpload"), true);
      data = await apiRequestWithProgress(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        onUploadProgress: (progressEvent) => updateUploadProgress("query", progressEvent, progressCopy("queryUpload")),
        onUploadComplete: () => startProcessingProgress("query", progressCopy("queryProcess")),
      });
    }
    queryInput.value = "";
    clearSelectedQueryFile();
    state.queryMessages = Array.isArray(data.queries) ? data.queries : [];
    state.queryCache.set(itemId ? `item:${itemId}` : "general", {
      itemData: { item: state.currentQueryItem || null },
      queryData: { queries: state.queryMessages, suggestions: data.suggestions || [] },
    });
    renderQueryMessages(state.queryMessages);
    renderQuerySuggestions(data.suggestions || [], state.currentQueryItem, state.queryMessages);
    await completeProgress("query");
    setMessage(queryMessage, langText({ en: "Message sent successfully.", "zh-CN": "消息已发送成功。", th: "ส่งข้อความเรียบร้อยแล้ว" }));
    triggerHaptic("success");
    ensureQueryComposerVisible();
    await loadItems();
  } catch (error) {
    resetProgress("query");
    setMessage(queryMessage, langText({
      en: `Could not send your message: ${error.message}`,
      "zh-CN": `消息发送失败：${error.message}`,
      th: `ไม่สามารถส่งข้อความได้: ${error.message}`,
    }), true);
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
  setMessage(authMessage, langText({
    en: `${titleCase(state.authView)} in progress...`,
    "zh-CN": `${state.authView === "login" ? "正在登录" : "正在注册"}...`,
    th: `${state.authView === "login" ? "กำลังเข้าสู่ระบบ" : "กำลังสมัครสมาชิก"}...`,
  }));

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
    state.user = applyFreshUser(data.user);
    setLanguage(state.user?.preferred_language || state.language);
    authForm.reset();
    setMessage(authMessage, state.authView === "login"
      ? langText({ en: "Logged in.", "zh-CN": "已登录。", th: "เข้าสู่ระบบแล้ว" })
      : langText({ en: "Account created.", "zh-CN": "账号已创建。", th: "สร้างบัญชีแล้ว" }));
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
    state.user = applyFreshUser(data.user);
    setLanguage(state.user?.preferred_language || state.language);
    await enterAuthenticatedApp();
  } catch (error) {
    clearSession();
    showAuthScreen();
    logClientError("restoring session failed", error);
  }
}

async function enterAuthenticatedApp() {
  showAppShell();
  renderCurrentAccountChip();
  syncModeUi();
  prefillReporter();
  dateInput.value = todayIso();
  updateLocationUi();
  renderAccount();
  await Promise.all([
    loadFilters(),
    loadItems(),
    loadRoomItems(),
    loadReturnedItems(),
    loadClaims(),
    loadNotifications(),
    loadStatsSummary(),
    currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
  ]);
  startNotificationPolling();
  await activateRoute(readRoute());
  await maybeStartTutorial();
}

async function submitReport(event) {
  event.preventDefault();
  if (submitButton.disabled) return;
  setWarningCard(reportWarningCard, "");
  const validationMessage = validateReportForm();
  if (validationMessage) {
    setMessage(uploadMessage, validationMessage, true);
    setWarningCard(reportWarningCard, validationMessage);
    return;
  }

  const location = currentLocation();

  setButtonLoading(submitButton, true);
  setProgress("report", 0, progressCopy("reportPrepare"), true);
    setMessage(uploadMessage, langText({ en: "Publishing your report...", "zh-CN": "正在发布你的报告...", th: "กำลังเผยแพร่รายงานของคุณ..." }));
  try {
    const uploadFile = await prepareUploadFile(state.selectedFile, "report", {
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
    form.reset();
    state.selectedFile = null;
    dropTitle.textContent = t("report.dropTitle");
    dropHint.textContent = t("report.dropHint");
    dateInput.value = todayIso();
    prefillReporter();
    updateLocationUi();
    updateReportSubmitState();
    await completeProgress("report");
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
    setMessage(uploadMessage, langText({
      en: `Could not submit your report: ${error.message}`,
      "zh-CN": `报告提交失败：${error.message}`,
      th: `ไม่สามารถส่งรายงานได้: ${error.message}`,
    }), true);
    setWarningCard(reportWarningCard, error.message);
    logClientError("submitting report failed", error);
  } finally {
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
    setMessage(profileImageMessage, data.message || langText({ en: "Profile image updated.", "zh-CN": "头像已更新。", th: "อัปเดตรูปโปรไฟล์แล้ว" }));
    triggerHaptic("success");
    invalidateSearchCache();
    state.queryCache.clear();
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
    setMessage(profileImageMessage, error.message, true);
    logClientError("uploading profile image failed", error);
  } finally {
    setButtonLoading(profileImageButton, false);
  }
}

async function uploadRoomItems() {
  const files = Array.from(roomUploadInput.files || []);
  if (!files.length) {
    setMessage(roomUploadMessage, langText({
      en: "Choose at least one image for the room.",
      "zh-CN": "请至少选择一张招领室图片。",
      th: "กรุณาเลือกรูปภาพอย่างน้อยหนึ่งรูป",
    }), true);
    return;
  }

  setButtonLoading(uploadRoomButton, true);
  setMessage(roomUploadMessage, langText({
    en: "Uploading room items...",
    "zh-CN": "正在上传招领室物品...",
    th: "กำลังอัปโหลดสิ่งของเข้าห้องของหาย...",
  }));

  try {
    const images = [];
    for (const file of files) {
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

    const data = await apiFetch("/admin/room/items", {
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
    await refreshItemSurfaces({ includeAdmin: true, includeNotifications: true });
  } catch (error) {
    setMessage(roomUploadMessage, error.message, true);
    logClientError("uploading room items failed", error);
  } finally {
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
  if (!state.activeRoomPreviewItem) return;
  roomConfirmButton.disabled = true;
  setButtonLoading(roomAnalyzeButton, true);
  setMessage(roomPreviewMessage, langText({
    en: "Analyzing the selected area...",
    "zh-CN": "正在分析选中的区域...",
    th: "กำลังวิเคราะห์บริเวณที่เลือก...",
  }));

  try {
    const data = await apiFetch(`/items/${state.activeRoomPreviewItem.id}/claim-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selection: roomPreviewSelection() }),
    });
    state.roomPreviewAnalysis = data.preview || null;
    roomPreviewResult.textContent = data.preview?.description || "Selected area analyzed.";
    renderTags(roomPreviewTags, data.preview?.tags || []);
    roomConfirmButton.disabled = !state.roomPreviewAnalysis;
    triggerHaptic("success");
    setMessage(roomPreviewMessage, langText({
      en: "If this matches your item, confirm and continue to the claim form.",
      "zh-CN": "如果这和你的物品一致，请确认并继续填写认领表单。",
      th: "หากตรงกับสิ่งของของคุณ ให้ยืนยันและดำเนินการต่อไปยังแบบฟอร์มคำขอ",
    }));
  } catch (error) {
    setMessage(roomPreviewMessage, error.message, true);
    logClientError("analyzing room preview failed", error, { itemId: state.activeRoomPreviewItem.id });
  } finally {
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

function openClaimDialog(item, previewAnalysis = null) {
  if (item.claimed) {
    setMessage(uploadMessage, langText({ en: "This item has already been marked as claimed.", "zh-CN": "该物品已被标记为已认领。", th: "สิ่งของนี้ถูกทำเครื่องหมายว่ารับคืนแล้ว" }), true);
    return;
  }

  state.activeClaimItem = item;
  state.roomPreviewAnalysis = previewAnalysis;
  claimForm.reset();
  setMessage(claimMessage, "");
  claimItemLabel.textContent = `${item.title} • ${item.location}`;
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
  if (!state.activeClaimItem) return;

  const validationMessage = validateClaimForm();
  if (validationMessage) {
    setMessage(claimMessage, validationMessage, true);
    return;
  }
  if (!window.confirm(langText({ en: "Submit this claim for review?", "zh-CN": "提交这条认领以供审核？", th: "ส่งคำขอนี้เพื่อให้ผู้ดูแลตรวจสอบหรือไม่" }))) {
    return;
  }

  setButtonLoading(claimSubmitButton, true);
  setMessage(claimMessage, langText({ en: "Sending your claim for review...", "zh-CN": "正在发送认领审核...", th: "กำลังส่งคำขอเพื่อให้ผู้ดูแลตรวจสอบ..." }));

  try {
    await apiFetch(`/items/${state.activeClaimItem.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim_reason: claimReasonInput.value.trim(),
        item_description: claimDescriptionInput.value.trim(),
        lost_location: claimLocationInput.value.trim(),
        identifying_info: claimIdentifyingInput.value.trim(),
        visual_selection: state.roomPreviewAnalysis?.selection || null,
        visual_summary: state.roomPreviewAnalysis?.description || "",
        visual_tags: state.roomPreviewAnalysis?.tags || [],
      }),
    });
    setMessage(claimMessage, langText({
      en: "Your claim has been sent for review. You'll be notified when it's checked.",
      "zh-CN": "你的认领已发送审核，核查完成后我们会通知你。",
      th: "ส่งคำขอของคุณไปตรวจสอบแล้ว เราจะแจ้งให้ทราบเมื่อมีการตรวจสอบเสร็จสิ้น",
    }));
    triggerHaptic("success");
    invalidateSearchCache();
    await Promise.all([loadClaims(), loadNotifications(), loadReturnedItems(), loadStatsSummary()]);
    window.setTimeout(closeClaimModal, 450);
  } catch (error) {
    setMessage(claimMessage, langText({
      en: `Could not submit your claim: ${error.message}`,
      "zh-CN": `认领提交失败：${error.message}`,
      th: `ไม่สามารถส่งคำขอได้: ${error.message}`,
    }), true);
    logClientError("submitting claim failed", error, { itemId: state.activeClaimItem.id });
  } finally {
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
  clearSession();
  closeTutorial({ markSeen: false, rememberSession: false });
  closeReportModal();
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
  state.items = [];
  state.roomItems = [];
  state.returnedItems = [];
  state.notifications = [];
  state.notificationsLoadedOnce = false;
  state.unreadNotifications = 0;
  state.queryItems = [];
  state.claims = [];
  state.adminUsers = [];
  state.adminItems = [];
  state.adminClaims = [];
  state.adminAudits = [];
  state.aiInspectionLogs = [];
  state.adminMonitor = emptyAdminMonitor();
  state.adminTab = "users";
  state.statsSummary = { items_returned_this_week: 0 };
  state.currentQueryItem = null;
  state.queryMessages = [];
  state.selectedQueryFile = null;
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
  setMessage(profileImageMessage, "");
  setMessage(roomUploadMessage, "");
  setMessage(returnedMessage, "");
  renderStatsSummary();
  hideProgress("report");
  hideProgress("query");
  hideProgress("profile");
  form.reset();
  clearSelectedQueryFile();
  updateReportSubmitState();
  switchAdminTab("users");
  persistCurrentItemId(null);
  showAuthScreen();
  setAuthView("login");
  window.location.hash = "";
  state.currentView = "reports";
  renderDefaultLayout();
}

function bindEvents() {
  bindWindowPanelEvents();
  bindGlobalHapticFeedback();
  [
    [authForm, "submit", submitAuth, "auth form submit"],
    [loginTab, "click", () => setAuthView("login"), "login tab"],
    [registerTab, "click", () => setAuthView("register"), "register tab"],
    [authPasswordToggle, "click", () => setAuthPasswordVisibility(authPassword?.type === "password"), "password visibility"],
    [authConfirmPasswordToggle, "click", () => setAuthConfirmPasswordVisibility(authConfirmPassword?.type === "password"), "confirm password visibility"],
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
    [sidebarLauncherButton, "click", () => openPanel("sidebar"), "sidebar launcher"],
    [sidebarCollapseButton, "click", toggleSidebarCollapse, "sidebar collapse"],
    [sidebarModeSelect, "change", () => setSidebarMode(sidebarModeSelect.value), "sidebar mode"],
    [queryBackButton, "click", () => navigateTo("reports"), "query back"],
    [themeToggleButton, "click", toggleThemeMode, "theme toggle"],
    [openReportModalButton, "click", openReportModal, "open report modal"],
    [closeReportDialog, "click", closeReportModal, "close report modal"],
    [logoutButton, "click", logout, "logout"],
    [form, "submit", submitReport, "report form submit"],
    [imageInput, "change", () => selectFile(imageInput?.files?.[0] || null), "report image input"],
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
    [searchInput, "input", debounceLoadItems, "report search"],
    [categoryFilter, "change", loadItems, "category filter"],
    [statusFilter, "change", loadItems, "status filter"],
    [locationFilter, "change", loadItems, "location filter"],
    [optionalLocationInput, "input", updateLocationUi, "manual location input"],
    [queryItemSelect, "change", handleQueryItemSelection, "query item select"],
    [queryForm, "submit", submitQuery, "query form submit"],
    [queryFileInput, "change", () => selectQueryFile(queryFileInput?.files?.[0] || null), "query file input"],
    [queryFileRemoveButton, "click", clearSelectedQueryFile, "clear query file"],
    [queryClearThreadButton, "click", clearCurrentQueryThread, "clear query thread"],
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

  newWindowMenuButtons.forEach((button) => {
    bindListener(button, "click", () => openNewWindowTarget(button.dataset.newWindowTarget || "reports"), {
      label: `new window ${button.dataset.newWindowTarget || "unknown"}`,
    });
  });

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

  bindListener(reportDialog, "cancel", (event) => {
    event.preventDefault();
    closeReportModal();
  }, { label: "report dialog cancel" });
  bindListener(reportDialog, "close", resetReportModalState, { label: "report dialog close reset" });
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

  bindListener(queryInput, "keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      queryForm?.requestSubmit();
    }
  }, { label: "query submit shortcut" });
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
    if (event.key === "Escape") {
      closeNewWindowMenu();
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
  ensureGlobalBackground();
  initializeTheme();
  setLanguage(state.language);
  setAuthView("login");
  resetAdminMonitor();
  switchAdminTab("users");
  renderDefaultLayout();
  syncModeUi();
  bindEvents();
  renderSelectedQueryFile();
  updateReportSubmitState();
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
