import express from "express";
import {
    createCustomerAddress,
    getCustomerAddresses,
    updateCustomerAddress,
    deleteCustomerAddress
} from "../controllers/CustomerAddressController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

router.use(authenticate, authorize("customer", "admin"));

router.post("/", createCustomerAddress);
router.get("/:customerId", getCustomerAddresses);
router.put("/:id", updateCustomerAddress);
router.delete("/:id", deleteCustomerAddress);

export default router;
