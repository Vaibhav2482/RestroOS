import * as MenuRepository from "../repositories/MenuRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import * as CategoryRepository from "../repositories/CategoryRepository.js";

// MenuItems has no TenantId column of its own - its tenant is implied
// through the Branch it belongs to. Every write path below verifies that
// implied tenant matches the caller before touching a row, which is what
// stops a tenant admin from writing menu items onto another restaurant's
// branch by guessing/enumerating a branchId.
const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};

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

export const createMenuItem = async (menuItem, tenantId) => {

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

    return { success: true, message: "Menu item created successfully.", data: result };

};

export const updateMenuItem = async (menuItemId, menuItem, tenantId) => {

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

    const updatedMenuItem = await MenuRepository.updateMenuItem(menuItem);

    return { success: true, message: "Menu item updated successfully.", data: updatedMenuItem };

};

export const deleteMenuItem = async (menuItemId) => {

    const existingMenuItem = await MenuRepository.getMenuItemById(menuItemId);

    if (existingMenuItem.length === 0) {
        return { success: false, message: "Menu item not found." };
    }

    await MenuRepository.deleteMenuItem(menuItemId);

    return { success: true, message: "Menu item deleted successfully." };

};
