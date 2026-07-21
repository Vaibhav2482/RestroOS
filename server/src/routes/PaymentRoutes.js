import express from "express";

import {
    createPayment,
    getPaymentByOrderId,
    getPaymentsByCustomer
} from "../controllers/PaymentController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

router.post("/", createPayment);

router.get("/order/:orderId", getPaymentByOrderId);

router.get("/customer/:customerId", getPaymentsByCustomer);

export default router;
