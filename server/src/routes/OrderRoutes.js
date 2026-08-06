import express from "express";

import {
    createOrder,
    getActiveTableOrders,
    getKitchenOrders,
    getAllOrders,
    getOrderById,
    getOrdersByCustomer,
    updateOrderStatus,
    updateOrderItems,
    cancelOrder,
    emailBill,
    reorderOrder
} from "../controllers/OrderController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

// create/cancel/reorder/email-bill and the two customer-facing reads stay
// ungated here - they're shared with the storefront checkout/order-history
// flow, which requirePermission (admin-only) would otherwise block outright.
router.post("/", createOrder);
router.get("/", authorize("admin"), requirePermission("manage_orders"), getAllOrders);
router.get("/active-by-table", authorize("admin"), requirePermission("manage_orders"), getActiveTableOrders);
router.get("/kitchen/active", authorize("admin"), requirePermission("manage_orders"), getKitchenOrders);
router.get("/:id", getOrderById);
router.get("/customer/:customerId", getOrdersByCustomer);
router.put("/:id/status", authorize("admin"), requirePermission("manage_orders"), updateOrderStatus);
router.put("/:id/items", authorize("admin"), requirePermission("manage_orders"), updateOrderItems);
router.put("/:id/cancel", cancelOrder);
router.post("/:id/reorder", reorderOrder);
router.post("/:id/email-bill", emailBill);

export default router;
