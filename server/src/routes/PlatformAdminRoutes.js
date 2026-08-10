import express from "express";
import { login, bootstrap } from "../controllers/PlatformAdminController.js";
import { authRateLimiter } from "../middleware/RateLimit.js";

const router = express.Router();

// Unthrottled at the owner's explicit request. With the per-account lockout
// also removed, nothing limits repeated password guessing against this
// endpoint - and this is the most privileged account on the platform, with
// cross-tenant access. See the warning at the top of middleware/RateLimit.js.
router.post("/login", login);

// bootstrap keeps the limiter: it only works while zero platform admins
// exist, so throttling it locks nobody out of anything.
router.post("/bootstrap", authRateLimiter, bootstrap);

export default router;
