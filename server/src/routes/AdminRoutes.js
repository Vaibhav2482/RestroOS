import express from "express";

import {
    getAllAdmins,
    getAdminById,
    createAdmin,
    updateAdmin,
    deactivateAdmin
} from "../controllers/AdminController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/", getAllAdmins);
router.get("/:id", getAdminById);
router.post("/", requireOwner, createAdmin);
router.put("/:id", requireOwner, updateAdmin);
router.delete("/:id", requireOwner, deactivateAdmin);

export default router;
