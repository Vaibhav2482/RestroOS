import express from "express";

import {
    addToCart,
    getCart,
    updateCartQuantity,
    removeCartItem,
    clearCart
} from "../controllers/CartController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

router.post("/", addToCart);
router.get("/:customerId", getCart);
router.put("/:cartId", updateCartQuantity);
router.delete("/:cartId", removeCartItem);
router.delete("/customer/:customerId", clearCart);

export default router;
