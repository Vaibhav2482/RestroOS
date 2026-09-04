import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { checkCategoryExists, checkCategoryExistsForUpdate, getAllCategoriesByTenantSlug } = await import("./CategoryRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

// Same fix as MenuRepository/IngredientRepository - an exact-match check
// let "Beverages" and "beverages" both exist as separate categories for
// the same tenant, defeating the point of a duplicate check. Category
// names have no forced casing convention (unlike coupon codes), so
// nothing on the frontend was masking this one.
describe("CategoryRepository - duplicate-name checks are case-insensitive", () => {

    it("checkCategoryExists compares with ILIKE, not =", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await checkCategoryExists(9, "Beverages");

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"CategoryName" ILIKE \$2/);
        expect(sql).not.toMatch(/"CategoryName" = \$2/);
        expect(params).toEqual([9, "Beverages"]);

    });

    it("checkCategoryExistsForUpdate compares with ILIKE, not =", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await checkCategoryExistsForUpdate(9, 42, "Beverages");

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"CategoryName" ILIKE \$2/);
        expect(sql).not.toMatch(/"CategoryName" = \$2/);
        expect(params).toEqual([9, "Beverages", 42]);

    });

});

// The storefront's own Home.jsx already filters IsActive client-side
// before rendering, but that's a UI convenience, not a security boundary -
// the raw public API response shouldn't hand a deactivated category's name
// to anyone inspecting network traffic just because the rendered page
// happens to hide it.
describe("CategoryRepository.getAllCategoriesByTenantSlug - public endpoint excludes inactive categories", () => {

    it("filters to IsActive = TRUE at the query level", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllCategoriesByTenantSlug("alpha-diner-final");

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/C\."IsActive" = TRUE/);

    });

});
