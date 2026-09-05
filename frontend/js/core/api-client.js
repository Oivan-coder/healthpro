window.PatientStorage = (() => {
  const SESSION_STATE_KEYS = [
    "healthId.assistantContext",
    "healthId.assistantDraft",
    "healthId.assistantMessages",
    "healthId.selectedLabContext",
    "healthId.appointmentContext",
    "atlas.assistantContext",
    "atlas.appointmentContext",
    "atlas.selectedLabContext"
  ];
  const PATIENT_KEY = "atlas.uiPatientId";

  function setCurrentPatientId(patientId) {
    const value = String(patientId || "").trim();
    if (value) sessionStorage.setItem(PATIENT_KEY, value);
    else sessionStorage.removeItem(PATIENT_KEY);
  }

  function getCurrentPatientId() {
    return String(sessionStorage.getItem(PATIENT_KEY) || "").trim();
  }

  function cloneFallback(fallbackValue) {
    if (Array.isArray(fallbackValue)) return [...fallbackValue];
    if (fallbackValue && typeof fallbackValue === "object") return { ...fallbackValue };
    return fallbackValue;
  }

  function patientStorageKey(baseKey) {
    const patientId = getCurrentPatientId();
    return patientId ? `${baseKey}:${patientId}` : "";
  }

  function getPatientState(baseKey, fallbackValue = null) {
    const key = patientStorageKey(baseKey);
    if (!key) return cloneFallback(fallbackValue);
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : cloneFallback(fallbackValue);
    } catch (error) {
      return cloneFallback(fallbackValue);
    }
  }

  function setPatientState(baseKey, value) {
    const key = patientStorageKey(baseKey);
    if (!key) return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }

  function removePatientState(baseKey) {
    const key = patientStorageKey(baseKey);
    if (key) localStorage.removeItem(key);
  }

  function clearPatientSessionState() {
    SESSION_STATE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    setCurrentPatientId("");
    if (window.AssistantState) {
      AssistantState.mode = "patient_summary";
      AssistantState.context = null;
      AssistantState.messages = [];
      AssistantState.draft = "";
      AssistantState.pending = false;
      AssistantState.pickerOpen = false;
      AssistantState.pickerQuery = "";
    }
    if (window.BookingState) {
      BookingState.resultContext = null;
      BookingState.specialtyId = "therapy";
      BookingState.doctorId = "";
      BookingState.date = "26.04";
      BookingState.slot = "11:30";
    }
    if (window.LabState) {
      LabState.mode = "reports";
      LabState.group = "Все";
      LabState.query = "";
      LabState.selectedCode = "";
      LabState.selectedReportId = "";
      LabState.onlyAbnormal = false;
      LabState.sort = "date";
    }
    if (window.DashboardState) {
      DashboardState.editingTrends = false;
      DashboardState.trendQuery = "";
    }
    if (window.ManualLabEntryState) {
      ManualLabEntryState.owner = "";
      ManualLabEntryState.patientId = "";
      ManualLabEntryState.serviceId = "";
      ManualLabEntryState.serviceQuery = "";
      ManualLabEntryState.testQuery = "";
      ManualLabEntryState.tests = [];
      ManualLabEntryState.entries = [];
      ManualLabEntryState.lastReport = null;
    }
  }

  return {
    setCurrentPatientId,
    getCurrentPatientId,
    patientStorageKey,
    getPatientState,
    setPatientState,
    removePatientState,
    clearPatientSessionState
  };
})();

