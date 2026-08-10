import express from "express";
import { register, login } from "../controllers/CustomerAuthController.js";
import { authRateLimiter } from "../middleware/RateLimit.js";

const router = express.Router();

// register keeps the limiter: it throttles mass account creation, and it
// cannot lock an existing customer out of their own account.
router.post("/register", authRateLimiter, register);

// Unthrottled at the owner's explicit request. With the per-account lockout
// also removed, nothing limits repeated password guessing against this
// endpoint - see the warning at the top of middleware/RateLimit.js.
router.post("/login", login);

export default router;
