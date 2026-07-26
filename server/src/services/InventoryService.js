import pool from "../config/db.js";
import * as InventoryRepository from "../repositories/InventoryRepository.js";
import * as IngredientRepository from "../repositories/IngredientRepository.js";
import * as UnitRepository from "../repositories/UnitRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

// Cross-tenant/cross-branch reference checks (Security Requirements) -
// every write in this service validates both of these before touching the
// ledger, the same "prove it belongs to the caller's own tenant" pattern
// every other module in this codebase uses.
const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};

const assertIngredientBelongsToTenant = async (ingredientId, tenantId) => {

    const ingredient = await IngredientRepository.getIngredientById(ingredientId);

    return ingredient && ingredient.TenantId === tenantId ? ingredient : null;

};

// Converts an entered quantity+unit into the ingredient's own base unit.
// Only ever converts within one UnitType (kg/g are both Weight; a
// Weight-unit entry against a Volume-based ingredient is rejected, not
// silently misinterpreted) - this is what makes a kg-to-litre conversion
// structurally impossible rather than merely discouraged (FRS B2).
const convertToIngredientBase = async (unitCode, quantity, ingredientBaseUnit) => {

    const enteredUnit = await UnitRepository.getUnit(unitCode);
    const baseUnit = await UnitRepository.getUnit(ingredientBaseUnit);

    if (!enteredUnit) {
        return { error: `Unknown unit "${unitCode}".` };
    }

    if (!baseUnit) {
        return { error: `Unknown base unit "${ingredientBaseUnit}" on this ingredient.` };
    }

    if (enteredUnit.UnitType !== baseUnit.UnitType) {
        return { error: `Cannot enter a ${enteredUnit.UnitType.toLowerCase()} quantity for an ingredient measured in ${baseUnit.UnitType.toLowerCase()}.` };
    }

    // Both units convert to the same BaseUnitCode within their UnitType
    // (e.g. kg and g both convert to g) - dividing by the ingredient's own
    // base unit's factor (always 1, since it IS the base) just normalizes
    // cleanly even if that weren't the case.
    const quantityInTypeBase = Number(quantity) * Number(enteredUnit.ToBaseFactor);
    const quantityBase = quantityInTypeBase / Number(baseUnit.ToBaseFactor);

    return { quantityBase };

};

