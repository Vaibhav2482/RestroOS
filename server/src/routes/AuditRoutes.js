import express from "express";
import { getLogs } from "../controllers/AuditController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

// Owner-only by default - a branch admin seeing every other branch's
// staff/coupon/menu changes (and who made them) is more exposure than
// their role needs - but an Owner can delegate read access via the
// view_activity_log permission if they want a trusted admin to have it.
router.use(authenticate, authorize("admin"), requirePermission("view_activity_log"));

router.get("/", getLogs);

export default router;
