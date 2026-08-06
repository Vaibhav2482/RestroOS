import express from "express";
import {
    getBranchInventory,
    getValuation,
    getTransactions,
    getDashboard,
    recordOpeningStock,
    recordWastage,
    recordAdjustment
} from "../controllers/InventoryController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/branch-stock", requirePermission("manage_inventory"), getBranchInventory);
// /valuation backs the Inventory Valuation tab on the Reports page, not
// the Inventory page itself - view_reports, not manage_inventory.
router.get("/valuation", requirePermission("view_reports"), getValuation);
router.get("/transactions", requirePermission("manage_inventory"), getTransactions);
router.get("/dashboard", requirePermission("manage_inventory"), getDashboard);
router.post("/opening-stock", requirePermission("manage_inventory"), recordOpeningStock);
router.post("/wastage", requirePermission("manage_inventory"), recordWastage);
router.post("/adjustment", requirePermission("manage_inventory"), recordAdjustment);

export default router;
