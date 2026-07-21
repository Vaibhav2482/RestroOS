import express from "express";

import {
    createOrder,
    getActiveTableOrders,
    getAllOrders,
    getOrderById,
    getOrdersByCustomer,
    updateOrderStatus,
    updateOrderItems,
    cancelOrder
} from "../controllers/OrderController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

router.post("/", createOrder);
router.get("/", authorize("admin"), getAllOrders);
router.get("/active-by-table", authorize("admin"), getActiveTableOrders);
router.get("/:id", getOrderById);
router.get("/customer/:customerId", getOrdersByCustomer);
router.put("/:id/status", authorize("admin"), updateOrderStatus);
router.put("/:id/items", authorize("admin"), updateOrderItems);
router.put("/:id/cancel", cancelOrder);

export default router;
