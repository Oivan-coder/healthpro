const crypto = require("crypto");
const repo = require("../repositories/adminUserRepository");
const authRepository = require("../repositories/authRepository");
const { hashPassword } = require("../utils/passwords");

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

async function listUsers(adminUser) {
  return repo.listUsers(adminUser.organizationId);
}

async function createUser(adminUser, payload) {
  const login = normalizeLogin(payload.login);
  const displayName = String(payload.displayName || "").trim();
  const role = payload.role === "admin" ? "admin" : "user";
  const patientId = payload.patientId ? String(payload.patientId).trim() : null;
  if (!login || login.length < 3) throw httpError("invalid_login", 400);
  if (!displayName) throw httpError("display_name_required", 400);

  const passwordHash = await hashPassword(payload.temporaryPassword);
  const user = {
    id: crypto.randomUUID(),
    organizationId: adminUser.organizationId,
    login,
    displayName,
    passwordHash,
    role,
    patientId
  };

  try {
    await repo.createUser(user);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw httpError("login_already_exists", 409);
    if (error.code === "ER_NO_REFERENCED_ROW_2") throw httpError("invalid_patient_id", 400);
    throw error;
  }

  return { id: user.id, login, displayName, role, patientId, status: "active", mustChangePassword: true };
}

async function setStatus(adminUser, userId, status) {
  if (!["active", "blocked"].includes(status)) throw httpError("invalid_status", 400);
  if (userId === adminUser.id && status === "blocked") throw httpError("cannot_block_self", 400);
  const changed = await repo.setStatus(userId, adminUser.organizationId, status);
  if (!changed) throw httpError("user_not_found", 404);
  if (status === "blocked") await authRepository.revokeUserSessions(userId);
  return { ok: true, status };
}

async function resetPassword(adminUser, userId, temporaryPassword) {
  const target = await repo.findUser(userId, adminUser.organizationId);
  if (!target) throw httpError("user_not_found", 404);
  const passwordHash = await hashPassword(temporaryPassword);
  await repo.resetPassword(userId, adminUser.organizationId, passwordHash);
  await authRepository.revokeUserSessions(userId);
  return { ok: true, mustChangePassword: true };
}

module.exports = { listUsers, createUser, setStatus, resetPassword };