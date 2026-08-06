import express from "express";
import { getIntegrations } from "../controllers/IntegrationController.js";
import { authenticate, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.get("/", authenticate, requirePermission("manage_integrations"), getIntegrations);

export default router;
