import express from "express";
import { register, login } from "../controllers/CustomerAuthController.js";
import { authRateLimiter, loginRateLimiter } from "../middleware/RateLimit.js";

const router = express.Router();

// register keeps the limiter: it throttles mass account creation, and it
// cannot lock an existing customer out of their own account.
router.post("/register", authRateLimiter, register);

// skipSuccessfulRequests means only failed attempts count, so this can't
// lock a customer out of their own account the way the old limiter did -
// see middleware/RateLimit.js.
router.post("/login", loginRateLimiter, login);

export default router;
