import express from "express";
import { getPublicTenant, getOwnTenant, updateBranding } from "../controllers/PublicTenantController.js";
import { authenticate, authorize, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.get("/public", getPublicTenant);
router.get("/me", authenticate, authorize("admin"), getOwnTenant);
router.put("/me/branding", authenticate, requireOwner, updateBranding);

export default router;
