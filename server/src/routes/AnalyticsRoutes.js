import express from "express";
import {
    getOverview,
    getBranchComparison,
    getMenuProfitability,
    getTaxSummary,
    getPaymentBreakdown,
    getSalesSummary,
    getCategorySales,
    getStaffSales,
    getCouponUsage,
    getCancelledOrders,
    getDayEndSummary
} from "../controllers/AnalyticsController.js";
import { authenticate, authorize, requireOwner, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

// /overview backs the Analytics page; the rest back the Reports page's
// tabs - two different screens/permissions even though they share this
// route file. /branch-comparison stays requireOwner (cross-branch data),
// not part of the delegable list at all.
router.get("/overview", requirePermission("view_analytics"), getOverview);
router.get("/branch-comparison", requireOwner, getBranchComparison);
router.get("/menu-profitability", requirePermission("view_reports"), getMenuProfitability);
router.get("/tax-summary", requirePermission("view_reports"), getTaxSummary);
router.get("/payment-breakdown", requirePermission("view_reports"), getPaymentBreakdown);
router.get("/sales-summary", requirePermission("view_reports"), getSalesSummary);
router.get("/category-sales", requirePermission("view_reports"), getCategorySales);
router.get("/staff-sales", requirePermission("view_reports"), getStaffSales);
router.get("/coupon-usage", requirePermission("view_reports"), getCouponUsage);
router.get("/cancelled-orders", requirePermission("view_reports"), getCancelledOrders);
router.get("/day-end", requirePermission("view_reports"), getDayEndSummary);

export default router;
