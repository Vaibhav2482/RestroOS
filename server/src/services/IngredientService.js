import * as IngredientRepository from "../repositories/IngredientRepository.js";

const VALID_UNITS = ["g", "kg", "ml", "l", "pc"];

export const getAllIngredients = async (tenantId) => {

    const ingredients = await IngredientRepository.getAllIngredients(tenantId);

    return { success: true, message: "Ingredients fetched successfully.", data: ingredients };

};

export const getIngredientById = async (ingredientId, tenantId) => {

    const ingredient = await IngredientRepository.getIngredientById(ingredientId);

    if (!ingredient || ingredient.TenantId !== tenantId) {
        return { success: false, message: "Ingredient not found." };
    }

    return { success: true, message: "Ingredient fetched successfully.", data: ingredient };

};

export const createIngredient = async (ingredient, tenantId) => {

    ingredient.name = ingredient.name?.trim();

    if (!ingredient.name) {
        return { success: false, message: "Ingredient name is required." };
    }

    if (!VALID_UNITS.includes(ingredient.baseUnit)) {
        return { success: false, message: "Base unit must be one of g, kg, ml, l, pc." };
    }

    if (ingredient.lowStockThreshold !== undefined && ingredient.lowStockThreshold !== null && ingredient.lowStockThreshold < 0) {
        return { success: false, message: "Low stock threshold cannot be negative." };
    }

    const existing = await IngredientRepository.checkIngredientExists(tenantId, ingredient.name);

    if (existing.length > 0) {
        return { success: false, message: "An ingredient with this name already exists." };
    }

    const created = await IngredientRepository.createIngredient({ ...ingredient, tenantId });

    return { success: true, message: "Ingredient created successfully.", data: created };

};

export const updateIngredient = async (ingredientId, ingredient, tenantId) => {

    ingredient.ingredientId = Number(ingredientId);
    ingredient.name = ingredient.name?.trim();

    if (!ingredient.name) {
        return { success: false, message: "Ingredient name is required." };
    }

    if (!VALID_UNITS.includes(ingredient.baseUnit)) {
        return { success: false, message: "Base unit must be one of g, kg, ml, l, pc." };
    }

    const existingIngredient = await IngredientRepository.getIngredientById(ingredientId);

    if (!existingIngredient || existingIngredient.TenantId !== tenantId) {
        return { success: false, message: "Ingredient not found." };
    }

    // Changing the base unit after ledger transactions exist would corrupt
    // every historical QuantityBase they carry - not allowed.
    if (existingIngredient.BaseUnit !== ingredient.baseUnit) {
        return { success: false, message: "Base unit cannot be changed once an ingredient has been created." };
    }

    const duplicate = await IngredientRepository.checkIngredientExistsForUpdate(tenantId, ingredientId, ingredient.name);

    if (duplicate.length > 0) {
        return { success: false, message: "An ingredient with this name already exists." };
    }

    if (ingredient.isActive === undefined) {
        ingredient.isActive = true;
    }

    const updated = await IngredientRepository.updateIngredient(ingredient);

    return { success: true, message: "Ingredient updated successfully.", data: updated };

};
