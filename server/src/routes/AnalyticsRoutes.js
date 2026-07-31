import express from "express";
import {
    getOverview,
    getBranchComparison,
    getMenuProfitability,
    getTaxSummary,
    getPaymentBreakdown,
    getSalesSummary,
    getCategorySales,
    getCouponUsage,
    getCancelledOrders
} from "../controllers/AnalyticsController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/overview", getOverview);
router.get("/branch-comparison", requireOwner, getBranchComparison);
router.get("/menu-profitability", getMenuProfitability);
router.get("/tax-summary", getTaxSummary);
router.get("/payment-breakdown", getPaymentBreakdown);
router.get("/sales-summary", getSalesSummary);
router.get("/category-sales", getCategorySales);
router.get("/coupon-usage", getCouponUsage);
router.get("/cancelled-orders", getCancelledOrders);

export default router;
