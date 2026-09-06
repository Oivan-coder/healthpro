const crypto = require("crypto");
const { dbConfig } = require("./env");
const { hashPassword } = require("../utils/passwords");

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

async function upsertUser(connection, user) {
  await connection.query(
    `INSERT INTO users
      (id, organization_id, login, display_name, password_hash, role, status, patient_id, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1)
     ON DUPLICATE KEY UPDATE
       organization_id = VALUES(organization_id),
       display_name = VALUES(display_name),
       password_hash = VALUES(password_hash),
       role = VALUES(role),
       status = 'active',
       patient_id = VALUES(patient_id),
       must_change_password = 1`,
    [user.id, user.organizationId, user.login, user.displayName, user.passwordHash, user.role, user.patientId]
  );
}

async function main() {
  const mysql = require("mysql2/promise");
  const config = dbConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database
  });

  const organizationId = process.env.DEMO_ORGANIZATION_ID || "org_demo";
  const organizationName = process.env.DEMO_ORGANIZATION_NAME || "Демо-клиника Атласа здоровья";
  const adminLogin = required("DEMO_ADMIN_LOGIN").toLowerCase();
  const adminPassword = required("DEMO_ADMIN_PASSWORD");
  const userLogin = required("DEMO_USER_LOGIN").toLowerCase();
  const userPassword = required("DEMO_USER_PASSWORD");
  const userDisplayName = process.env.DEMO_USER_DISPLAY_NAME || "Иванов Иван Иванович";
  const patientId = process.env.DEMO_USER_PATIENT_ID || "p_001";

  await connection.query(
    `INSERT INTO organizations (id, name, status)
     VALUES (?, ?, 'active')
     ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'active'`,
    [organizationId, organizationName]
  );

  await upsertUser(connection, {
    id: crypto.randomUUID(),
    organizationId,
    login: adminLogin,
    displayName: "Администратор демо-контура",
    passwordHash: await hashPassword(adminPassword),
    role: "admin",
    patientId: null
  });

  await upsertUser(connection, {
    id: crypto.randomUUID(),
    organizationId,
    login: userLogin,
    displayName: userDisplayName,
    passwordHash: await hashPassword(userPassword),
    role: "user",
    patientId
  });

  await connection.end();
  console.log(`Synthetic users stored in MySQL: ${adminLogin}, ${userLogin}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});