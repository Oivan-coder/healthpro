const fs = require("fs");
const path = require("path");
const { dbConfig } = require("./env");

async function main() {
  const config = dbConfig();
  let mysql;
  try {
    mysql = require("mysql2/promise");
  } catch (error) {
    console.error("mysql2 не установлен. Выполните: npm install");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: true
  });

  const seed = fs.readFileSync(path.join(__dirname, "seed.mysql.sql"), "utf8");
  await connection.query(seed);
  await connection.end();

  console.log(`MySQL seed loaded: ${config.database}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
