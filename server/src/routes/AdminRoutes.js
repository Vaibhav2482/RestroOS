import express from "express";

import {
    getAllAdmins,
    getAdminById,
    getOwnProfile,
    updateOwnProfile,
    changeOwnPassword,
    createAdmin,
    updateAdmin,
    deactivateAdmin
} from "../controllers/AdminController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

// /me routes must come before /:id - otherwise Express's :id would match
// the literal string "me" as a param value and these would never be reached.
router.get("/me", getOwnProfile);
router.put("/me", updateOwnProfile);
router.put("/me/password", changeOwnPassword);

router.get("/", getAllAdmins);
router.get("/:id", getAdminById);
router.post("/", requireOwner, createAdmin);
router.put("/:id", requireOwner, updateAdmin);
router.delete("/:id", requireOwner, deactivateAdmin);

export default router;
