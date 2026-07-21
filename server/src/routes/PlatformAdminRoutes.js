import express from "express";
import { login, bootstrap } from "../controllers/PlatformAdminController.js";

const router = express.Router();

router.post("/login", login);
router.post("/bootstrap", bootstrap);

export default router;
