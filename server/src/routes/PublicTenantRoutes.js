import express from "express";
import { getPublicTenant, getOwnTenant, updateBranding, updateDisabledFeatures } from "../controllers/PublicTenantController.js";
import { authenticate, authorize, requireOwner, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.get("/public", getPublicTenant);
router.get("/me", authenticate, authorize("admin"), getOwnTenant);
router.put("/me/branding", authenticate, requirePermission("manage_branding"), updateBranding);
// Owner-only, not delegable via any staff permission - turning a whole
// module off for the tenant is a bigger call than day-to-day branding.
router.put("/me/features", authenticate, requireOwner, updateDisabledFeatures);

export default router;
