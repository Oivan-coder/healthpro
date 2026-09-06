const { getPool } = require("../db/mysql");

function mapPasskey(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: Number(row.counter || 0),
    deviceType: row.device_type || null,
    backedUp: Boolean(row.backed_up),
    transports: String(row.transports || "").split(",").map((item) => item.trim()).filter(Boolean),
    label: row.label || null,
    lastUsedAt: row.last_used_at || null,
    createdAt: row.created_at || null
  };
}

async function listUserPasskeys(userId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT * FROM user_passkeys WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(mapPasskey);
}

async function findPasskeyByCredentialId(credentialId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT p.*, u.organization_id, u.login, u.display_name, u.password_hash,
            u.role, u.status, u.patient_id, u.must_change_password, u.last_login_at, u.created_at AS user_created_at
     FROM user_passkeys p
     JOIN users u ON u.id = p.user_id
     WHERE p.credential_id = ?
     LIMIT 1`,
    [credentialId]
  );
  return rows[0] || null;
}

async function createPasskey(passkey) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO user_passkeys
      (id, user_id, credential_id, public_key, counter, device_type, backed_up, transports, label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      passkey.id,
      passkey.userId,
      passkey.credentialId,
      passkey.publicKey,
      passkey.counter || 0,
      passkey.deviceType || null,
      passkey.backedUp ? 1 : 0,
      (passkey.transports || []).join(",") || null,
      passkey.label || null
    ]
  );
}

async function updatePasskeyUsage(credentialId, counter) {
  const pool = await getPool();
  await pool.query(
    `UPDATE user_passkeys SET counter = ?, last_used_at = NOW() WHERE credential_id = ?`,
    [counter || 0, credentialId]
  );
}

async function deletePasskey(userId, passkeyId) {
  const pool = await getPool();
  const [result] = await pool.query(
    `DELETE FROM user_passkeys WHERE id = ? AND user_id = ?`,
    [passkeyId, userId]
  );
  return result.affectedRows > 0;
}

async function createChallenge({ id, userId, purpose, challenge, expiresAt }) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO passkey_challenges (id, user_id, purpose, challenge, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, purpose, challenge, expiresAt]
  );
}

async function consumeChallenge(id, purpose) {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM passkey_challenges
       WHERE id = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [id, purpose]
    );
    if (!rows[0]) {
      await connection.rollback();
      return null;
    }
    await connection.query(
      `UPDATE passkey_challenges SET consumed_at = NOW() WHERE id = ?`,
      [id]
    );
    await connection.commit();
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listUserPasskeys,
  findPasskeyByCredentialId,
  createPasskey,
  updatePasskeyUsage,
  deletePasskey,
  createChallenge,
  consumeChallenge
};
