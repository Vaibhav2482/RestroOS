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
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

// Public - a storefront customer needs to see an item's option groups
// before adding it to their cart, same as menu browsing itself.
router.get("/menu-item/:menuItemId", getGroupsForMenuItem);

router.post("/groups", authenticate, authorize("admin"), createGroup);
router.put("/groups/:id", authenticate, authorize("admin"), updateGroup);
router.delete("/groups/:id", authenticate, authorize("admin"), deleteGroup);

router.post("/groups/:groupId/options", authenticate, authorize("admin"), createOption);
router.put("/options/:id", authenticate, authorize("admin"), updateOption);
router.delete("/options/:id", authenticate, authorize("admin"), deleteOption);

export default router;
