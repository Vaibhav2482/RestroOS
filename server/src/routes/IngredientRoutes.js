import express from "express";
import { getAllIngredients, getIngredientById, createIngredient, updateIngredient } from "../controllers/IngredientController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/", getAllIngredients);
router.get("/:id", getIngredientById);
router.post("/", requirePermission("manage_ingredients"), createIngredient);
router.put("/:id", requirePermission("manage_ingredients"), updateIngredient);

export default router;
