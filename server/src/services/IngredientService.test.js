import { describe, it, expect, vi, beforeEach } from "vitest";

import * as IngredientService from "./IngredientService.js";
import * as IngredientRepository from "../repositories/IngredientRepository.js";

vi.mock("../repositories/IngredientRepository.js");

const TENANT_ID = 9;

beforeEach(() => {

    vi.clearAllMocks();

    IngredientRepository.checkIngredientExists.mockResolvedValue([]);
    IngredientRepository.checkIngredientExistsForUpdate.mockResolvedValue([]);
    IngredientRepository.createIngredient.mockImplementation(async (ingredient) => ({ IngredientId: 1, ...ingredient }));
    IngredientRepository.updateIngredient.mockImplementation(async (ingredient) => ({ ...ingredient }));

});

describe("IngredientService - validation", () => {

    it("rejects a base unit outside the fixed unit set", async () => {

        const result = await IngredientService.createIngredient({ name: "Flour", baseUnit: "lb" }, TENANT_ID);

        expect(result.success).toBe(false);
        expect(IngredientRepository.createIngredient).not.toHaveBeenCalled();

    });

    it("rejects a duplicate name within the same tenant", async () => {

        IngredientRepository.checkIngredientExists.mockResolvedValue([{ IngredientId: 5 }]);

        const result = await IngredientService.createIngredient({ name: "Flour", baseUnit: "g" }, TENANT_ID);

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/already exists/i);

    });

    it("creates an ingredient scoped to the caller's own tenant", async () => {

        const result = await IngredientService.createIngredient({ name: "Flour", baseUnit: "g" }, TENANT_ID);

        expect(result.success).toBe(true);
        expect(IngredientRepository.createIngredient).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_ID }));

    });

});

describe("IngredientService - base unit immutability", () => {

    it("rejects changing the base unit on an existing ingredient", async () => {

        IngredientRepository.getIngredientById.mockResolvedValue({ IngredientId: 1, TenantId: TENANT_ID, BaseUnit: "g" });

        const result = await IngredientService.updateIngredient(1, { name: "Flour", baseUnit: "kg" }, TENANT_ID);

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/base unit cannot be changed/i);
        expect(IngredientRepository.updateIngredient).not.toHaveBeenCalled();

    });

    it("rejects updating an ingredient that belongs to another tenant", async () => {

        IngredientRepository.getIngredientById.mockResolvedValue({ IngredientId: 1, TenantId: 999, BaseUnit: "g" });

        const result = await IngredientService.updateIngredient(1, { name: "Flour", baseUnit: "g" }, TENANT_ID);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Ingredient not found.");

    });

    it("allows other fields to change when the base unit is kept the same", async () => {

        IngredientRepository.getIngredientById.mockResolvedValue({ IngredientId: 1, TenantId: TENANT_ID, BaseUnit: "g" });

        const result = await IngredientService.updateIngredient(1, { name: "Refined Flour", baseUnit: "g" }, TENANT_ID);

        expect(result.success).toBe(true);
        expect(IngredientRepository.updateIngredient).toHaveBeenCalled();

    });

});
