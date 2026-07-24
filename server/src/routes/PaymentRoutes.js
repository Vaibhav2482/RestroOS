import express from "express";

import {
    createPayment,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getPaymentByOrderId,
    getPaymentsByCustomer
} from "../controllers/PaymentController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

router.post("/", createPayment);

router.post("/razorpay/order", createRazorpayOrder);

router.post("/razorpay/verify", verifyRazorpayPayment);

router.get("/order/:orderId", getPaymentByOrderId);

router.get("/customer/:customerId", getPaymentsByCustomer);

export default router;
