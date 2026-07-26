import { describe, it, expect, vi, beforeEach } from "vitest";

import * as MenuItemRecipeService from "./MenuItemRecipeService.js";
import * as MenuItemRecipeRepository from "../repositories/MenuItemRecipeRepository.js";
import * as MenuOptionRepository from "../repositories/MenuOptionRepository.js";
import * as IngredientRepository from "../repositories/IngredientRepository.js";

vi.mock("../repositories/MenuItemRecipeRepository.js");
vi.mock("../repositories/MenuOptionRepository.js");
vi.mock("../repositories/IngredientRepository.js");

const TENANT_ID = 9;
const BRANCH_ID = 1;
const MENU_ITEM_ID = 100;
const INGREDIENT_ID = 2;

const req = (overrides = {}) => ({ user: { tenantId: TENANT_ID, role: "admin", ...overrides } });

beforeEach(() => {

    vi.clearAllMocks();

    MenuOptionRepository.getMenuItemTenantId.mockResolvedValue({ BranchId: BRANCH_ID, TenantId: TENANT_ID });
    IngredientRepository.getIngredientById.mockResolvedValue({ IngredientId: INGREDIENT_ID, TenantId: TENANT_ID });
    MenuItemRecipeRepository.replaceRecipe.mockResolvedValue([]);

});

describe("MenuItemRecipeService - cross-tenant rejection", () => {

    it("rejects a menu item belonging to another tenant", async () => {

        MenuOptionRepository.getMenuItemTenantId.mockResolvedValue({ BranchId: BRANCH_ID, TenantId: 999 });

        const result = await MenuItemRecipeService.getRecipeForMenuItem(MENU_ITEM_ID, req());

        expect(result.success).toBe(false);
        expect(MenuItemRecipeRepository.getRecipeForMenuItem).not.toHaveBeenCalled();

    });

    it("rejects a menu item outside a branch-scoped admin's own branch", async () => {

        MenuOptionRepository.getMenuItemTenantId.mockResolvedValue({ BranchId: 2, TenantId: TENANT_ID });

        const result = await MenuItemRecipeService.getRecipeForMenuItem(MENU_ITEM_ID, req({ branchId: BRANCH_ID }));

        expect(result.success).toBe(false);

    });

    it("rejects a recipe line referencing an ingredient from another tenant", async () => {

        IngredientRepository.getIngredientById.mockResolvedValue({ IngredientId: INGREDIENT_ID, TenantId: 999 });

        const result = await MenuItemRecipeService.replaceRecipe(
            MENU_ITEM_ID, [{ ingredientId: INGREDIENT_ID, quantity: 1, unit: "g" }], req()
        );

        expect(result.success).toBe(false);
        expect(MenuItemRecipeRepository.replaceRecipe).not.toHaveBeenCalled();

    });

});

describe("MenuItemRecipeService - line validation", () => {

    it("rejects a line with a zero or negative quantity", async () => {

        const result = await MenuItemRecipeService.replaceRecipe(
            MENU_ITEM_ID, [{ ingredientId: INGREDIENT_ID, quantity: 0, unit: "g" }], req()
        );

        expect(result.success).toBe(false);
        expect(MenuItemRecipeRepository.replaceRecipe).not.toHaveBeenCalled();

    });

    it("saves a valid recipe", async () => {

        const result = await MenuItemRecipeService.replaceRecipe(
            MENU_ITEM_ID, [{ ingredientId: INGREDIENT_ID, quantity: 0.5, unit: "kg" }], req()
        );

        expect(result.success).toBe(true);
        expect(MenuItemRecipeRepository.replaceRecipe).toHaveBeenCalledWith(
            MENU_ITEM_ID, [{ ingredientId: INGREDIENT_ID, quantity: 0.5, unit: "kg" }]
        );

    });

});
