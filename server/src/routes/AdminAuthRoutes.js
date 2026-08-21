import express from "express";
import { login } from "../controllers/AdminAuthController.js";
import { loginRateLimiter } from "../middleware/RateLimit.js";

const router = express.Router();

// skipSuccessfulRequests means only failed attempts count, so this can't
// lock the owner out of their own panel the way the old limiter did - see
// middleware/RateLimit.js.
router.post("/login", loginRateLimiter, login);

export default router;