window.HealthAPI = (() => {
  function resolveApiBase() {
    const configured = String(window.ATLAS_API_BASE || "").trim();
    if (configured) return configured.replace(/\/+$/, "");
    const hostname = window.location.hostname;
    if (["localhost", "127.0.0.1"].includes(hostname)) return "http://localhost:3001/api";
    return `${window.location.origin}/api`;
  }

  const API_BASE = resolveApiBase();
  let mode = "unknown";
  let lastError = "";
  let lastErrorCode = "";

  async function request(path, options = {}) {
    const { headers = {}, ...fetchOptions } = options;
    try {
      const requestHeaders = { "Content-Type": "application/json", ...headers };
      const response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: requestHeaders,
        ...fetchOptions
      });
      let body = null;
      if (response.status !== 204) {
        try { body = await response.json(); } catch (parseError) { body = null; }
      }
      if (!response.ok) {
        const code = body?.error || `api_${response.status}`;
        throw Object.assign(new Error(code), { code, status: response.status });
      }
      mode = "backend";
      lastError = "";
      lastErrorCode = "";
      return body;
    } catch (error) {
      if (!error.status || error.status >= 500) mode = "unavailable";
      lastErrorCode = error.code || error.message || "api_unavailable";
      lastError = error.status ? lastErrorCode : "Backend API недоступен";
      throw error;
    }
  }

  function apiMode() {
    if (mode === "unknown") return { mode: "ready", lastError, lastErrorCode, label: "Кабинет готов" };
    return {
      mode: mode === "backend" ? "backend" : "unavailable",
      lastError,
      lastErrorCode,
      label: mode === "backend" ? "Данные обновлены" : "Кабинет временно недоступен"
    };
  }

  function post(path, payload) {
    return request(path, { method: "POST", body: JSON.stringify(payload || {}) });
  }

  function patch(path, payload) {
    return request(path, { method: "PATCH", body: JSON.stringify(payload || {}) });
  }

  function login(loginValue, password) { return post("/auth/login", { login: loginValue, password }); }
  function me() { return request("/auth/me"); }
  function logout() { return post("/auth/logout", {}); }
  function changePassword(currentPassword, newPassword) {
    return post("/auth/change-password", { currentPassword, newPassword });
  }

  function adminListUsers() { return request("/admin/users"); }
  function adminCreateUser(payload) { return post("/admin/users", payload); }
  function adminSetUserStatus(id, status) {
    return patch(`/admin/users/${encodeURIComponent(id)}/status`, { status });
  }
  function adminResetPassword(id, temporaryPassword) {
    return post(`/admin/users/${encodeURIComponent(id)}/reset-password`, { temporaryPassword });
  }

  function getSummary() { return request("/summary"); }
  function getPatient() { return request("/patient"); }
  function updatePatient(payload) { return patch("/patient", payload); }
  function getLabs() { return request("/labs"); }
  function getLabHistory() { return request("/labs/history"); }
  function getLabCatalog() { return request("/labs/catalog"); }
  function getLabReports() { return request("/lab-reports"); }
  function getLabReport(id) { return request(`/lab-reports/${encodeURIComponent(id)}`); }
  function getLabTestHistory(testCode) { return request(`/lab-tests/${encodeURIComponent(testCode)}/history`); }
  function getUnmappedLabMappings() { return request("/lab-mappings/unmapped"); }
  function getVisits() { return request("/visits"); }
  function getReports() { return request("/reports"); }
  function getDocuments() { return request("/documents"); }
  function getIntegrationStatus() { return request("/integration/status"); }
  function getAuditEvents() { return request("/audit/events"); }
  function getBookingData() { return request("/appointments/dictionary"); }
  function documentDownloadUrl(id) { return `${API_BASE}/documents/${encodeURIComponent(id)}/download`; }
  function labReportPdfDownloadUrl(id) { return `${API_BASE}/lab-reports/${encodeURIComponent(id)}/pdf`; }
  function integrationDownloadUrl(path) { return `${API_BASE}${path}`; }

  function importLabReport(payload) { return post("/integration/lab-report", payload); }
  function validateLabs(items) { return post("/labs/validate", items); }
  function importLabs(items) { return post("/labs/import", items); }
  function bookAppointment(payload) { return post("/appointments/book", payload); }
  function assistantChat(payload) { return post("/assistant/chat", payload); }

  function reset() {
    lastError = "Сброс локальных данных отключен: данные загружаются через backend API.";
    return Promise.resolve({ ok: true });
  }

  return {
    API_BASE,
    apiMode,
    login,
    me,
    logout,
    changePassword,
    adminListUsers,
    adminCreateUser,
    adminSetUserStatus,
    adminResetPassword,
    getSummary,
    getPatient,
    updatePatient,
    getLabs,
    getLabHistory,
    getLabCatalog,
    getLabReports,
    getLabReport,
    getLabTestHistory,
    importLabReport,
    getUnmappedLabMappings,
    importLabs,
    validateLabs,
    getVisits,
    bookAppointment,
    getReports,
    getDocuments,
    documentDownloadUrl,
    labReportPdfDownloadUrl,
    getIntegrationStatus,
    getAuditEvents,
    integrationDownloadUrl,
    getBookingData,
    assistantChat,
    summary: getSummary,
    labs: getLabs,
    labHistory: getLabHistory,
    visits: getVisits,
    reports: async () => ({ reports: await getReports(), docs: await getDocuments() }),
    bookingData: getBookingData,
    importLabObservations: importLabs,
    reset
  };
})();
