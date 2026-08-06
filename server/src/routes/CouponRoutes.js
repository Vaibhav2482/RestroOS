import express from "express";

import {
    getAllCoupons,
    createCoupon,
    updateCoupon,
    deactivateCoupon,
    previewCoupon
} from "../controllers/CouponController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

router.post("/preview", previewCoupon);

router.get("/", authorize("admin"), getAllCoupons);
router.post("/", authorize("admin"), requirePermission("manage_coupons"), createCoupon);
router.put("/:id", authorize("admin"), requirePermission("manage_coupons"), updateCoupon);
router.delete("/:id", authorize("admin"), requirePermission("manage_coupons"), deactivateCoupon);

export default router;
