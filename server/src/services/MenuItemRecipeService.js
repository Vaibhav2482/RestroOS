import * as MenuItemRecipeRepository from "../repositories/MenuItemRecipeRepository.js";
import * as MenuOptionRepository from "../repositories/MenuOptionRepository.js";
import * as IngredientRepository from "../repositories/IngredientRepository.js";
import { branchMismatch } from "../utils/branchScope.js";

// Reuses MenuOptionRepository.getMenuItemTenantId - it already resolves a
// MenuItemId back to {BranchId, TenantId} via the Branches join, exactly
// what's needed here too. Same tenant+branch check every other menu-item
// write in this codebase does (Security Requirements: validate every
// referenced menu item belongs to the correct tenant).
const assertMenuItemAccess = async (menuItemId, req) => {

    const menuItem = await MenuOptionRepository.getMenuItemTenantId(menuItemId);

    if (!menuItem || menuItem.TenantId !== req.user.tenantId || branchMismatch(req, menuItem.BranchId)) {
        return false;
    }

    return true;

};

export const getRecipeForMenuItem = async (menuItemId, req) => {

    if (!(await assertMenuItemAccess(menuItemId, req))) {
        return { success: false, message: "Menu item not found." };
    }

    const recipe = await MenuItemRecipeRepository.getRecipeForMenuItem(menuItemId);

    return { success: true, message: "Recipe fetched successfully.", data: recipe };

};

export const replaceRecipe = async (menuItemId, lines, req) => {

    if (!(await assertMenuItemAccess(menuItemId, req))) {
        return { success: false, message: "Menu item not found." };
    }

    if (!Array.isArray(lines)) {
        return { success: false, message: "Recipe lines must be an array." };
    }

    for (const line of lines) {

        if (!line.ingredientId || !line.quantity || line.quantity <= 0 || !line.unit) {
            return { success: false, message: "Each recipe line needs an ingredient, a quantity greater than 0, and a unit." };
        }

        const ingredient = await IngredientRepository.getIngredientById(line.ingredientId);

        if (!ingredient || ingredient.TenantId !== req.user.tenantId) {
            return { success: false, message: "One of the recipe's ingredients was not found." };
        }

    }

    const recipe = await MenuItemRecipeRepository.replaceRecipe(menuItemId, lines);

    return { success: true, message: "Recipe saved successfully.", data: recipe };

};
