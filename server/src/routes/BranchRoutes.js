import express from "express";
import {
    getActiveBranches,
    getAllBranches,
    getBranchById,
    createBranch,
    updateBranch,
    deactivateBranch
} from "../controllers/BranchController.js";
import { authenticate, authorize, requireOwner, requireFeatureEnabled } from "../middleware/Auth.js";

const router = express.Router();

// /active and the admin reads stay open regardless of the manage_branches
// tenant toggle - every other page (Orders, Menu, Inventory, ...) still
// needs to resolve/list branches even for a tenant that's hidden the
// Branches MANAGEMENT screen. Only the mutations are gated.
router.get("/active", getActiveBranches);

router.get("/", authenticate, authorize("admin"), getAllBranches);
router.get("/:id", authenticate, authorize("admin"), getBranchById);
router.post("/", authenticate, requireFeatureEnabled("manage_branches"), requireOwner, createBranch);
router.put("/:id", authenticate, requireFeatureEnabled("manage_branches"), requireOwner, updateBranch);
router.delete("/:id", authenticate, requireFeatureEnabled("manage_branches"), requireOwner, deactivateBranch);

export default router;
