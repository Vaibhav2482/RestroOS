import express from "express";
import { register, login } from "../controllers/CustomerAuthController.js";
import { authRateLimiter } from "../middleware/RateLimit.js";

const router = express.Router();

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);

export default router;
