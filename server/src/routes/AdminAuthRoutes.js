import express from "express";
import { login } from "../controllers/AdminAuthController.js";
import { authRateLimiter } from "../middleware/RateLimit.js";

const router = express.Router();

router.post("/login", authRateLimiter, login);

export default router;
