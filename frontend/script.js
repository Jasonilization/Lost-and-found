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
const INITIALS_PATTERN = /^[a-z]+(?:\.[a-z]+)+$/;
const THEMES = ["dark", "light", "aurora"];

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
  queryMessages: [],
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
const showClaimsButton = document.querySelector("#showClaimsButton");
const showAccountButton = document.querySelector("#showAccountButton");
const showAdminButton = document.querySelector("#showAdminButton");
const themeSelect = document.querySelector("#themeSelect");
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
    select.append(new Option("All", ""));
  }
  values.forEach((value) => select.append(new Option(value, value)));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function titleCase(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  authSubmitLabel.textContent = titleCase(view);
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
      error: "Room code must be S, P, or A followed by 3 digits, like S302.",
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
    : "Enter a room code like S302, P101, or A204";
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
    return "Initials must be lowercase and formatted like name.initial.";
  }
  if (!Number.isInteger(classOf) || classOf < 2025 || classOf > 2035) {
    return "Class of must be a year between 2025 and 2035.";
  }
  return null;
}

function validateReportForm() {
  const location = currentLocation();
  if (!titleInput.value.trim() || titleInput.value.trim().length < 3) {
    return "Item title must be at least 3 characters.";
  }
  if (!reporterInput.value.trim()) {
    return "Display name is required.";
  }
  if (!categoryInput.value) {
    return "Category is required.";
  }
  if (!dateInput.value) {
    return "Date is required.";
  }
  if (!descriptionInput.value.trim() || descriptionInput.value.trim().length < 10) {
    return "Description must be at least 10 characters.";
  }
  if (!location.valid) {
    return location.error;
  }
  return "";
}

