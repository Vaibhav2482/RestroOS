import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository's other test files - stub the pool this
// function queries directly, asserting the real SQL shape with no actual
// database involved.
const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getActiveTableOrders } = await import("./OrderRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

// This is the query the POS floor grid's occupancy is built on. Migration
// 0024_table_visits moved "is this table occupied" from "has a non-terminal
// order" to "has an Open TableVisit" - a table with every round already
// Delivered but no settled bill yet is still occupied. This regression test
// is what would catch someone reverting that filter back to status-based
// occupancy without noticing why it changed.
describe("OrderRepository.getActiveTableOrders - visit-driven occupancy", () => {

    it("joins on an Open TableVisit rather than filtering Delivered out by status", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getActiveTableOrders(1);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/INNER JOIN "TableVisits" V ON O\."VisitId" = V\."VisitId" AND V\."Status" = 'Open'/);
        expect(sql).not.toMatch(/NOT IN \('Delivered', 'Cancelled'\)/);
        expect(sql).toMatch(/O\."OrderStatus" != 'Cancelled'/);
        expect(params).toEqual([1]);

    });

    it("still scopes to Dine In orders with a table number, same as before", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getActiveTableOrders(1);

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"DeliveryType" = 'Dine In'/);
        expect(sql).toMatch(/"TableNumber" IS NOT NULL/);

    });

});
