import express from "express";
import { login, bootstrap } from "../controllers/PlatformAdminController.js";
import { authRateLimiter } from "../middleware/RateLimit.js";

const router = express.Router();

router.post("/login", authRateLimiter, login);
router.post("/bootstrap", authRateLimiter, bootstrap);

export default router;
