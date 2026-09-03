import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { checkIngredientExists, checkIngredientExistsForUpdate } = await import("./IngredientRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

// Same fix as MenuRepository's checkMenuItemExists/getMenuItemByName - an
// exact-match check let "Tomato" and "tomato" both exist as separate
// ingredients for the same tenant, defeating the point of a duplicate check.
describe("IngredientRepository - duplicate-name checks are case-insensitive", () => {

    it("checkIngredientExists compares with ILIKE, not =", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await checkIngredientExists(9, "Tomato");

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"Name" ILIKE \$2/);
        expect(sql).not.toMatch(/"Name" = \$2/);
        expect(params).toEqual([9, "Tomato"]);

    });

    it("checkIngredientExistsForUpdate compares with ILIKE, not =", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await checkIngredientExistsForUpdate(9, 42, "Tomato");

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"Name" ILIKE \$2/);
        expect(sql).not.toMatch(/"Name" = \$2/);
        expect(params).toEqual([9, "Tomato", 42]);

    });

});
