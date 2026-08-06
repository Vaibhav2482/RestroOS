import express from "express";
import {
    getActiveTables,
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deactivateTable
} from "../controllers/TableController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

// /active stays open to any admin - POS reads it to seat a Dine In order
// regardless of whether that admin has manage_tables (structural table
// setup), the same way it already reads Menu/Categories/Branches openly.
router.get("/active", getActiveTables);
router.get("/", requirePermission("manage_tables"), getAllTables);
router.get("/:id", requirePermission("manage_tables"), getTableById);
router.post("/", requirePermission("manage_tables"), createTable);
router.put("/:id", requirePermission("manage_tables"), updateTable);
router.delete("/:id", requirePermission("manage_tables"), deactivateTable);

export default router;
