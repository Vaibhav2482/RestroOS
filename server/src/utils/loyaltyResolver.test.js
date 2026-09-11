import { describe, it, expect, vi } from "vitest";

import { resolvePointsRedemption, pointsEarnedFor, LOYALTY_EARN_RATE_PER_100, LOYALTY_POINT_VALUE } from "./loyaltyResolver.js";

const makeClient = ({ disabledFeatures = [], platformRestrictedFeatures = [], balance = 0 } = {}) => ({
    query: vi.fn(async (sql) => {

        if (sql.includes("FROM \"Tenants\"")) {
            return { rows: [{ DisabledFeatures: disabledFeatures, PlatformRestrictedFeatures: platformRestrictedFeatures }] };
        }

        if (sql.includes("FROM \"Customers\"")) {
            return { rows: [{ LoyaltyPoints: balance }] };
        }

        throw new Error(`Unexpected query: ${sql}`);

    })
});

describe("resolvePointsRedemption", () => {

    it("resolves to no discount when no points are requested", async () => {

        const client = makeClient();
        const result = await resolvePointsRedemption(client, 1, 5, 0, 500);

        expect(result).toEqual({ discountAmount: 0, pointsUsed: 0 });
        expect(client.query).not.toHaveBeenCalled();

    });

    it("resolves to no discount, silently, when the tenant has loyalty_points disabled", async () => {

        const client = makeClient({ disabledFeatures: ["loyalty_points"], balance: 100 });
        const result = await resolvePointsRedemption(client, 1, 5, 50, 500);

        expect(result).toEqual({ discountAmount: 0, pointsUsed: 0 });

    });

    it("resolves to no discount when a platform admin has restricted loyalty_points", async () => {

        const client = makeClient({ platformRestrictedFeatures: ["loyalty_points"], balance: 100 });
        const result = await resolvePointsRedemption(client, 1, 5, 50, 500);

        expect(result).toEqual({ discountAmount: 0, pointsUsed: 0 });

    });

    it("throws when the customer requests more points than their balance", async () => {

        const client = makeClient({ balance: 10 });

        await expect(resolvePointsRedemption(client, 1, 5, 50, 500)).rejects.toThrow(/only have 10 loyalty points/i);

    });

    it("uses the singular 'point' when the balance is exactly 1", async () => {

        const client = makeClient({ balance: 1 });

        await expect(resolvePointsRedemption(client, 1, 5, 50, 500)).rejects.toThrow(/only have 1 loyalty point\./i);

    });

    it("redeems the full requested amount when it fits within the subtotal", async () => {

        const client = makeClient({ balance: 100 });
        const result = await resolvePointsRedemption(client, 1, 5, 50, 500);

        expect(result).toEqual({ discountAmount: 50 * LOYALTY_POINT_VALUE, pointsUsed: 50 });

    });

    it("caps points used to what the subtotal can actually absorb, without erroring", async () => {

        const client = makeClient({ balance: 100 });
        // Wants to spend 80 points (₹80) against a ₹30 subtotal.
        const result = await resolvePointsRedemption(client, 1, 5, 80, 30);

        expect(result).toEqual({ discountAmount: 30, pointsUsed: 30 });

    });

    it("locks the customer's balance row (FOR UPDATE) before validating", async () => {

        const client = makeClient({ balance: 100 });
        await resolvePointsRedemption(client, 1, 5, 10, 500);

        const customerCall = client.query.mock.calls.find(([sql]) => sql.includes("FROM \"Customers\""));
        expect(customerCall[0]).toMatch(/FOR UPDATE/);

    });

});

describe("pointsEarnedFor", () => {

    it(`earns ${LOYALTY_EARN_RATE_PER_100} points per ₹100 actually paid`, () => {
        expect(pointsEarnedFor(200)).toBe(LOYALTY_EARN_RATE_PER_100 * 2);
    });

    it("floors a partial ₹100 bucket rather than rounding up", () => {
        expect(pointsEarnedFor(149)).toBe(Math.floor(149 / 100 * LOYALTY_EARN_RATE_PER_100));
    });

    it("earns zero on a zero or negative amount", () => {
        expect(pointsEarnedFor(0)).toBe(0);
        expect(pointsEarnedFor(-50)).toBe(0);
    });

});
