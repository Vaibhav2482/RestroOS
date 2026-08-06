import express from "express";
import { getRecipeForMenuItem, replaceRecipe } from "../controllers/MenuItemRecipeController.js";
import { authenticate, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, requirePermission("manage_ingredients"));

router.get("/:menuItemId", getRecipeForMenuItem);
router.put("/:menuItemId", replaceRecipe);

export default router;
