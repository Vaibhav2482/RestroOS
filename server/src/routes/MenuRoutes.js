import express from "express";
import {
    getAllMenuItems,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
} from "../controllers/MenuController.js";
import { authenticate, authorize, authenticateOptional } from "../middleware/Auth.js";

const router = express.Router();

router.get("/", authenticateOptional, getAllMenuItems);
router.get("/:id", getMenuItemById);
router.post("/", authenticate, authorize("admin"), createMenuItem);
router.put("/:id", authenticate, authorize("admin"), updateMenuItem);
router.delete("/:id", authenticate, authorize("admin"), deleteMenuItem);

export default router;
