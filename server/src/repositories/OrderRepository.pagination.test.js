import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository.statusGate.test.js/tax.test.js - stub the
// pool these functions call directly, so this exercises the real query-
// building/row-shaping logic with no actual database involved.
const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getAllOrders, getDashboardSummary } = await import("./OrderRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

describe("OrderRepository.getAllOrders - pagination is opt-in", () => {

    it("runs the plain unpaginated query and returns a bare array when no pagination is passed", async () => {

        queryMock.mockResolvedValue({ rows: [{ OrderId: 1 }, { OrderId: 2 }] });

        const result = await getAllOrders(3, null, null);

        expect(result).toEqual([{ OrderId: 1 }, { OrderId: 2 }]);
        expect(queryMock).toHaveBeenCalledTimes(1);

        const [sql, params] = queryMock.mock.calls[0];
        expect(sql).not.toMatch(/LIMIT/);
        expect(params).toEqual([3, null, null]);

    });

    it("adds LIMIT/OFFSET and strips the running TotalCount off each row when pagination is passed", async () => {

        queryMock.mockResolvedValue({
            rows: [
                { OrderId: 10, TotalCount: 47 },
                { OrderId: 9, TotalCount: 47 }
            ]
        });

        const result = await getAllOrders(3, 7, null, { page: 2, limit: 2 });

        expect(result.total).toBe(47);
        expect(result.orders).toEqual([{ OrderId: 10 }, { OrderId: 9 }]);
        // No lingering TotalCount on the shaped rows the caller sees.
        expect(result.orders[0].TotalCount).toBeUndefined();

        const [sql, params] = queryMock.mock.calls[0];
        expect(sql).toMatch(/LIMIT \$4 OFFSET \$5/);
        // page 2, limit 2 -> offset 2
        expect(params).toEqual([3, 7, null, 2, 2]);

    });

    it("returns total 0 for an empty page rather than a bare TotalCount lookup on an empty array", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        const result = await getAllOrders(3, null, null, { page: 5, limit: 25 });

        expect(result).toEqual({ orders: [], total: 0 });

    });

});

describe("OrderRepository.getDashboardSummary", () => {

    it("combines the aggregate counts query with the recent-orders query", async () => {

        queryMock
            .mockResolvedValueOnce({ rows: [{ TotalOrders: 120, ActiveOrders: 4, TodaysRevenue: 3450.5 }] })
            .mockResolvedValueOnce({ rows: [{ OrderId: 1 }, { OrderId: 2 }] });

        const result = await getDashboardSummary(3, null);

        expect(result).toEqual({
            totalOrders: 120,
            activeOrders: 4,
            todaysRevenue: 3450.5,
            recentOrders: [{ OrderId: 1 }, { OrderId: 2 }]
        });
        expect(queryMock).toHaveBeenCalledTimes(2);

        // Both queries scope to the tenant, and to the branch when one is given.
        const [countsSql, countsParams] = queryMock.mock.calls[0];
        expect(countsSql).toMatch(/"TenantId" = \$1/);
        expect(countsParams).toEqual([3, null]);

    });

    it("defaults today's revenue to 0 rather than null when there are no orders yet", async () => {

        queryMock
            .mockResolvedValueOnce({ rows: [{ TotalOrders: 0, ActiveOrders: 0, TodaysRevenue: 0 }] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await getDashboardSummary(3, null);

        expect(result.todaysRevenue).toBe(0);
        expect(result.recentOrders).toEqual([]);

    });

});
