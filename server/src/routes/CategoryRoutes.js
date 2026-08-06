import express from "express";
import {
    getPublicCategories,
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controllers/CategoryController.js";
import { authenticate, authenticateOptional, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.get("/public", getPublicCategories);

// The admin list stays open to any admin - Menu.jsx (and POS's category
// filter) need to read it regardless of manage_categories, the same way
// Menu/Branches GETs are open supporting data for other permissions.
router.get("/", authenticate, authorize("admin"), getAllCategories);
router.get("/:id", authenticateOptional, getCategoryById);
router.post("/", authenticate, authorize("admin"), requirePermission("manage_categories"), createCategory);
router.put("/:id", authenticate, authorize("admin"), requirePermission("manage_categories"), updateCategory);
router.delete("/:id", authenticate, authorize("admin"), requirePermission("manage_categories"), deleteCategory);

export default router;
