const crypto = require("crypto");
const authRepository = require("../repositories/authRepository");
const { hashPassword, verifyPassword } = require("../utils/passwords");

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function authError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function publicUser(user) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    login: user.login,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    patientId: user.patientId,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt
  };
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSessionForUser({ user, ip, userAgent }) {
  if (!user || user.status !== "active") throw authError("user_blocked", 403);
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await authRepository.createSession({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
    ip,
    userAgent
  });
  await authRepository.touchLastLogin(user.id);
  return { token, expiresAt, user: publicUser(user) };
}

async function login({ login, password, ip, userAgent }) {
  const user = await authRepository.findUserByLogin(login);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw authError("invalid_credentials", 401);
  }
  if (user.status !== "active") throw authError("user_blocked", 403);
  return createSessionForUser({ user, ip, userAgent });
}

async function resolveSession(token) {
  if (!token) return null;
  const session = await authRepository.findSessionByTokenHash(hashSessionToken(token));
  if (!session || session.user.status !== "active") return null;
  await authRepository.touchSession(session.sessionId);
  return {
    sessionId: session.sessionId,
    user: publicUser(session.user)
  };
}

async function logout(sessionId) {
  if (sessionId) await authRepository.revokeSession(sessionId);
}

async function changePassword(userId, currentPassword, nextPassword) {
  const user = await authRepository.findUserById(userId);
  if (!user) throw authError("user_not_found", 404);
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw authError("invalid_current_password", 400);
  }
  const nextHash = await hashPassword(nextPassword);
  await authRepository.updatePassword(userId, nextHash);
  await authRepository.revokeUserSessions(userId);
  return { ok: true };
}

module.exports = {
  login,
  createSessionForUser,
  resolveSession,
  logout,
  changePassword,
  publicUser,
  SESSION_TTL_MS
};