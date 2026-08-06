import express from "express";
import { getLogs } from "../controllers/AuditController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

// Owner-only by default - a branch admin seeing every other branch's
// staff/coupon/menu changes is more exposure than their role needs - but
// delegable via view_activity_log if an Owner wants to grant it.
router.use(authenticate, authorize("admin"), requirePermission("view_activity_log"));

router.get("/", getLogs);

export default router;
