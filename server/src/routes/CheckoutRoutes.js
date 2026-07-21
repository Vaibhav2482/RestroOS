import express from "express";

import { checkout } from "../controllers/CheckoutController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.post("/", authenticate, authorize("customer"), checkout);

export default router;
