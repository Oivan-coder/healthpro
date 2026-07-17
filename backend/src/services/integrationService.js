const integrationRepository = require("../repositories/integrationRepository");

async function getStatus() {
  return integrationRepository.getStatus();
}

module.exports = { getStatus };