export const getBranchInventory = async (branchId, tenantId) => {

    if (!(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const inventory = await InventoryRepository.getBranchInventory(branchId);

    return { success: true, message: "Branch inventory fetched successfully.", data: inventory };

};

export const getTransactions = async (branchId, tenantId, filters) => {

    if (!(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const transactions = await InventoryRepository.getTransactions(branchId, filters);

    return { success: true, message: "Transactions fetched successfully.", data: transactions };

};

export const getDashboard = async (branchId, tenantId) => {

    if (!(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const summary = await InventoryRepository.getDashboardSummary(branchId);

    return { success: true, message: "Dashboard fetched successfully.", data: summary };

};

export const recordOpeningStock = async (input, tenantId, actorAdminId) => {

    if (!(await assertBranchBelongsToTenant(input.branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const ingredient = await assertIngredientBelongsToTenant(input.ingredientId, tenantId);

    if (!ingredient) {
        return { success: false, message: "Ingredient not found." };
    }

    if (!input.quantity || input.quantity <= 0) {
        return { success: false, message: "Quantity must be greater than 0." };
    }

    const conversion = await convertToIngredientBase(input.unit, input.quantity, ingredient.BaseUnit);

    if (conversion.error) {
        return { success: false, message: conversion.error };
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const priorBalance = await InventoryRepository.getIngredientBalance(client, input.branchId, input.ingredientId);

        const transaction = await InventoryRepository.recordTransaction(client, {
            tenantId,
            branchId: input.branchId,
            ingredientId: input.ingredientId,
            transactionType: "OPENING_STOCK",
            quantityBase: conversion.quantityBase,
            enteredUnit: input.unit,
            enteredQuantity: input.quantity,
            priorQuantityBase: priorBalance,
            postQuantityBase: priorBalance + conversion.quantityBase,
            actorType: "User",
            actorAdminId,
            notes: input.notes
        });

        await client.query("COMMIT");

        return { success: true, message: "Opening stock recorded.", data: transaction };

    } catch (error) {

        await client.query("ROLLBACK");
        return { success: false, message: error.message };

    } finally {

        client.release();

    }

};

export const recordWastage = async (input, tenantId, actorAdminId) => {

    if (!(await assertBranchBelongsToTenant(input.branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const ingredient = await assertIngredientBelongsToTenant(input.ingredientId, tenantId);

    if (!ingredient) {
        return { success: false, message: "Ingredient not found." };
    }

    if (!input.quantity || input.quantity <= 0) {
        return { success: false, message: "Quantity must be greater than 0." };
    }

    if (!input.reason) {
        return { success: false, message: "A reason is required for wastage." };
    }

    const conversion = await convertToIngredientBase(input.unit, input.quantity, ingredient.BaseUnit);

    if (conversion.error) {
        return { success: false, message: conversion.error };
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const priorBalance = await InventoryRepository.getIngredientBalance(client, input.branchId, input.ingredientId);
        const quantityBase = -Math.abs(conversion.quantityBase);

        const transaction = await InventoryRepository.recordTransaction(client, {
            tenantId,
            branchId: input.branchId,
            ingredientId: input.ingredientId,
            transactionType: "WASTAGE",
            quantityBase,
            enteredUnit: input.unit,
            enteredQuantity: input.quantity,
            priorQuantityBase: priorBalance,
            postQuantityBase: priorBalance + quantityBase,
            actorType: "User",
            actorAdminId,
            reason: input.reason,
            notes: input.notes
        });

        await client.query("COMMIT");

        return { success: true, message: "Wastage recorded.", data: transaction };

    } catch (error) {

        await client.query("ROLLBACK");
        return { success: false, message: error.message };

    } finally {

        client.release();

    }

};

// FRS B11 - staff enters the physical count they just took, not a raw
// quantity to add/subtract; the delta against the system's own current
// balance is computed here and recorded as a single ADJUSTMENT_IN/OUT
// ledger row, never as a direct overwrite of CurrentQuantityBase.
export const recordAdjustment = async (input, tenantId, actorAdminId) => {

    if (!(await assertBranchBelongsToTenant(input.branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const ingredient = await assertIngredientBelongsToTenant(input.ingredientId, tenantId);

    if (!ingredient) {
        return { success: false, message: "Ingredient not found." };
    }

    if (input.physicalQuantity === undefined || input.physicalQuantity === null || input.physicalQuantity < 0) {
        return { success: false, message: "Physical quantity must be 0 or greater." };
    }

    if (!input.reason) {
        return { success: false, message: "A reason is required for a stock adjustment." };
    }

    const conversion = await convertToIngredientBase(input.unit, input.physicalQuantity, ingredient.BaseUnit);

    if (conversion.error) {
        return { success: false, message: conversion.error };
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const priorBalance = await InventoryRepository.getIngredientBalance(client, input.branchId, input.ingredientId);
        const physicalBase = conversion.quantityBase;
        const delta = physicalBase - priorBalance;

        if (delta === 0) {
            await client.query("ROLLBACK");
            return { success: false, message: "Physical quantity matches system stock - no adjustment needed." };
        }

        const transaction = await InventoryRepository.recordTransaction(client, {
            tenantId,
            branchId: input.branchId,
            ingredientId: input.ingredientId,
            transactionType: delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
            quantityBase: delta,
            enteredUnit: ingredient.BaseUnit,
            enteredQuantity: Math.abs(delta),
            priorQuantityBase: priorBalance,
            postQuantityBase: physicalBase,
            actorType: "User",
            actorAdminId,
            reason: input.reason,
            notes: input.notes
        });

        await client.query("COMMIT");

        return { success: true, message: "Stock adjustment recorded.", data: transaction };

    } catch (error) {

        await client.query("ROLLBACK");
        return { success: false, message: error.message };

    } finally {

        client.release();

    }

};
