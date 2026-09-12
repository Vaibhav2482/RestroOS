import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
    vi.useRealTimers();
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

// Regression: ValidFrom/ValidUntil are picked as a plain calendar date (an
// <input type="date"> in CouponDialog.jsx) and stored as a naive timestamp
// that round-trips as a real UTC instant in production (same as
// Orders.OrderDate - see AnalyticsRepository's AT_IST comment). A bare
// `now > new Date(ValidUntil)` compare therefore expired a coupon at UTC
// midnight of its last valid day - 5:30am IST, not the end of that day for
// an India-based restaurant - cutting off almost the entire final day of
// a promotion the owner explicitly set as still valid. ValidFrom had the
// mirror problem: the coupon didn't actually turn on until 5:30am IST on
// its start date. Fixed timezone (no DST in India) makes exact-boundary
// instants safe to assert with fake timers, independent of the machine
// running the test.
describe("resolveCoupon - ValidFrom/ValidUntil are IST calendar-day boundaries, not UTC midnight", () => {

    afterEach(() => {
        vi.useRealTimers();
    });

    it("still honors a coupon at 11pm IST on its ValidUntil date, when UTC midnight of that date has already passed", async () => {

        // ValidUntil = 15 Sep 2026 (stored as 2026-09-15T00:00:00Z). "Now" is
        // 15 Sep, 11:00pm IST = 2026-09-15T17:30:00Z - well past UTC midnight
        // of the 15th, but still the evening of the 15th in India.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-15T17:30:00.000Z"));

        const queryable = makeQueryable({ coupon: { ...baseCoupon, ValidUntil: new Date("2026-09-15T00:00:00.000Z") } });

        const result = await resolveCoupon(queryable, 1, "WELCOME10", 1, 500);

        expect(result.discountAmount).toBeCloseTo(50);

    });

    it("expires only once the day after ValidUntil actually begins in IST", async () => {

        // The instant IST rolls over into 16 Sep - 2026-09-16T00:00:00 IST -
        // is 2026-09-15T18:30:00Z. One second earlier must still work.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-15T18:29:59.000Z"));

        const stillValid = makeQueryable({ coupon: { ...baseCoupon, ValidUntil: new Date("2026-09-15T00:00:00.000Z") } });

        await expect(resolveCoupon(stillValid, 1, "WELCOME10", 1, 500)).resolves.toBeTruthy();

        vi.setSystemTime(new Date("2026-09-15T18:30:00.000Z"));

        const nowExpired = makeQueryable({ coupon: { ...baseCoupon, ValidUntil: new Date("2026-09-15T00:00:00.000Z") } });

        await expect(resolveCoupon(nowExpired, 1, "WELCOME10", 1, 500))
            .rejects.toThrow("This coupon has expired.");

    });

    it("activates from the very start of ValidFrom's date in IST, not 5:30am that morning", async () => {

        // ValidFrom = 1 Sep 2026 (stored as 2026-09-01T00:00:00Z). Midnight
        // IST on the 1st is 2026-08-31T18:30:00Z - a moment a bare UTC
        // compare would have rejected as "not active yet".
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-31T18:30:00.000Z"));

        const queryable = makeQueryable({ coupon: { ...baseCoupon, ValidFrom: new Date("2026-09-01T00:00:00.000Z") } });

        await expect(resolveCoupon(queryable, 1, "WELCOME10", 1, 500)).resolves.toBeTruthy();

    });

    it("still rejects a coupon before its ValidFrom date has actually started in IST", async () => {

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-31T18:29:59.000Z"));

        const queryable = makeQueryable({ coupon: { ...baseCoupon, ValidFrom: new Date("2026-09-01T00:00:00.000Z") } });

        await expect(resolveCoupon(queryable, 1, "WELCOME10", 1, 500))
            .rejects.toThrow("This coupon isn't active yet.");

    });

});
