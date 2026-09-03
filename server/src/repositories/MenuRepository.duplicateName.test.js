import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { checkMenuItemExists, getMenuItemByName } = await import("./MenuRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

// Both used to compare with "=" - an exact-match check let "Ginger Chai"
// and "ginger chai" both exist for the same branch as if they were
// different items, defeating the point of a duplicate-name check. A name
// is the same name to a human regardless of case.
describe("MenuRepository - duplicate-name checks are case-insensitive", () => {

    it("checkMenuItemExists compares with ILIKE, not =", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await checkMenuItemExists("Ginger Chai", 5);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"ItemName" ILIKE \$1/);
        expect(sql).not.toMatch(/"ItemName" = \$1/);
        expect(params).toEqual(["Ginger Chai", 5]);

    });

    it("getMenuItemByName compares with ILIKE, not =", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getMenuItemByName("Ginger Chai", 5);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"ItemName" ILIKE \$1/);
        expect(sql).not.toMatch(/"ItemName" = \$1/);
        expect(params).toEqual(["Ginger Chai", 5]);

    });

});
