const fs = require("fs");
const path = require("path");

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function runMigrations(connection) {
  await ensureMigrationsTable(connection);
  const dir = path.join(__dirname, "migrations");
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const applied = [];

  for (const file of files) {
    const [rows] = await connection.query(
      "SELECT id FROM schema_migrations WHERE id = ? LIMIT 1",
      [file]
    );
    if (rows.length) continue;

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await connection.beginTransaction();
    try {
      await connection.query(sql);
      await connection.query("INSERT INTO schema_migrations (id) VALUES (?)", [file]);
      await connection.commit();
      applied.push(file);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  return applied;
}

module.exports = { runMigrations };