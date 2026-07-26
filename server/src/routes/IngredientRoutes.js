import express from "express";
import { getAllIngredients, getIngredientById, createIngredient, updateIngredient } from "../controllers/IngredientController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/", getAllIngredients);
router.get("/:id", getIngredientById);
router.post("/", requireOwner, createIngredient);
router.put("/:id", requireOwner, updateIngredient);

export default router;
