import express from "express";
import { getRecipeForMenuItem, replaceRecipe } from "../controllers/MenuItemRecipeController.js";
import { authenticate, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, requireOwner);

router.get("/:menuItemId", getRecipeForMenuItem);
router.put("/:menuItemId", replaceRecipe);

export default router;
