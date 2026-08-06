import express from "express";
import {
    getAllMenuItems,
    getMenuItemById,
    getRecommendations,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
} from "../controllers/MenuController.js";
import { authenticate, authorize, authenticateOptional, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

// GET routes stay public/optional-auth - the storefront's menu browsing
// (and every admin page that needs to read the menu, e.g. POS/Kitchen)
// shares these, so they must never require manage_menu.
router.get("/", authenticateOptional, getAllMenuItems);
router.get("/:id/recommendations", getRecommendations);
router.get("/:id", getMenuItemById);
router.post("/", authenticate, authorize("admin"), requirePermission("manage_menu"), createMenuItem);
router.put("/:id", authenticate, authorize("admin"), requirePermission("manage_menu"), updateMenuItem);
router.delete("/:id", authenticate, authorize("admin"), requirePermission("manage_menu"), deleteMenuItem);

export default router;
