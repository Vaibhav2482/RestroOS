import express from "express";
import { getAllTenants, createTenant, resetOwnerPassword, suspendTenant, reactivateTenant } from "../controllers/TenantController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("platform_admin"));

router.get("/", getAllTenants);
router.post("/", createTenant);
router.post("/:tenantId/reset-password", resetOwnerPassword);
router.post("/:tenantId/suspend", suspendTenant);
router.post("/:tenantId/reactivate", reactivateTenant);

export default router;
