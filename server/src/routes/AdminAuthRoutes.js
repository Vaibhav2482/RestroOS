import express from "express";
import { login } from "../controllers/AdminAuthController.js";

const router = express.Router();

// Unthrottled at the owner's explicit request. With the per-account lockout
// also removed, nothing limits repeated password guessing against this
// endpoint - see the warning at the top of middleware/RateLimit.js.
router.post("/login", login);

export default router;
