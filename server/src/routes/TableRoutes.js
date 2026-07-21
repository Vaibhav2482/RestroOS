import express from "express";
import {
    getActiveTables,
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deactivateTable
} from "../controllers/TableController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/active", getActiveTables);
router.get("/", getAllTables);
router.get("/:id", getTableById);
router.post("/", createTable);
router.put("/:id", updateTable);
router.delete("/:id", deactivateTable);

export default router;
