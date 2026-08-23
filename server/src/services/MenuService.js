import * as MenuRepository from "../repositories/MenuRepository.js";
import * as CategoryRepository from "../repositories/CategoryRepository.js";
import * as AuditService from "./AuditService.js";
import { assertBranchBelongsToTenant } from "../utils/branchScope.js";

// MenuItems has no TenantId column of its own - its tenant is implied
// through the Branch it belongs to. Every write path below verifies that
// implied tenant matches the caller before touching a row, which is what
// stops a tenant admin from writing menu items onto another restaurant's
// branch by guessing/enumerating a branchId.

// Same boundary, for CategoryId - without this a menu item can be filed
// under another tenant's category by guessing/enumerating a categoryId.
const assertCategoryBelongsToTenant = async (categoryId, tenantId) => {

    const category = await CategoryRepository.getCategoryById(categoryId);

    return Boolean(category && category.TenantId === tenantId);

};

export const getAllMenuItems = async (branchId, tenantId) => {

    if (!branchId) {
        return { success: false, message: "Branch Id is required." };
    }

    if (tenantId !== undefined && !(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const menuItems = await MenuRepository.getAllMenuItems(branchId);

    return { success: true, message: "Menu items fetched successfully.", data: menuItems };

};

export const getMenuItemById = async (menuItemId) => {

    const menuItem = await MenuRepository.getMenuItemById(menuItemId);

    if (menuItem.length === 0) {
        return { success: false, message: "Menu item not found." };
    }

    return { success: true, message: "Menu item fetched successfully.", data: menuItem[0] };

};

export const getRecommendations = async (menuItemId) => {

    const menuItem = await MenuRepository.getMenuItemById(menuItemId);

    if (menuItem.length === 0) {
        return { success: false, message: "Menu item not found." };
    }

    const recommendations = await MenuRepository.getRecommendations(
        menuItemId, menuItem[0].BranchId, menuItem[0].CategoryId
    );

    return { success: true, message: "Recommendations fetched successfully.", data: recommendations };

};

export const createMenuItem = async (menuItem, tenantId, actorAdminId) => {

    menuItem.itemName = menuItem.itemName?.trim();
    menuItem.description = menuItem.description?.trim();

    if (!menuItem.branchId) {
        return { success: false, message: "Branch is required." };
    }

    if (!(await assertBranchBelongsToTenant(menuItem.branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    if (!menuItem.categoryId) {
        return { success: false, message: "Category is required." };
    }

    if (!(await assertCategoryBelongsToTenant(menuItem.categoryId, tenantId))) {
        return { success: false, message: "Category not found." };
    }

    if (!menuItem.itemName) {
        return { success: false, message: "Item Name is required." };
    }

    if (!menuItem.price || menuItem.price <= 0) {
        return { success: false, message: "Price must be greater than 0." };
    }

    if (menuItem.taxRatePercent === undefined || menuItem.taxRatePercent === null || menuItem.taxRatePercent === "") {
        // 5% (2.5 CGST + 2.5 SGST) is the rate every item was taxed at
        // before this field existed - new items default to the same
        // baseline rather than silently landing at 0% until someone thinks
        // to set it.
        menuItem.taxRatePercent = 5;
    } else if (menuItem.taxRatePercent < 0 || menuItem.taxRatePercent > 100) {
        return { success: false, message: "Tax rate must be between 0 and 100." };
    }

    const duplicate = await MenuRepository.checkMenuItemExists(menuItem.itemName, menuItem.branchId);

    if (duplicate.length > 0) {
        return { success: false, message: "Menu item already exists for this branch." };
    }

    if (menuItem.isAvailable === undefined) {
        menuItem.isAvailable = true;
    }

    if (menuItem.isPopular === undefined) {
        menuItem.isPopular = false;
    }

    if (menuItem.isActive === undefined) {
        menuItem.isActive = true;
    }

    const result = await MenuRepository.createMenuItem(menuItem);

    // createMenuItem only RETURNING's MenuItemId (see MenuRepository), not
    // the full row - the name/price actually being recorded are read back
    // from the already-validated input instead of the create result.
    AuditService.record({
        tenantId,
        actorAdminId,
        action: "MENU_ITEM_CREATED",
        entityType: "MenuItem",
        entityId: result.MenuItemId,
        summary: `Created menu item "${menuItem.itemName}" at ₹${Number(menuItem.price).toFixed(2)}`
    });

    return { success: true, message: "Menu item created successfully.", data: result };

};

export const updateMenuItem = async (menuItemId, menuItem, tenantId, actorAdminId) => {

    const existingMenuItem = await MenuRepository.getMenuItemById(menuItemId);

    if (existingMenuItem.length === 0) {
        return { success: false, message: "Menu item not found." };
    }

    menuItem.itemName = menuItem.itemName?.trim();
    menuItem.description = menuItem.description?.trim();

    if (!menuItem.categoryId) {
        return { success: false, message: "Category is required." };
    }

    if (!(await assertCategoryBelongsToTenant(menuItem.categoryId, tenantId))) {
        return { success: false, message: "Category not found." };
    }

    if (!menuItem.itemName) {
        return { success: false, message: "Item Name is required." };
    }

    if (!menuItem.price || menuItem.price <= 0) {
        return { success: false, message: "Price must be greater than 0." };
    }

    if (menuItem.taxRatePercent === undefined || menuItem.taxRatePercent === null || menuItem.taxRatePercent === "") {
        menuItem.taxRatePercent = existingMenuItem[0].TaxRatePercent;
    } else if (menuItem.taxRatePercent < 0 || menuItem.taxRatePercent > 100) {
        return { success: false, message: "Tax rate must be between 0 and 100." };
    }

    // A menu item's branch is fixed at creation time; duplicate-name checks stay scoped to it.
    const branchId = existingMenuItem[0].BranchId;

    const duplicateMenuItem = await MenuRepository.getMenuItemByName(menuItem.itemName, branchId);

    if (duplicateMenuItem && duplicateMenuItem.MenuItemId !== Number(menuItemId)) {
        return { success: false, message: "Menu item already exists for this branch." };
    }

    if (menuItem.isAvailable === undefined) {
        menuItem.isAvailable = existingMenuItem[0].IsAvailable;
    }

    if (menuItem.isPopular === undefined) {
        menuItem.isPopular = existingMenuItem[0].IsPopular;
    }

    if (menuItem.isActive === undefined) {
        menuItem.isActive = existingMenuItem[0].IsActive;
    }

    menuItem.menuItemId = Number(menuItemId);

    const updatedMenuItem = await MenuRepository.updateMenuItem(menuItem, tenantId);

    // Only reachable if a future caller skips the controller's own tenant
    // check - the repository's WHERE clause is the real defense-in-depth,
    // this just turns "0 rows updated" into the same not-found response
    // every other failure path here uses, instead of a crash below.
    if (!updatedMenuItem) {
        return { success: false, message: "Menu item not found." };
    }

    // Price and availability are the two changes on a menu item with real
    // financial/operational consequences - called out by name in the audit
    // summary rather than folded into a generic "item updated" line, even
    // though every field change is captured (this same call fires on any
    // update, not just these two).
    const changeNotes = [];

    if (Number(existingMenuItem[0].Price) !== Number(updatedMenuItem.Price)) {
        changeNotes.push(`price changed from ₹${Number(existingMenuItem[0].Price).toFixed(2)} to ₹${Number(updatedMenuItem.Price).toFixed(2)}`);
    }

    if (Boolean(existingMenuItem[0].IsAvailable) !== Boolean(updatedMenuItem.IsAvailable)) {
        changeNotes.push(updatedMenuItem.IsAvailable ? "marked available" : "marked out of stock");
    }

    if (Number(existingMenuItem[0].TaxRatePercent) !== Number(updatedMenuItem.TaxRatePercent)) {
        changeNotes.push(`tax rate changed from ${Number(existingMenuItem[0].TaxRatePercent)}% to ${Number(updatedMenuItem.TaxRatePercent)}%`);
    }

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "MENU_ITEM_UPDATED",
        entityType: "MenuItem",
        entityId: updatedMenuItem.MenuItemId,
        summary: `Updated menu item "${updatedMenuItem.ItemName}"${changeNotes.length ? ` (${changeNotes.join(", ")})` : ""}`
    });

    return { success: true, message: "Menu item updated successfully.", data: updatedMenuItem };

};

export const deleteMenuItem = async (menuItemId, tenantId, actorAdminId) => {

    const existingMenuItem = await MenuRepository.getMenuItemById(menuItemId);

    if (existingMenuItem.length === 0) {
        return { success: false, message: "Menu item not found." };
    }

    await MenuRepository.deleteMenuItem(menuItemId, tenantId);

    // A hard delete, not a soft deactivate - the one MenuItems write path
    // that actually destroys a row, so this is the audit entry that
    // matters most if a price dispute or "where did this item go" question
    // ever comes up later.
    AuditService.record({
        tenantId,
        actorAdminId,
        action: "MENU_ITEM_DELETED",
        entityType: "MenuItem",
        entityId: Number(menuItemId),
        summary: `Deleted menu item "${existingMenuItem[0].ItemName}" (was ₹${Number(existingMenuItem[0].Price).toFixed(2)})`
    });

    return { success: true, message: "Menu item deleted successfully." };

};
