import express from "express";
import { login, bootstrap, changePassword } from "../controllers/PlatformAdminController.js";
import { authRateLimiter, loginRateLimiter } from "../middleware/RateLimit.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

// skipSuccessfulRequests means only failed attempts count, so this can't
// lock the platform admin out of their own account the way the old limiter
// did - see middleware/RateLimit.js. This is the most privileged account on
// the platform, with cross-tenant access, so it gets the same protection as
// the other two login routes.
router.post("/login", loginRateLimiter, login);

// bootstrap keeps the limiter: it only works while zero platform admins
// exist, so throttling it locks nobody out of anything.
router.post("/bootstrap", authRateLimiter, bootstrap);

// The only in-app way to rotate this account's password - before this route
// existed, the only paths were a fresh bootstrap (blocked once any platform
// admin exists) or a direct database edit.
router.put("/me/password", authenticate, authorize("platform_admin"), changePassword);

export default router;
