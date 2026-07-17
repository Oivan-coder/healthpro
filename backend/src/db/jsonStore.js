const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");

function filePath(name) {
  return path.join(dataDir, `${name}.json`);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(filePath(name), "utf8"));
}

function writeJson(name, value) {
  fs.writeFileSync(filePath(name), `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

module.exports = { readJson, writeJson };
