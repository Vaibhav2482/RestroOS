import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args) } }));

const { getBalance, getBalanceForUpdate, addPoints, getTransactions, hasEarnedTransactionForOrder } = await import("./LoyaltyRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

describe("LoyaltyRepository.getBalanceForUpdate", () => {

    it("locks the customer's row with FOR UPDATE", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [{ LoyaltyPoints: 40 }] }) };
        const balance = await getBalanceForUpdate(client, 5);

        expect(balance).toBe(40);
        expect(client.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
        expect(client.query.mock.calls[0][1]).toEqual([5]);

    });

    it("returns null for a customer that doesn't exist", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
        expect(await getBalanceForUpdate(client, 999)).toBeNull();

    });

});

describe("LoyaltyRepository.getBalance", () => {

    it("reads the balance off the pool, no lock", async () => {

        queryMock.mockResolvedValue({ rows: [{ LoyaltyPoints: 15 }] });

        const balance = await getBalance(5);

        expect(balance).toBe(15);
        expect(queryMock.mock.calls[0][0]).not.toMatch(/FOR UPDATE/);

    });

});

describe("LoyaltyRepository.addPoints", () => {

    it("writes the ledger row and updates the running balance in the same call", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };

        await addPoints(client, 5, 25, 301, "Earned");

        expect(client.query).toHaveBeenCalledTimes(2);

        const [insertSql, insertParams] = client.query.mock.calls[0];
        expect(insertSql).toMatch(/INSERT INTO "LoyaltyTransactions"/);
        expect(insertParams).toEqual([5, 301, 25, "Earned"]);

        const [updateSql, updateParams] = client.query.mock.calls[1];
        expect(updateSql).toMatch(/"LoyaltyPoints" = "LoyaltyPoints" \+ \$2/);
        expect(updateParams).toEqual([5, 25]);

    });

    it("accepts a negative points value for a redemption, and a null OrderId for a manual adjustment", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };

        await addPoints(client, 5, -10, null, "Adjusted");

        expect(client.query.mock.calls[0][1]).toEqual([5, null, -10, "Adjusted"]);
        expect(client.query.mock.calls[1][1]).toEqual([5, -10]);

    });

});

describe("LoyaltyRepository.getTransactions", () => {

    it("returns every transaction for a customer, newest first", async () => {

        queryMock.mockResolvedValue({ rows: [{ LoyaltyTransactionId: 2, Points: -10, Type: "Redeemed" }] });

        const transactions = await getTransactions(5);

        expect(transactions).toEqual([{ LoyaltyTransactionId: 2, Points: -10, Type: "Redeemed" }]);
        expect(queryMock.mock.calls[0][0]).toMatch(/ORDER BY "CreatedAt" DESC/);

    });

});

describe("LoyaltyRepository.hasEarnedTransactionForOrder", () => {

    it("returns true when an Earned row already exists for the order", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [{}] }) };
        expect(await hasEarnedTransactionForOrder(client, 301)).toBe(true);

    });

    it("returns false when no Earned row exists yet", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
        expect(await hasEarnedTransactionForOrder(client, 301)).toBe(false);

    });

});
