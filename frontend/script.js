const API_PORT = "8000";
const API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const API_BASE = window.location.hostname
  ? window.location.port === API_PORT
    ? `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
    : `${API_PROTOCOL}//${window.location.hostname}:${API_PORT}`
  : "";
const SESSION_STORAGE_KEY = "lostfound_session";
const INITIALS_PATTERN = /^[a-z]+(?:\.[a-z]+)+$/;

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
};

const state = {
  authView: "login",
  user: null,
  token: localStorage.getItem(SESSION_STORAGE_KEY) || "",
  items: [],
  claims: [],
  adminUsers: [],
  adminClaims: [],
  adminTab: "users",
  filters: fallbackFilters,
  selectedFile: null,
  previewUrls: new Map(),
  queriesByItem: new Map(),
  searchTimer: null,
  activeClaimItem: null,
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
const showAdminButton = document.querySelector("#showAdminButton");
const logoutButton = document.querySelector("#logoutButton");
const accountName = document.querySelector("#accountName");
const accountMeta = document.querySelector("#accountMeta");
const reportsSection = document.querySelector("#reportsSection");
const claimsSection = document.querySelector("#claimsSection");
const adminSection = document.querySelector("#adminSection");

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
const submitButton = document.querySelector("#submitButton");

const gallery = document.querySelector("#gallery");
const itemTemplate = document.querySelector("#itemTemplate");
const resultCount = document.querySelector("#resultCount");
const searchInput = document.querySelector("#searchInput");
const searchLoading = document.querySelector("#searchLoading");
const refreshButton = document.querySelector("#refreshButton");

const claimsList = document.querySelector("#claimsList");
const claimsCount = document.querySelector("#claimsCount");
const claimsLoading = document.querySelector("#claimsLoading");
const refreshClaimsButton = document.querySelector("#refreshClaimsButton");
const claimHistoryTemplate = document.querySelector("#claimHistoryTemplate");
const refreshAdminButton = document.querySelector("#refreshAdminButton");
const adminUsersTab = document.querySelector("#adminUsersTab");
const adminClaimsTab = document.querySelector("#adminClaimsTab");
const adminSummary = document.querySelector("#adminSummary");
const adminLoading = document.querySelector("#adminLoading");
const adminMessage = document.querySelector("#adminMessage");
const adminUsersPanel = document.querySelector("#adminUsersPanel");
const adminClaimsPanel = document.querySelector("#adminClaimsPanel");
const adminUsersBody = document.querySelector("#adminUsersBody");
const adminClaimsList = document.querySelector("#adminClaimsList");

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

  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail.trim();
  }

  if (Array.isArray(data.detail)) {
    const message = data.detail.map(formatValidationIssue).filter(Boolean).join(" ");
    return message || fallback;
  }

  return fallback;
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

function getLocationMode() {
  return document.querySelector("input[name='locationMode']:checked").value;
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

function renderTags(container, tags) {
  container.replaceChildren();
  (tags || []).slice(0, 6).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    container.append(chip);
  });
}

function addInfo(list, label, value) {
  if (!value && value !== false) return;

  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = String(value);
  row.append(dt, dd);
  list.append(row);
}

function itemStatusLabel(item) {
  if (item.claimed) return "Claimed";
  return item.report_type === "found" ? "Found" : "Lost";
}

function statusBadgeClass(status) {
  return status === "approved" || status === "found"
    ? "is-lost"
    : status === "rejected"
      ? "is-found"
      : "is-claimed";
}

function renderQueryList(container, queries) {
  container.replaceChildren();
  if (!queries.length) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = "No queries yet.";
    container.append(empty);
    return;
  }

  queries.forEach((query) => {
    const row = document.createElement("article");
    row.className = "query-row";

    const meta = document.createElement("p");
    meta.className = "query-meta";
    meta.textContent = `${query.user_identity || "User"} • ${formatDateTime(query.created_at)}`;

    const message = document.createElement("p");
    message.className = "query-text";
    message.textContent = query.message;

    row.append(meta, message);
    container.append(row);
  });
}

async function loadQueries(itemId, listElement, loadingElement, force = false) {
  if (!force && state.queriesByItem.has(itemId)) {
    renderQueryList(listElement, state.queriesByItem.get(itemId));
    return;
  }

  setLoadingLine(loadingElement, true);
  try {
    const data = await apiFetch(`/items/${itemId}/queries`);
    const queries = data.queries || [];
    state.queriesByItem.set(itemId, queries);
    renderQueryList(listElement, queries);
  } catch (error) {
    renderQueryList(listElement, []);
    logClientError("loading queries failed", error, { itemId });
  } finally {
    setLoadingLine(loadingElement, false);
  }
}

