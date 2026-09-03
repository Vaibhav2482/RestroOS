import { describe, it, expect, vi, beforeEach } from "vitest";

import * as InventoryService from "./InventoryService.js";
import * as InventoryRepository from "../repositories/InventoryRepository.js";
import * as IngredientRepository from "../repositories/IngredientRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import pool from "../config/db.js";

vi.mock("../repositories/InventoryRepository.js");
vi.mock("../repositories/IngredientRepository.js");
vi.mock("../repositories/BranchRepository.js");
vi.mock("../config/db.js", () => ({ default: { connect: vi.fn() } }));

// Mirrors the real seeded "Units" table (server/src/config/migrations.js) -
// convertToIngredientBase relies on this for every conversion, so the test
// double needs the same conversion factors, not just matching shapes.
vi.mock("../repositories/UnitRepository.js", () => {

    const UNITS = [
        { UnitCode: "g", UnitType: "Weight", BaseUnitCode: "g", ToBaseFactor: 1 },
        { UnitCode: "kg", UnitType: "Weight", BaseUnitCode: "g", ToBaseFactor: 1000 },
        { UnitCode: "ml", UnitType: "Volume", BaseUnitCode: "ml", ToBaseFactor: 1 },
        { UnitCode: "l", UnitType: "Volume", BaseUnitCode: "ml", ToBaseFactor: 1000 },
        { UnitCode: "pc", UnitType: "Count", BaseUnitCode: "pc", ToBaseFactor: 1 }
    ];

    return {
        getUnit: vi.fn(async (unitCode) => UNITS.find((unit) => unit.UnitCode === unitCode)),
        getAllUnits: vi.fn(async () => UNITS)
    };

});

const TENANT_ID = 9;
const BRANCH_ID = 1;
const INGREDIENT_ID = 2;

const branch = { BranchId: BRANCH_ID, TenantId: TENANT_ID };

const gramIngredient = { IngredientId: INGREDIENT_ID, TenantId: TENANT_ID, BaseUnit: "g" };

const createMockClient = () => ({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn()
});

beforeEach(() => {

    vi.clearAllMocks();

    pool.connect.mockImplementation(async () => createMockClient());
    BranchRepository.getBranchById.mockResolvedValue(branch);
    IngredientRepository.getIngredientById.mockResolvedValue(gramIngredient);
    InventoryRepository.getIngredientBalance.mockResolvedValue(0);
    InventoryRepository.recordTransaction.mockImplementation(async (client, transaction) => ({ TransactionId: 1, ...transaction }));

});

describe("InventoryService - cross-tenant/cross-branch rejection", () => {

    it("recordOpeningStock rejects a branch belonging to another tenant", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: BRANCH_ID, TenantId: 999 });

        const result = await InventoryService.recordOpeningStock(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "g", quantity: 10 }, TENANT_ID, 1
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Branch not found.");
        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();

    });

    it("recordOpeningStock rejects an ingredient belonging to another tenant", async () => {

        IngredientRepository.getIngredientById.mockResolvedValue({ ...gramIngredient, TenantId: 999 });

        const result = await InventoryService.recordOpeningStock(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "g", quantity: 10 }, TENANT_ID, 1
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Ingredient not found.");
        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();

    });

});

describe("InventoryService - unit conversion", () => {

    it("converts kg to the ingredient's gram base unit correctly", async () => {

        const kgIngredient = { ...gramIngredient, BaseUnit: "g" };

        IngredientRepository.getIngredientById.mockResolvedValue(kgIngredient);
        InventoryRepository.getIngredientBalance.mockResolvedValue(0);

        await InventoryService.recordOpeningStock(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "kg", quantity: 2 }, TENANT_ID, 1
        );

        expect(InventoryRepository.recordTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ quantityBase: 2000, transactionType: "OPENING_STOCK" })
        );

    });

    it("rejects a Volume unit entered against a Weight-based ingredient", async () => {

        const result = await InventoryService.recordOpeningStock(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "l", quantity: 2 }, TENANT_ID, 1
        );

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/volume.*weight/i);
        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();

    });

});

describe("InventoryService - wastage", () => {

    it("requires a reason", async () => {

        const result = await InventoryService.recordWastage(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "g", quantity: 5 }, TENANT_ID, 1
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("A reason is required for wastage.");
        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();

    });

    it("records a negative quantityBase", async () => {

        InventoryRepository.getIngredientBalance.mockResolvedValue(100);

        await InventoryService.recordWastage(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "g", quantity: 30, reason: "Spoiled" }, TENANT_ID, 1
        );

        expect(InventoryRepository.recordTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ quantityBase: -30, priorQuantityBase: 100, postQuantityBase: 70 })
        );

    });

});

