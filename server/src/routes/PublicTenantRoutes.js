import express from "express";
import { getPublicTenant } from "../controllers/PublicTenantController.js";

const router = express.Router();

router.get("/public", getPublicTenant);

export default router;
