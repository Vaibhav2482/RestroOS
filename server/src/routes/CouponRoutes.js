import express from "express";

import {
    getAllCoupons,
    createCoupon,
    updateCoupon,
    deactivateCoupon,
    previewCoupon
} from "../controllers/CouponController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

router.post("/preview", previewCoupon);

router.get("/", authorize("admin"), getAllCoupons);
router.post("/", authorize("admin"), createCoupon);
router.put("/:id", authorize("admin"), updateCoupon);
router.delete("/:id", authorize("admin"), deactivateCoupon);

export default router;