function validateClaimForm() {
  if (!claimReasonInput.value.trim() || claimReasonInput.value.trim().length < 6) {
    return "Claim reason must be at least 6 characters.";
  }
  if (!claimDescriptionInput.value.trim() || claimDescriptionInput.value.trim().length < 6) {
    return "Description of item must be at least 6 characters.";
  }
  if (!claimLocationInput.value.trim() || claimLocationInput.value.trim().length < 4) {
    return "Lost location must be at least 4 characters.";
  }
  if (!claimIdentifyingInput.value.trim() || claimIdentifyingInput.value.trim().length < 4) {
    return "Additional identifying info must be at least 4 characters.";
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
  if (item.claimed) return "Claimed";
  return item.status || "Open";
}

function itemStatusClass(item) {
  return item.claimed || item.status === "Claimed" ? "is-claimed" : "is-lost";
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

function findItemById(itemId) {
  return state.items.find((item) => item.id === itemId) || null;
}

function buildHash(section, itemId = null) {
  if (section === "query" && itemId) {
    return `#query-${itemId}`;
  }
  return `#${section}`;
}

function readRoute() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) {
    return { section: "reports", itemId: state.currentItemId };
  }
  if (raw.startsWith("query-")) {
    const itemId = Number(raw.slice("query-".length)) || state.currentItemId;
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
    const itemId = route.itemId || state.currentItemId;
    if (!itemId) {
      navigateTo("reports");
      return;
    }
    switchSection("query");
    await loadQueryPage(itemId);
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
    serverStatus.textContent = "Backend online on port 8000";
    serverStatus.classList.add("is-online");
    serverStatus.classList.remove("is-offline");

    ollamaStatus.textContent = data.ollama_message || `Ollama status at ${data.ollama_url}`;
    ollamaStatus.classList.add(data.ollama_available ? "is-online" : "is-offline");
    ollamaStatus.classList.remove(data.ollama_available ? "is-offline" : "is-online");
  } catch (error) {
    serverStatus.textContent = "Backend offline";
    serverStatus.classList.add("is-offline");
    serverStatus.classList.remove("is-online");
    ollamaStatus.textContent = "Ollama unavailable";
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
  } catch (error) {
    setWarningCard(searchWarningCard, error.message);
    gallery.replaceChildren();
    const message = document.createElement("p");
    message.className = "status-message is-error";
    message.textContent = error.message;
    gallery.append(message);
    resultCount.textContent = "0 reports";
    logClientError("loading items failed", error);
  } finally {
    setLoadingLine(searchLoading, false);
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
  resultCount.textContent = `${items.length} report${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = "No reports match the current filters.";
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

    title.textContent = item.title || "Untitled item";
    summary.textContent = item.ai_summary || `Tags cached via ${item.tag_source || "local tagging"}.`;
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
    addInfo(info, "Status", statusLabel);
    addInfo(info, "Reported by", item.reporter_identity || item.reporter_name);
    addInfo(info, "Category", item.category);
    addInfo(info, "Location", item.location);
    addInfo(info, "Date", item.event_date);
    addInfo(info, "Created", formatDateTime(item.created_at));

    claimButton.disabled = item.claimed;
    claimButton.textContent = item.claimed ? "Already claimed" : "Claim item";
    claimButton.addEventListener("click", () => openClaimDialog(item));

    openQueryButton.addEventListener("click", () => navigateTo("query", item.id));

    if (currentUserCanAdmin()) {
      markClaimedButton.classList.remove("is-hidden");
      markClaimedButton.disabled = item.claimed;
      markClaimedButton.addEventListener("click", () => markItemClaimed(item.id, markClaimedButton));
    } else {
      markClaimedButton.classList.add("is-hidden");
    }

    gallery.append(card);
  });
}

function renderClaims(claims) {
  claimsList.replaceChildren();
  claimsCount.textContent = `${claims.length} claim${claims.length === 1 ? "" : "s"}`;

  if (!claims.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = "No claims yet.";
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

    title.textContent = claim.item?.title || `Item #${claim.item_id}`;
    meta.textContent = `${claim.user_identity || "User"} • Submitted ${formatDateTime(claim.timestamp)}`;
    status.textContent = titleCase(claim.status);
    status.classList.add(statusBadgeClass(claim.status));
    reason.textContent = claim.claim_reason;

    addInfo(info, "Claimant", claim.user_identity || "");
    addInfo(info, "Reported", claim.item?.reporter_identity || claim.item?.reporter_name || "");
    addInfo(info, "Lost at", claim.lost_location);
    addInfo(info, "Description", claim.item_description);
    addInfo(info, "ID info", claim.identifying_info);
    addInfo(info, "Updated", formatDateTime(claim.updated_at));

    claimsList.append(card);
  });
}

function renderAccount() {
  if (!state.user) return;

  accountAvatar.textContent = userAvatarLabel(state.user);
  accountPageName.textContent = userDisplayName(state.user);
  accountPageIdentity.textContent = `@${state.user.username}`;
  accountAdminBadge.classList.toggle("is-hidden", !currentUserCanAdmin());

  accountInfoList.replaceChildren();
  addInfo(accountInfoList, "Initials", state.user.initials || "-");
  addInfo(accountInfoList, "Class of", state.user.class_of || "-");
  addInfo(accountInfoList, "Created", formatDateTime(state.user.created_at));
  addInfo(accountInfoList, "Admin", currentUserCanAdmin() ? "Yes" : "No");
}

