const { getPool } = require("../db/mysql");

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    login: row.login,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    patientId: row.patient_id,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at
  };
}

async function findUserByLogin(login) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE login = ? LIMIT 1",
    [String(login || "").trim().toLowerCase()]
  );
  return mapUser(rows[0]);
}

async function findUserById(id) {
  const pool = await getPool();
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return mapUser(rows[0]);
}

async function touchLastLogin(id) {
  const pool = await getPool();
  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [id]);
}

async function createSession(session) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO user_sessions
      (id, user_id, token_hash, expires_at, ip, user_agent, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [session.id, session.userId, session.tokenHash, session.expiresAt, session.ip || null, session.userAgent || null]
  );
}

async function findSessionByTokenHash(tokenHash) {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT s.id AS session_id, s.user_id, s.expires_at, s.revoked_at,
            u.id, u.organization_id, u.login, u.display_name, u.password_hash,
            u.role, u.status, u.patient_id, u.must_change_password, u.last_login_at, u.created_at
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  if (!rows[0]) return null;
  return {
    sessionId: rows[0].session_id,
    expiresAt: rows[0].expires_at,
    user: mapUser(rows[0])
  };
}

async function touchSession(sessionId) {
  const pool = await getPool();
  await pool.query("UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?", [sessionId]);
}

async function revokeSession(sessionId) {
  const pool = await getPool();
  await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?", [sessionId]);
}

async function revokeUserSessions(userId) {
  const pool = await getPool();
  await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [userId]);
}

async function updatePassword(userId, passwordHash) {
  const pool = await getPool();
  await pool.query(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    [passwordHash, userId]
  );
}

module.exports = {
  findUserByLogin,
  findUserById,
  touchLastLogin,
  createSession,
  findSessionByTokenHash,
  touchSession,
  revokeSession,
  revokeUserSessions,
  updatePassword
};