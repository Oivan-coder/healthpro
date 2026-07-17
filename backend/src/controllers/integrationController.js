const integrationService = require("../services/integrationService");
const fs = require("fs");
const path = require("path");

async function getStatus(req, res, next) {
  try { res.json(await integrationService.getStatus()); } catch (error) { next(error); }
}

function downloadDoc(relativePath, filename, contentType) {
  return (req, res, next) => {
    try {
      const filePath = path.resolve(__dirname, "../../../docs", relativePath);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file_not_found" });
      res.setHeader("Content-Type", contentType);
      res.download(filePath, filename);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  getStatus,
  downloadLabReportExample: downloadDoc("examples/lab-report-full-example.json", "lab-report-full-example.json", "application/json; charset=utf-8"),
  downloadLabExportFields: downloadDoc("examples/lab-export-fields.csv", "lab-export-fields.csv", "text/csv; charset=utf-8"),
  downloadIntegrationProtocol: downloadDoc("integration-protocol-lab-report.md", "integration-protocol-lab-report.md", "text/markdown; charset=utf-8")
};
