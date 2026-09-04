import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getCancelledOrders } = await import("./AnalyticsRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
});

// A void report without who and why is just a list of numbers - the actual
// point (catching a staff member voiding orders to pocket cash) needs
// both. A staff cancellation writes exactly this to OrderAdjustments; a
// customer's own self-cancellation never does, so the join has to be a
// LEFT JOIN (still showing the order), not an INNER JOIN (which would
// silently drop every customer-cancelled order from the report).
describe("AnalyticsRepository.getCancelledOrders - reason and actor", () => {

    it("left-joins the cancelling admin's name and reason from OrderAdjustments", async () => {

        await getCancelledOrders(1, null, new Date(), new Date());

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LEFT JOIN LATERAL[\s\S]*"OrderAdjustments"/);
        expect(sql).toMatch(/"AdjustmentType" = 'VOID'/);
        expect(sql).toMatch(/VA\."Reason" AS "CancelReason"/);
        expect(sql).toMatch(/VA\."ActorAdminName"/);
        expect(sql).not.toMatch(/INNER JOIN "OrderAdjustments"/);

    });

});
