const aiProvider = require("./ai/aiProvider");

async function chat(payload = {}, patientId) {
  return aiProvider.chat(payload, patientId);
}

module.exports = { chat };
