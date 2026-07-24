import express from "express";

import { authorizePusherChannel } from "../controllers/RealtimeController.js";
import { authenticate } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/pusher/auth", authorizePusherChannel);

export default router;
