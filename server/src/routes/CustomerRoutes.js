import express from "express";
import {
    getCustomerById,
    updateCustomer,
    changePassword,
    getAllCustomers,
    getOrCreateGuestCustomer,
    findOrCreateWalkInCustomer
} from "../controllers/CustomerController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), requirePermission("view_customers"), getAllCustomers);

// Must come before "/:id" - otherwise Express would match "walk-in"/"guest" as an :id value.
router.post("/walk-in", authenticate, authorize("admin"), findOrCreateWalkInCustomer);
router.post("/guest", authenticate, authorize("admin"), getOrCreateGuestCustomer);

router.get("/:id", authenticate, getCustomerById);
router.put("/:id", authenticate, updateCustomer);
router.put("/:id/password", authenticate, changePassword);

export default router;
