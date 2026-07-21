import express from "express";
import { getCustomerById, updateCustomer, getAllCustomers } from "../controllers/CustomerController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getAllCustomers);
router.get("/:id", authenticate, getCustomerById);
router.put("/:id", authenticate, updateCustomer);

export default router;