describe("InventoryService - stock adjustment (FRS B11)", () => {

    it("computes a negative delta when the physical count is below system stock", async () => {

        InventoryRepository.getIngredientBalance.mockResolvedValue(100);

        await InventoryService.recordAdjustment(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "g", physicalQuantity: 80, reason: "Recount" }, TENANT_ID, 1
        );

        expect(InventoryRepository.recordTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ transactionType: "ADJUSTMENT_OUT", quantityBase: -20 })
        );

    });

    it("computes a positive delta when the physical count is above system stock", async () => {

        InventoryRepository.getIngredientBalance.mockResolvedValue(50);

        await InventoryService.recordAdjustment(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "g", physicalQuantity: 65, reason: "Recount" }, TENANT_ID, 1
        );

        expect(InventoryRepository.recordTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ transactionType: "ADJUSTMENT_IN", quantityBase: 15 })
        );

    });

    // A count that exactly matches system stock is a valid, correct outcome
    // - staff did the count and everything's fine - not a failure. This
    // used to come back as success: false, which the frontend renders as a
    // red error toast for a physical count that was actually right.
    it("records no transaction, but still reports success, when the physical count matches system stock exactly", async () => {

        InventoryRepository.getIngredientBalance.mockResolvedValue(50);

        const result = await InventoryService.recordAdjustment(
            { branchId: BRANCH_ID, ingredientId: INGREDIENT_ID, unit: "g", physicalQuantity: 50, reason: "Recount" }, TENANT_ID, 1
        );

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/matches system stock/i);
        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();

    });

});

describe("InventoryService - order consumption is exactly-once (FRS B7)", () => {

    it("does nothing if a CONSUMPTION transaction already exists for this order", async () => {

        InventoryRepository.hasTransactionForReference.mockResolvedValue([{ TransactionId: 1 }]);

        const client = createMockClient();

        await InventoryService.consumeForOrder(client, 501, BRANCH_ID);

        expect(InventoryRepository.hasTransactionForReference).toHaveBeenCalledWith(client, "ORDER", 501, "CONSUMPTION");
        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();
        // Only the idempotency check itself should run - no Branches/OrderItems
        // lookups once the guard already says "already done".
        expect(client.query).not.toHaveBeenCalled();

    });

    it("consumes each recipe ingredient once, aggregating quantities across order items", async () => {

        InventoryRepository.hasTransactionForReference.mockResolvedValue([]);

        const client = createMockClient();

        client.query
            .mockResolvedValueOnce({ rows: [{ TenantId: TENANT_ID }] }) // Branches lookup
            .mockResolvedValueOnce({
                rows: [
                    { IngredientId: INGREDIENT_ID, RecipeQuantity: 0.2, RecipeUnit: "kg", OrderQuantity: 3, BaseUnit: "g" }
                ]
            }); // OrderItems + MenuItemRecipes join

        InventoryRepository.getIngredientBalance.mockResolvedValue(1000);

        await InventoryService.consumeForOrder(client, 502, BRANCH_ID);

        expect(InventoryRepository.recordTransaction).toHaveBeenCalledTimes(1);
        expect(InventoryRepository.recordTransaction).toHaveBeenCalledWith(
            client,
            expect.objectContaining({
                transactionType: "CONSUMPTION",
                ingredientId: INGREDIENT_ID,
                // 0.2 * 3 in floating point isn't exactly 0.6 - the real
                // NUMERIC(14,3) column rounds this away on write, so this
                // test only needs to match to 3 decimal places too.
                quantityBase: expect.closeTo(-600, 3),
                referenceType: "ORDER",
                referenceId: 502
            })
        );

    });

});

describe("InventoryService - cancellation reversal is exactly-once (FRS B8)", () => {

    it("does nothing if the order was never consumed (cancelled before Preparing)", async () => {

        InventoryRepository.hasTransactionForReference.mockResolvedValue([]);

        const client = createMockClient();
        client.query.mockResolvedValueOnce({ rows: [] }); // no CONSUMPTION rows for this order

        await InventoryService.reverseConsumptionForOrder(client, 503, BRANCH_ID);

        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();

    });

    it("does nothing if a REVERSAL transaction already exists for this order", async () => {

        InventoryRepository.hasTransactionForReference.mockResolvedValue([{ TransactionId: 9 }]);

        const client = createMockClient();

        await InventoryService.reverseConsumptionForOrder(client, 504, BRANCH_ID);

        expect(InventoryRepository.hasTransactionForReference).toHaveBeenCalledWith(client, "ORDER", 504, "REVERSAL");
        expect(InventoryRepository.recordTransaction).not.toHaveBeenCalled();
        expect(client.query).not.toHaveBeenCalled();

    });

    it("credits back exactly what was consumed, referencing the original transaction", async () => {

        InventoryRepository.hasTransactionForReference.mockResolvedValue([]);

        const client = createMockClient();

        client.query.mockResolvedValueOnce({
            rows: [{
                TransactionId: 11,
                TenantId: TENANT_ID,
                IngredientId: INGREDIENT_ID,
                QuantityBase: -600,
                EnteredUnit: "g",
                EnteredQuantity: 600
            }]
        });

        InventoryRepository.getIngredientBalance.mockResolvedValue(400);

        await InventoryService.reverseConsumptionForOrder(client, 505, BRANCH_ID);

        expect(InventoryRepository.recordTransaction).toHaveBeenCalledTimes(1);
        expect(InventoryRepository.recordTransaction).toHaveBeenCalledWith(
            client,
            expect.objectContaining({
                transactionType: "REVERSAL",
                quantityBase: 600,
                priorQuantityBase: 400,
                postQuantityBase: 1000,
                reversalOfTransactionId: 11,
                referenceType: "ORDER",
                referenceId: 505
            })
        );

    });

});
