import { describe, it, expect, vi, beforeEach } from "vitest";

import { resolveCoupon } from "./couponResolver.js";

const baseCoupon = {
    CouponId: 7,
    Code: "WELCOME10",
    IsActive: true,
    ValidFrom: null,
    ValidUntil: null,
    MinOrderValue: null,
    UsageLimitTotal: null,
    UsageLimitPerCustomer: 1,
    DiscountType: "Percentage",
    DiscountValue: 10,
    MaxDiscountAmount: null
};

function makeQueryable({ coupon = baseCoupon, redemptionCount = 0 } = {}) {

    const query = vi.fn((sql) => {

        if (sql.includes("FROM \"Coupons\"")) {
            return Promise.resolve({ rows: coupon ? [coupon] : [] });
        }

        if (sql.includes("FROM \"CouponRedemptions\"")) {
            return Promise.resolve({ rows: [{ count: String(redemptionCount) }] });
        }

        throw new Error(`Unexpected query: ${sql}`);

    });

    return { query };

}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("resolveCoupon - per-customer usage limit", () => {

    it("blocks a repeat redemption by the exact same CustomerId", async () => {

        const queryable = makeQueryable({ redemptionCount: 1 });

        await expect(resolveCoupon(queryable, 1, "WELCOME10", 55, 500))
            .rejects.toThrow("You've already used this coupon.");

    });

    it("allows a first-time redemption when the customer has never used it", async () => {

        const queryable = makeQueryable({ redemptionCount: 0 });

        const result = await resolveCoupon(queryable, 1, "WELCOME10", 55, 500);

        expect(result.discountAmount).toBeCloseTo(50);

    });

    // Regression: a guest checkout mints a brand-new CustomerId every
    // browser session, so before this fix, clearing storage (or an
    // incognito window) let the same person redeem a "1 per customer"
    // coupon over and over under a fresh CustomerId every time. The check
    // now also matches by phone number, which guests supply at checkout
    // before this runs - so this must be reflected in the query sent to
    // the DB, not just asserted on the mocked return value.
    it("also checks redemptions by phone number, not just CustomerId, to catch guest-session reuse", async () => {

        const queryable = makeQueryable({ redemptionCount: 0 });

        await resolveCoupon(queryable, 1, "WELCOME10", 99, 500);

        const redemptionCall = queryable.query.mock.calls.find(([sql]) => sql.includes("FROM \"CouponRedemptions\""));

        expect(redemptionCall[0]).toMatch(/"Phone"/);
        expect(redemptionCall[1]).toEqual([7, 99]);

    });

});

describe("resolveCoupon - other validations still hold", () => {

    it("rejects an unknown code", async () => {

        const queryable = makeQueryable({ coupon: null });

        await expect(resolveCoupon(queryable, 1, "NOPE", 1, 500))
            .rejects.toThrow("Invalid coupon code.");

    });

    it("returns a zero discount when no code is given", async () => {

        const queryable = makeQueryable();

        const result = await resolveCoupon(queryable, 1, "", 1, 500);

        expect(result).toEqual({ discountAmount: 0, couponId: null });
        expect(queryable.query).not.toHaveBeenCalled();

    });

    it("enforces the minimum order value", async () => {

        const queryable = makeQueryable({ coupon: { ...baseCoupon, MinOrderValue: 600 } });

        await expect(resolveCoupon(queryable, 1, "WELCOME10", 1, 500))
            .rejects.toThrow(/minimum order/);

    });

});