async function postQuery(itemId, input, messageElement, submitButton, listElement, loadingElement) {
  const value = input.value.trim();
  if (value.length < 6) {
    setMessage(messageElement, "Query must be at least 6 characters.", true);
    return;
  }

  setButtonLoading(submitButton, true);
  setMessage(messageElement, "Posting query...");
  try {
    await apiFetch(`/items/${itemId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: value }),
    });
    input.value = "";
    setMessage(messageElement, "Query posted.");
    await loadQueries(itemId, listElement, loadingElement, true);
  } catch (error) {
    setMessage(messageElement, error.message, true);
    logClientError("posting query failed", error, { itemId });
  } finally {
    setButtonLoading(submitButton, false);
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
    const queryToggle = card.querySelector("[data-query-toggle]");
    const queryPanel = card.querySelector("[data-query-panel]");
    const queryList = card.querySelector("[data-query-list]");
    const queryLoading = card.querySelector("[data-query-loading]");
    const queryForm = card.querySelector("[data-query-form]");
    const queryInput = card.querySelector("[data-query-input]");
    const querySubmit = card.querySelector("[data-query-submit]");
    const queryMessage = card.querySelector("[data-query-message]");
    const markClaimedButton = card.querySelector("[data-mark-claimed-button]");

    title.textContent = item.title || "Untitled item";
    summary.textContent = item.ai_summary || `Tags cached via ${item.tag_source || "local tagging"}.`;
    description.textContent = item.description || "";

    const statusLabel = itemStatusLabel(item);
    status.textContent = statusLabel;
    status.classList.add(statusLabel === "Claimed" ? "is-claimed" : "is-lost");
    flag.textContent = statusLabel;
    flag.classList.add(statusLabel === "Claimed" ? "is-claimed" : "is-lost");
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

    queryToggle.addEventListener("click", async () => {
      const isHidden = queryPanel.classList.toggle("is-hidden");
      if (!isHidden) {
        await loadQueries(item.id, queryList, queryLoading);
      }
    });

    queryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await postQuery(item.id, queryInput, queryMessage, querySubmit, queryList, queryLoading);
    });

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

function updateAdminSummary() {
  adminSummary.textContent = state.adminTab === "users"
    ? `${state.adminUsers.length} user${state.adminUsers.length === 1 ? "" : "s"}`
    : `${state.adminClaims.length} claim${state.adminClaims.length === 1 ? "" : "s"}`;
}

function switchAdminTab(tab) {
  state.adminTab = tab;
  adminUsersTab.classList.toggle("is-active", tab === "users");
  adminClaimsTab.classList.toggle("is-active", tab === "claims");
  adminUsersPanel.classList.toggle("is-hidden", tab !== "users");
  adminClaimsPanel.classList.toggle("is-hidden", tab !== "claims");
  updateAdminSummary();
}

function renderAdminUsers(users) {
  adminUsersBody.replaceChildren();

  if (!users.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "admin-empty-cell";
    cell.textContent = "No users found.";
    row.append(cell);
    adminUsersBody.append(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");
    [user.id, user.initials || "-", user.class_of || "-", formatDateTime(user.created_at)].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    });
    adminUsersBody.append(row);
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

    const actionable = claim.status === "pending";
    approveButton.disabled = !actionable;
    rejectButton.disabled = !actionable;

    approveButton.addEventListener("click", () => handleAdminClaimDecision(claim.id, "approve", approveButton));
    rejectButton.addEventListener("click", () => handleAdminClaimDecision(claim.id, "reject", rejectButton));
    actions.append(approveButton, rejectButton);

    card.append(head, reason, info, actions);
    adminClaimsList.append(card);
  });
}

async function loadAdminData() {
  if (!currentUserCanAdmin()) {
    return;
  }

  setLoadingLine(adminLoading, true);
  setMessage(adminMessage, "");
  try {
    const [usersData, claimsData] = await Promise.all([
      apiFetch("/admin/users"),
      apiFetch("/admin/claims"),
    ]);
    state.adminUsers = usersData.users || [];
    state.adminClaims = claimsData.claims || [];
    renderAdminUsers(state.adminUsers);
    renderAdminClaims(state.adminClaims);
    updateAdminSummary();
  } catch (error) {
    state.adminUsers = [];
    state.adminClaims = [];
    setMessage(adminMessage, error.message, true);
    renderAdminUsers([]);
    renderAdminClaims([]);
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

async function loadFilters() {
  try {
    const filters = await apiFetch("/filters");
    state.filters = {
      categories: filters.categories || fallbackFilters.categories,
      statuses: filters.statuses || fallbackFilters.statuses,
    };
  } catch (error) {
    state.filters = fallbackFilters;
    logClientError("loading filters failed", error);
  }

  fillSelect(categoryInput, state.filters.categories);
  fillSelect(categoryFilter, state.filters.categories, true);
  fillSelect(statusFilter, state.filters.statuses, true);
  fillSelect(predefinedLocation, predefinedLocations);
  fillSelect(locationFilter, [
    ...predefinedLocations,
    "Senior Building",
    "Primary Building",
    "Innovation Building",
  ], true);
}

async function loadItems() {
  setLoadingLine(searchLoading, true);
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (categoryFilter.value) params.set("category", categoryFilter.value);
  if (statusFilter.value) params.set("status", statusFilter.value);
  if (locationFilter.value) params.set("location", locationFilter.value);

  try {
    const data = await apiFetch(`/items?${params.toString()}`);
    state.items = data.items || [];
    renderItems(state.items);
  } catch (error) {
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
  accountName.textContent = state.user.identity || state.user.username;
  accountMeta.textContent = currentUserCanAdmin() ? "Admin access" : `@${state.user.username}`;
  showAdminButton.classList.toggle("is-hidden", !currentUserCanAdmin());
  prefillReporter();
  dateInput.value = todayIso();
  updateLocationUi();
  await Promise.all([
    loadFilters(),
    loadItems(),
    loadClaims(),
    currentUserCanAdmin() ? loadAdminData() : Promise.resolve(),
  ]);
  switchSection("reports");
}

function switchSection(section) {
  const showClaims = section === "claims";
  const showAdmin = section === "admin" && currentUserCanAdmin();
  reportsSection.classList.toggle("is-hidden", showClaims || showAdmin);
  claimsSection.classList.toggle("is-hidden", !showClaims);
  adminSection.classList.toggle("is-hidden", !showAdmin);
}

async function submitReport(event) {
  event.preventDefault();
  const validationMessage = validateReportForm();
  if (validationMessage) {
    setMessage(uploadMessage, validationMessage, true);
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
    const requestLogBody = {
      ...requestBody,
      image: imagePayload
        ? {
            filename: imagePayload.filename,
            content_type: imagePayload.content_type,
            size: state.selectedFile?.size || 0,
          }
        : null,
    };

    console.debug("[LostFound] report request body", requestLogBody);
    const response = await fetch(ensureApiBase("/items/report"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(requestBody),
    });
    console.debug("[LostFound] report response status", response.status);
    const data = await response.json();
    console.debug("[LostFound] report response data", data);

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
    setMessage(uploadMessage, extractApiMessage(data, "Report saved successfully"));
    await loadItems();
  } catch (error) {
    setMessage(uploadMessage, error.message, true);
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

function logout() {
  clearSession();
  state.items = [];
  state.claims = [];
  state.adminUsers = [];
  state.adminClaims = [];
  state.adminTab = "users";
  state.queriesByItem.clear();
  gallery.replaceChildren();
  claimsList.replaceChildren();
  adminUsersBody.replaceChildren();
  adminClaimsList.replaceChildren();
  showAdminButton.classList.add("is-hidden");
  setMessage(adminMessage, "");
  switchAdminTab("users");
  switchSection("reports");
  showAuthScreen();
  setAuthView("login");
}

function bindEvents() {
  authForm.addEventListener("submit", submitAuth);
  loginTab.addEventListener("click", () => setAuthView("login"));
  registerTab.addEventListener("click", () => setAuthView("register"));

  showReportsButton.addEventListener("click", () => switchSection("reports"));
  showClaimsButton.addEventListener("click", async () => {
    switchSection("claims");
    await loadClaims();
  });
  showAdminButton.addEventListener("click", async () => {
    switchSection("admin");
    switchAdminTab(state.adminTab);
    await loadAdminData();
  });
  logoutButton.addEventListener("click", logout);

  form.addEventListener("submit", submitReport);
  imageInput.addEventListener("change", () => selectFile(imageInput.files[0]));
  refreshButton.addEventListener("click", loadItems);
  refreshClaimsButton.addEventListener("click", loadClaims);
  refreshAdminButton.addEventListener("click", loadAdminData);
  adminUsersTab.addEventListener("click", () => switchAdminTab("users"));
  adminClaimsTab.addEventListener("click", () => switchAdminTab("claims"));
  searchInput.addEventListener("input", debounceLoadItems);
  categoryFilter.addEventListener("change", loadItems);
  statusFilter.addEventListener("change", loadItems);
  locationFilter.addEventListener("change", loadItems);
  predefinedLocation.addEventListener("change", updateLocationUi);
  roomCodeInput.addEventListener("input", updateLocationUi);
  claimForm.addEventListener("submit", submitClaim);
  cancelClaimButton.addEventListener("click", closeClaimModal);
  closeClaimDialog.addEventListener("click", closeClaimModal);

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
  setAuthView("login");
  switchAdminTab("users");
  bindEvents();
  dateInput.value = todayIso();
  await checkBackend();
  await restoreSession();
}

init();
