import express from "express";
import { getAllTenants, createTenant } from "../controllers/TenantController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("platform_admin"));

router.get("/", getAllTenants);
router.post("/", createTenant);

export default router;
