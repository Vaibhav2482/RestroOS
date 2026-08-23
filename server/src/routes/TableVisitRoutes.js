import express from "express";

import { getOpenVisitForTable, getVisitDetails, updateGuestCount, settleVisit } from "../controllers/TableVisitController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

// Staff-only end to end - a table visit/bill is never a customer-facing
// concept the way an individual Order is (storefront customers place
// Delivery/Takeaway orders, not Dine In table sessions).
router.use(authenticate, authorize("admin"), requirePermission("manage_orders"));

router.get("/branch/:branchId/table/:tableNumber", getOpenVisitForTable);
router.get("/:visitId", getVisitDetails);
router.put("/:visitId/guest-count", updateGuestCount);
router.post("/:visitId/settle", settleVisit);

export default router;
