const express = require("../utils/expressAdapter");
const controller = require("../controllers/adminUserController");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.use("/admin/users", requireRole("admin"));
router.get("/admin/users", controller.listUsers);
router.post("/admin/users", controller.createUser);
router.patch("/admin/users/:id/status", controller.setStatus);
router.post("/admin/users/:id/reset-password", controller.resetPassword);

module.exports = router;