import express from "express";

import {
    getGroupsForMenuItem,
    createGroup,
    updateGroup,
    deleteGroup,
    createOption,
    updateOption,
    deleteOption
} from "../controllers/MenuOptionController.js";
import { authenticate, authorize, requirePermission } from "../middleware/Auth.js";

const router = express.Router();

// Public - a storefront customer needs to see an item's option groups
// before adding it to their cart, same as menu browsing itself.
router.get("/menu-item/:menuItemId", getGroupsForMenuItem);

router.post("/groups", authenticate, authorize("admin"), requirePermission("manage_menu"), createGroup);
router.put("/groups/:id", authenticate, authorize("admin"), requirePermission("manage_menu"), updateGroup);
router.delete("/groups/:id", authenticate, authorize("admin"), requirePermission("manage_menu"), deleteGroup);

router.post("/groups/:groupId/options", authenticate, authorize("admin"), requirePermission("manage_menu"), createOption);
router.put("/options/:id", authenticate, authorize("admin"), requirePermission("manage_menu"), updateOption);
router.delete("/options/:id", authenticate, authorize("admin"), requirePermission("manage_menu"), deleteOption);

export default router;
