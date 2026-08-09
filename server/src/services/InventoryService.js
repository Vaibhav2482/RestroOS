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

// FRS B7 - automatic consumption. Called from OrderRepository.updateOrderStatus's
// onValidated hook, inside the SAME transaction and row lock as the status
// write, so a duplicate/retried status request can never consume twice -
// hasTransactionForReference is checked first, under that same lock.
// Ingredients and branch here are already-trusted internal data (a
// MenuItemRecipes row only ever references the tenant's own ingredients,
// enforced when the recipe was saved), so this skips the cross-tenant
// checks the user-facing InventoryService functions above do. Negative
// stock is allowed, never blocked (Step 3 decision) - the resulting
// negative CurrentQuantityBase is exactly what the dashboard's
// out-of-stock count already surfaces, so no separate "flag" column exists.
export const consumeForOrder = async (client, orderId, branchId) => {

    const alreadyConsumed = await InventoryRepository.hasTransactionForReference(client, "ORDER", orderId, "CONSUMPTION");

    if (alreadyConsumed.length > 0) {
        return;
    }

    const branchResult = await client.query(`SELECT "TenantId" FROM "Branches" WHERE "BranchId" = $1`, [branchId]);
    const tenantId = branchResult.rows[0]?.TenantId;

    if (!tenantId) {
        return;
    }

    const linesResult = await client.query(
        `SELECT R."IngredientId", R."Quantity" AS "RecipeQuantity", R."Unit" AS "RecipeUnit",
                OI."Quantity" AS "OrderQuantity", I."BaseUnit"
         FROM "OrderItems" OI
         INNER JOIN "MenuItemRecipes" R ON R."MenuItemId" = OI."MenuItemId"
         INNER JOIN "Ingredients" I ON I."IngredientId" = R."IngredientId"
         WHERE OI."OrderId" = $1`,
        [orderId]
    );

    // Items with no recipe attached yet simply don't join above - onboarding
    // recipes gradually across a menu must not block orders for items that
    // don't have one configured.
    const neededByIngredient = new Map();

    for (const line of linesResult.rows) {

        const conversion = await convertToIngredientBase(
            line.RecipeUnit, Number(line.RecipeQuantity) * Number(line.OrderQuantity), line.BaseUnit
        );

        if (conversion.error) {
            continue;
        }

        const existing = neededByIngredient.get(line.IngredientId) || { quantityBase: 0, baseUnit: line.BaseUnit };
        existing.quantityBase += conversion.quantityBase;
        neededByIngredient.set(line.IngredientId, existing);

    }

    for (const [ingredientId, { quantityBase, baseUnit }] of neededByIngredient) {

        const priorBalance = await InventoryRepository.getIngredientBalance(client, branchId, ingredientId);
        const consumedBase = -quantityBase;

        await InventoryRepository.recordTransaction(client, {
            tenantId,
            branchId,
            ingredientId,
            transactionType: "CONSUMPTION",
            quantityBase: consumedBase,
            enteredUnit: baseUnit,
            enteredQuantity: quantityBase,
            priorQuantityBase: priorBalance,
            postQuantityBase: priorBalance + consumedBase,
            referenceType: "ORDER",
            referenceId: orderId,
            actorType: "System"
        });

    }

};

// FRS B8 - if consumption already happened (order reached Preparing before
// being cancelled), credit every consumed ingredient back via an explicit
// REVERSAL row that references the original CONSUMPTION transaction - the
// original row is never edited or deleted (insert-only ledger, FRS B4).
// A no-op if consumption never happened (order was cancelled from Pending
// or Accepted, before the kitchen started). Also called under the same row
// lock as the cancel itself, from OrderRepository.cancelOrder's
// onValidated hook, so it can't double-reverse a duplicate/retried cancel.
export const reverseConsumptionForOrder = async (client, orderId, branchId) => {

    const alreadyReversed = await InventoryRepository.hasTransactionForReference(client, "ORDER", orderId, "REVERSAL");

    if (alreadyReversed.length > 0) {
        return;
    }

    const consumptionResult = await client.query(
        `SELECT * FROM "InventoryTransactions" WHERE "ReferenceType" = 'ORDER' AND "ReferenceId" = $1 AND "TransactionType" = 'CONSUMPTION'`,
        [orderId]
    );

    for (const consumption of consumptionResult.rows) {

        const priorBalance = await InventoryRepository.getIngredientBalance(client, branchId, consumption.IngredientId);
        const creditBase = Math.abs(Number(consumption.QuantityBase));

        await InventoryRepository.recordTransaction(client, {
            tenantId: consumption.TenantId,
            branchId,
            ingredientId: consumption.IngredientId,
            transactionType: "REVERSAL",
            quantityBase: creditBase,
            enteredUnit: consumption.EnteredUnit,
            enteredQuantity: consumption.EnteredQuantity,
            priorQuantityBase: priorBalance,
            postQuantityBase: priorBalance + creditBase,
            referenceType: "ORDER",
            referenceId: orderId,
            reversalOfTransactionId: consumption.TransactionId,
            actorType: "System"
        });

    }

};

export const getBranchInventory = async (branchId, tenantId) => {

    if (!(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const inventory = await InventoryRepository.getBranchInventory(branchId);

    return { success: true, message: "Branch inventory fetched successfully.", data: inventory };

};

export const getValuation = async (branchId, tenantId) => {

    if (!(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const rows = await InventoryRepository.getValuation(branchId);

    const items = rows.map((row) => ({
        ...row,
        StockValue: row.CostPerBaseUnit === null ? null : Number(row.StockValue)
    }));

    const totalValue = items.reduce((sum, row) => sum + (row.StockValue ?? 0), 0);
    const ingredientsMissingCost = items.filter((row) => row.CostPerBaseUnit === null).length;

    // Surfaced rather than swallowed: these are the ingredients whose recorded
    // stock has gone below zero, so the total above understates nothing but is
    // built on balances that need a physical count to be trustworthy.
    const ingredientsBelowZero = items.filter((row) => Number(row.CurrentQuantityBase) < 0).length;

    return {
        success: true,
        message: "Inventory valuation fetched successfully.",
        data: { items, totalValue, ingredientsMissingCost, ingredientsBelowZero }
    };

};

export const getTransactions = async (branchId, tenantId, filters) => {

    if (!(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const { rows, totalCount } = await InventoryRepository.getTransactions(branchId, filters);

    return { success: true, message: "Transactions fetched successfully.", data: { transactions: rows, totalCount } };

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
