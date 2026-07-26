import express from "express";
import { getOverview, getBranchComparison } from "../controllers/AnalyticsController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/overview", getOverview);
router.get("/branch-comparison", requireOwner, getBranchComparison);

export default router;
