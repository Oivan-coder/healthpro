const { getPool } = require("../db/mysql");

function mapUser(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    login: row.login,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    patientId: row.patient_id,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listUsers(organizationId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT id, organization_id, login, display_name, role, status, patient_id,
            must_change_password, last_login_at, created_at, updated_at
     FROM users WHERE organization_id = ? ORDER BY created_at DESC`,
    [organizationId]
  );
  return rows.map(mapUser);
}

async function findUser(id, organizationId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE id = ? AND organization_id = ? LIMIT 1",
    [id, organizationId]
  );
  return rows[0] || null;
}

async function createUser(user) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO users
      (id, organization_id, login, display_name, password_hash, role, status, patient_id, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1)`,
    [user.id, user.organizationId, user.login, user.displayName, user.passwordHash, user.role, user.patientId || null]
  );
}

async function setStatus(id, organizationId, status) {
  const pool = await getPool();
  const [result] = await pool.query(
    "UPDATE users SET status = ? WHERE id = ? AND organization_id = ?",
    [status, id, organizationId]
  );
  return result.affectedRows > 0;
}

async function resetPassword(id, organizationId, passwordHash) {
  const pool = await getPool();
  const [result] = await pool.query(
    `UPDATE users SET password_hash = ?, must_change_password = 1
     WHERE id = ? AND organization_id = ?`,
    [passwordHash, id, organizationId]
  );
  return result.affectedRows > 0;
}

module.exports = { listUsers, findUser, createUser, setStatus, resetPassword };