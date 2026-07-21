import express from "express";
import {
    getPublicCategories,
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controllers/CategoryController.js";
import { authenticate, authenticateOptional, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.get("/public", getPublicCategories);

router.get("/", authenticate, authorize("admin"), getAllCategories);
router.get("/:id", authenticateOptional, getCategoryById);
router.post("/", authenticate, authorize("admin"), createCategory);
router.put("/:id", authenticate, authorize("admin"), updateCategory);
router.delete("/:id", authenticate, authorize("admin"), deleteCategory);

export default router;
