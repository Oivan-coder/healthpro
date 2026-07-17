const express = require("./utils/expressAdapter");
const cors = require("./utils/corsAdapter");
const securityHeaders = require("./utils/securityHeaders");
const apiRoutes = require("./routes");

const app = express();
const port = Number(process.env.PORT) || 3001;

if (typeof app.disable === "function") app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    error: error.message || "internal_error"
  });
});

app.listen(port, () => {
  console.log(`Атлас здоровья backend API listening on http://localhost:${port}`);
});
