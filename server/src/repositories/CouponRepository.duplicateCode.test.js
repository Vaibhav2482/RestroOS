import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getByTenantAndCode } = await import("./CouponRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

// Same fix as MenuRepository/IngredientRepository/CategoryRepository - an
// exact-match check let "WELCOME10" and "welcome10" both exist as separate
// coupons for the same tenant. Both current entry points already force
// uppercase client-side so this wasn't actively exploitable through the
// UI, but the server-side check shouldn't depend on that holding forever.
describe("CouponRepository.getByTenantAndCode - case-insensitive duplicate check", () => {

    it("compares with ILIKE, not =", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getByTenantAndCode(9, "WELCOME10");

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"Code" ILIKE \$2/);
        expect(sql).not.toMatch(/"Code" = \$2/);
        expect(params).toEqual([9, "WELCOME10"]);

    });

});
