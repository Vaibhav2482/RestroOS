import express from "express";
import {
    getBranchInventory,
    getTransactions,
    getDashboard,
    recordOpeningStock,
    recordWastage,
    recordAdjustment
} from "../controllers/InventoryController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/branch-stock", getBranchInventory);
router.get("/transactions", getTransactions);
router.get("/dashboard", getDashboard);
router.post("/opening-stock", recordOpeningStock);
router.post("/wastage", recordWastage);
router.post("/adjustment", recordAdjustment);

export default router;
