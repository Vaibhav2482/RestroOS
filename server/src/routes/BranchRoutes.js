import express from "express";
import {
    getActiveBranches,
    getAllBranches,
    getBranchById,
    createBranch,
    updateBranch,
    deactivateBranch
} from "../controllers/BranchController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.get("/active", getActiveBranches);

router.get("/", authenticate, authorize("admin"), getAllBranches);
router.get("/:id", authenticate, authorize("admin"), getBranchById);
router.post("/", authenticate, requireOwner, createBranch);
router.put("/:id", authenticate, requireOwner, updateBranch);
router.delete("/:id", authenticate, requireOwner, deactivateBranch);

export default router;