function updateAdminSummary() {
  if (state.adminTab === "users") {
    adminSummary.textContent = `${state.adminUsers.length} user${state.adminUsers.length === 1 ? "" : "s"}`;
    return;
  }
  if (state.adminTab === "items") {
    adminSummary.textContent = `${state.adminItems.length} item${state.adminItems.length === 1 ? "" : "s"}`;
    return;
  }
  if (state.adminTab === "claims") {
    adminSummary.textContent = `${state.adminClaims.length} claim${state.adminClaims.length === 1 ? "" : "s"}`;
    return;
  }
  adminSummary.textContent = `${state.aiInspectionLogs.length} AI decision${state.aiInspectionLogs.length === 1 ? "" : "s"}`;
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
    const values = [
      user.id,
      user.username,
      user.identity || `${user.initials || "-"} / ${user.class_of || "-"}`,
      user.is_admin ? "Admin" : "User",
      formatDateTime(user.created_at),
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value || "-");
      row.append(cell);
    });

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
    title.textContent = item.title || `Item #${item.id}`;
    const meta = document.createElement("p");
    meta.className = "admin-claim-meta";
    meta.textContent = `${item.category || "Category"} • ${item.location || "Location"} • ${formatDateTime(item.created_at)}`;
    headText.append(title, meta);

    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.classList.add(itemStatusClass(item));
    badge.textContent = item.status || (item.claimed ? "Claimed" : "Open");
    head.append(headText, badge);

    const info = document.createElement("dl");
    info.className = "info-list";
    addInfo(info, "ID", item.id);
    addInfo(info, "Reporter", item.reporter_identity || item.reporter_name || "");
    addInfo(info, "Description", item.description || "");
    addInfo(info, "Tags", (item.tags || []).join(", "));

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button card-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete item";
    deleteButton.addEventListener("click", () => handleAdminDelete(`/admin/items/${item.id}`, `Delete item #${item.id}?`));
    actions.append(deleteButton);

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
    title.textContent = claim.item?.title || `Item #${claim.item_id}`;
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
    addInfo(info, "Decision", log.allowed ? "Allowed" : "Blocked");
    addInfo(info, "Reason", log.reason || "");
    addInfo(info, "Tags", (log.tags || []).join(", "));
    addInfo(info, "Confidence", `${Math.round((log.confidence || 0) * 100)}%`);
    addInfo(info, "Raw output", log.raw_output || "");

    card.append(head, reason, info);
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
  if (!window.confirm(`${titleCase(verb)} this claim?`)) {
    return;
  }

  setButtonLoading(button, true);
  setMessage(adminMessage, `${titleCase(verb)}ing claim...`);
  try {
    const data = await apiFetch(`/admin/claims/${claimId}/${action}`, {
      method: "POST",
    });
    setMessage(adminMessage, data.message || `Claim ${verb}d.`);
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

  setMessage(adminMessage, "Deleting...");
  try {
    const data = await apiFetch(path, { method: "DELETE" });
    setMessage(adminMessage, data.message || "Deleted.");
    await Promise.all([loadAdminData(), loadItems(), loadClaims()]);
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError("admin delete failed", error, { path });
  }
}

async function handleAdminUserRoleAction(user, action) {
  const verb = action === "promote" ? "promote" : "demote";
  if (!window.confirm(`${titleCase(verb)} user #${user.id}?`)) {
    return;
  }

  setMessage(adminMessage, `${titleCase(verb)}ing user...`);
  try {
    const data = await apiFetch(`/admin/users/${user.id}/${action}`, { method: "POST" });
    setMessage(adminMessage, data.message || `User ${verb}d.`);
    await loadAdminData();
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    logClientError("admin user role action failed", error, { userId: user.id, action });
  }
}

function renderQueryContext(item) {
  state.currentQueryItem = item;
  persistCurrentItemId(item.id);

  queryItemTitle.textContent = item.title || `Item #${item.id}`;
  queryItemMeta.textContent = `${item.category || "Category"} • ${item.location || "Location"} • ${formatDateTime(item.created_at)}`;
  queryItemDescription.textContent = item.description || "";
  queryItemStatus.textContent = itemStatusLabel(item);
  queryItemStatus.className = "status-badge";
  queryItemStatus.classList.add(itemStatusClass(item));
  queryItemContextLabel.textContent = `Conversation for item #${item.id}`;
  renderTags(queryItemTags, item.tags || []);
}

function renderQueryMessages(messages) {
  queryMessages.replaceChildren();
  queryEmptyState.classList.toggle("is-hidden", messages.length > 0);

  messages.forEach((entry) => {
    const bubble = document.createElement("article");
    const isSystem = entry.role === "system";
    bubble.className = `query-bubble ${isSystem ? "is-system" : "is-user"}`;

    const meta = document.createElement("p");
    meta.className = "query-meta";
    meta.textContent = `${entry.user_identity || (isSystem ? "System" : "User")} • ${formatDateTime(entry.created_at)}`;

    const text = document.createElement("p");
    text.className = "query-text";
    text.textContent = entry.message || "";

    bubble.append(meta, text);
    queryMessages.append(bubble);
  });

  window.requestAnimationFrame(() => {
    queryMessages.scrollTop = queryMessages.scrollHeight;
  });
}

