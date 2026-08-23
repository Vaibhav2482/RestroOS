import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository.statusGate.test.js/tax.test.js - stub the
// pool these functions call directly, so this exercises the real query-
// building/row-shaping logic with no actual database involved.
const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getAllOrders, getOrderStatusCounts, getDashboardSummary } = await import("./OrderRepository.js");

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
        expect(sql).toMatch(/LIMIT \$8 OFFSET \$9/);
        // tenantId, branchId, customerId, status, dateFrom, dateTo, search
        // (all null - no filters passed), then limit, offset (page 2, limit
        // 2 -> offset 2).
        expect(params).toEqual([3, 7, null, null, null, null, null, 2, 2]);

    });

    it("returns total 0 for an empty page rather than a bare TotalCount lookup on an empty array", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        const result = await getAllOrders(3, null, null, { page: 5, limit: 25 });

        expect(result).toEqual({ orders: [], total: 0 });

    });

});

// The filters Orders.jsx (tenant-admin) used to apply client-side over the
// entire fetched order history - moved server-side so a growing order
// history stops meaning a growing page-load. Only apply alongside
// pagination; the unpaginated branch above has no caller with a UI to
// filter from.
describe("OrderRepository.getAllOrders - filters (status/date range/search)", () => {

    it("passes status through as-is, and null when it's the 'All' sentinel or absent", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllOrders(3, null, null, { page: 1, limit: 25 }, { status: "Pending" });
        expect(queryMock.mock.calls[0][1][3]).toBe("Pending");

        queryMock.mockClear();
        await getAllOrders(3, null, null, { page: 1, limit: 25 }, { status: "All" });
        expect(queryMock.mock.calls[0][1][3]).toBeNull();

    });

    it("passes dateFrom/dateTo through for a ::date range comparison", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllOrders(3, null, null, { page: 1, limit: 25 }, { dateFrom: "2026-08-01", dateTo: "2026-08-31" });

        const [sql, params] = queryMock.mock.calls[0];
        expect(sql).toMatch(/O\."OrderDate"::date >= \$5/);
        expect(sql).toMatch(/O\."OrderDate"::date <= \$6/);
        expect(params[4]).toBe("2026-08-01");
        expect(params[5]).toBe("2026-08-31");

    });

    it("matches search against either the order id or the customer name", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllOrders(3, null, null, { page: 1, limit: 25 }, { search: "  70  " });

        const [sql, params] = queryMock.mock.calls[0];
        expect(sql).toMatch(/CAST\(O\."OrderId" AS TEXT\) ILIKE '%' \|\| \$7 \|\| '%' OR C\."FullName" ILIKE '%' \|\| \$7 \|\| '%'/);
        // Trimmed before being sent as a query param.
        expect(params[6]).toBe("70");

    });

});

describe("OrderRepository.getOrderStatusCounts", () => {

    it("shapes rows into a { status: count } map", async () => {

        queryMock.mockResolvedValue({
            rows: [
                { OrderStatus: "Pending", Count: 3 },
                { OrderStatus: "Delivered", Count: 12 }
            ]
        });

        const result = await getOrderStatusCounts(3, null);

        expect(result).toEqual({ Pending: 3, Delivered: 12 });

    });

    it("does not filter by status itself - the whole point is per-status counts", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getOrderStatusCounts(3, null, { search: "70" });

        const [sql] = queryMock.mock.calls[0];
        expect(sql).not.toMatch(/"OrderStatus" = /);
        expect(sql).toMatch(/GROUP BY O\."OrderStatus"/);

    });

    it("returns an empty object rather than throwing when there are no orders in scope", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        const result = await getOrderStatusCounts(3, null);

        expect(result).toEqual({});

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
