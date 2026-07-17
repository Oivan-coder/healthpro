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

  function getCurrentDemoPatientId() {
    return String(localStorage.getItem("demoPatientId") || "").trim();
  }

  function cloneFallback(fallbackValue) {
    if (Array.isArray(fallbackValue)) return [...fallbackValue];
    if (fallbackValue && typeof fallbackValue === "object") return { ...fallbackValue };
    return fallbackValue;
  }

  function patientStorageKey(baseKey) {
    const patientId = getCurrentDemoPatientId();
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
    if (!key) return;
    localStorage.removeItem(key);
  }

  function clearPatientSessionState() {
    SESSION_STATE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
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
  }

  return {
    getCurrentDemoPatientId,
    patientStorageKey,
    getPatientState,
    setPatientState,
    removePatientState,
    clearPatientSessionState
  };
})();

window.HealthAPI = (() => {
  const API_BASE = "http://localhost:3001/api";
  let mode = "unknown";
  let lastError = "";
  let lastErrorCode = "";

  function demoPatientId() {
    return PatientStorage.getCurrentDemoPatientId();
  }

  async function request(path, options = {}) {
    const { patientRequired = true, headers = {}, ...fetchOptions } = options;
    const patientId = demoPatientId();
    try {
      if (patientRequired && !patientId) {
        throw Object.assign(new Error("demo_context_required"), { code: "demo_context_required" });
      }
      const requestHeaders = { "Content-Type": "application/json", ...headers };
      if (patientId) requestHeaders["X-Demo-Patient-Id"] = patientId;
      const response = await fetch(`${API_BASE}${path}`, {
        headers: requestHeaders,
        ...fetchOptions
      });
      if (!response.ok) {
        let body = {};
        try { body = await response.json(); } catch (parseError) { body = {}; }
        const code = body.error || `api_${response.status}`;
        throw Object.assign(new Error(code), { code, status: response.status });
      }
      mode = "backend";
      lastError = "";
      lastErrorCode = "";
      return response.json();
    } catch (error) {
      mode = "unavailable";
      lastErrorCode = error.code || error.message || "api_unavailable";
      lastError = ["demo_context_required", "invalid_demo_patient"].includes(lastErrorCode)
        ? "Демо-пациент не выбран. Вернитесь на экран входа."
        : "Backend API недоступен. Запустите сервер: cd backend && npm run dev";
      throw error;
    }
  }

  function apiMode() {
    if (mode === "unknown") {
      return {
        mode: "ready",
        lastError,
        lastErrorCode,
        label: "Кабинет готов"
      };
    }
    return {
      mode: mode === "backend" ? "backend" : "unavailable",
      lastError,
      lastErrorCode,
      label: mode === "backend" ? "Данные обновлены" : "Кабинет временно недоступен"
    };
  }

  function getSummary() { return request("/summary"); }
  function getPatient() { return request("/patient"); }
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
  function getIntegrationStatus() { return request("/integration/status", { patientRequired: false }); }
  function getAuditEvents() { return request("/audit/events", { patientRequired: false }); }
  function getBookingData() { return request("/appointments/dictionary"); }
  function documentDownloadUrl(id) { return `${API_BASE}/documents/${encodeURIComponent(id)}/download?demoPatientId=${encodeURIComponent(demoPatientId())}`; }
  function labReportPdfDownloadUrl(id) { return `${API_BASE}/lab-reports/${encodeURIComponent(id)}/pdf?demoPatientId=${encodeURIComponent(demoPatientId())}`; }
  function integrationDownloadUrl(path) { return `${API_BASE}${path}`; }

  function post(path, payload) {
    return request(path, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function importLabReport(payload) { return post("/integration/lab-report", payload); }
  function validateLabs(items) { return post("/labs/validate", items); }
  function importLabs(items) { return post("/labs/import", items); }
  function bookAppointment(payload) { return post("/appointments/book", payload); }
  function assistantChat(payload) { return post("/assistant/chat", payload); }

  function reset() {
    lastError = "Сброс локальных данных отключен: медицинские данные загружаются через backend API.";
    return Promise.resolve({ ok: true });
  }

  return {
    API_BASE,
    apiMode,
    getSummary,
    getPatient,
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
