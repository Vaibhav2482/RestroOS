import express from "express";
import { getLogs } from "../controllers/AuditController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

// Owner-only - a branch admin seeing every other branch's staff/coupon/
// menu changes (and who made them) is more exposure than their role needs.
router.use(authenticate, authorize("admin"), requireOwner);

router.get("/", getLogs);

export default router;
