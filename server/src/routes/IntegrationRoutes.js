import express from "express";
import { getIntegrations } from "../controllers/IntegrationController.js";
import { authenticate, requireOwner } from "../middleware/Auth.js";

const router = express.Router();

router.get("/", authenticate, requireOwner, getIntegrations);

export default router;
