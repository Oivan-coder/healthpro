const { dbConfig } = require("./env");
const { runMigrations } = require("./migrations");

async function main() {
  const mysql = require("mysql2/promise");
  const config = dbConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: true
  });

  const applied = await runMigrations(connection);
  await connection.end();
  console.log(applied.length ? `Migrations applied: ${applied.join(", ")}` : "Database is up to date");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});