async function loadQueryPage(itemId) {
  setLoadingLine(queryLoading, true);
  setMessage(queryMessage, "");
  setWarningCard(queryWarningCard, "");

  try {
    const [itemData, queryData] = await Promise.all([
      apiFetch(`/items/${itemId}`),
      apiFetch(`/items/${itemId}/queries`),
    ]);
    const item = itemData.item;
    const messages = queryData.queries || [];
    renderQueryContext(item);
    state.queryMessages = messages;
    renderQueryMessages(messages);
  } catch (error) {
    setWarningCard(queryWarningCard, error.message);
    renderQueryMessages([]);
    queryItemTitle.textContent = "Item unavailable";
    queryItemMeta.textContent = "The selected item could not be loaded.";
    queryItemDescription.textContent = "";
    queryItemTags.replaceChildren();
    setMessage(queryMessage, error.message, true);
    logClientError("loading query page failed", error, { itemId });
  } finally {
    setLoadingLine(queryLoading, false);
  }
}

async function submitQuery(event) {
  event.preventDefault();
  if (!state.currentItemId) {
    setMessage(queryMessage, "Choose an item before sending a message.", true);
    return;
  }

  const value = queryInput.value.trim();
  if (value.length < 6) {
    setMessage(queryMessage, "Message must be at least 6 characters.", true);
    setWarningCard(queryWarningCard, "Message must be at least 6 characters.");
    return;
  }

  setButtonLoading(querySubmitButton, true);
  setMessage(queryMessage, "Sending message...");
  setWarningCard(queryWarningCard, "");
  try {
    const data = await apiFetch(`/items/${state.currentItemId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: value }),
    });
    queryInput.value = "";
    state.queryMessages = data.queries || [];
    renderQueryMessages(state.queryMessages);
    setMessage(queryMessage, data.response?.message || data.message || "Message sent.");
    await loadItems();
  } catch (error) {
    setMessage(queryMessage, error.message, true);
    setWarningCard(queryWarningCard, error.message);
    logClientError("submitting query failed", error, { itemId: state.currentItemId });
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
  setMessage(authMessage, `${titleCase(state.authView)} in progress...`);

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
    setMessage(authMessage, state.authView === "login" ? "Logged in." : "Account created.");
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
  accountMeta.textContent = currentUserCanAdmin() ? "Admin access" : `@${state.user.username}`;
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
  setMessage(uploadMessage, "Saving report...");
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
    dropTitle.textContent = "Drop image here";
    dropHint.textContent = "or choose a JPG/PNG file";
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

function openClaimDialog(item) {
  if (item.claimed) {
    setMessage(uploadMessage, "This item is already claimed.", true);
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
  if (!window.confirm("Submit this claim for review?")) {
    return;
  }

  setButtonLoading(claimSubmitButton, true);
  setMessage(claimMessage, "Submitting claim...");

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
    setMessage(claimMessage, "Claim submitted.");
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
  showClaimsButton.addEventListener("click", () => navigateTo("claims"));
  showAccountButton.addEventListener("click", () => navigateTo("account"));
  showAdminButton.addEventListener("click", () => navigateTo("admin"));
  queryBackButton.addEventListener("click", () => navigateTo("reports"));
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  logoutButton.addEventListener("click", logout);

  form.addEventListener("submit", submitReport);
  imageInput.addEventListener("change", () => selectFile(imageInput.files[0]));
  refreshButton.addEventListener("click", loadItems);
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
  setAuthView("login");
  switchAdminTab("users");
  bindEvents();
  updateReportSubmitState();
  dateInput.value = todayIso();
  await checkBackend();
  await restoreSession();
}

init();
