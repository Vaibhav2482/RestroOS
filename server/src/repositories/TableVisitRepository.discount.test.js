import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as other repository query-shape tests - stub the pool this
// function queries directly, and for settleVisit specifically, stub a
// client (BEGIN/COMMIT/ROLLBACK + the locked reads) since it runs inside a
// transaction.
const queryMock = vi.fn();
const clientQueryMock = vi.fn();
const releaseMock = vi.fn();

vi.mock("../config/db.js", () => ({
    default: {
        query: (...args) => queryMock(...args),
        connect: () => Promise.resolve({ query: clientQueryMock, release: releaseMock })
    }
}));

const { settleVisit, getVisitHeader } = await import("./TableVisitRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
});

describe("TableVisitRepository.getVisitHeader - bill discount columns", () => {

    it("aliases the visit's own DiscountAmount as BillDiscountAmount and computes AmountDue", async () => {

        queryMock.mockResolvedValue({ rows: [{ VisitId: 5, BillDiscountAmount: "50.00", AmountDue: "367.90" }] });

        await getVisitHeader(5);

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/V\."DiscountAmount" AS "BillDiscountAmount"/);
        expect(sql).toMatch(/COALESCE\(SUM\(O\."TotalAmount"\), 0\) - V\."DiscountAmount" AS "AmountDue"/);

    });

});

describe("TableVisitRepository.settleVisit - bill discount", () => {

    const mockOpenVisit = () => {
        clientQueryMock
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockResolvedValueOnce({ rows: [{ VisitId: 5, Status: "Open" }] }) // lock visit
            .mockResolvedValueOnce({ rows: [{ OrderCount: 1, TotalAmount: "200.00" }] }); // order total
    };

    it("rejects a discount larger than the bill total, inside the same transaction", async () => {

        mockOpenVisit();

        await expect(
            settleVisit(5, { paymentMethod: "Cash", adminId: 1, discountAmount: 250, discountReason: "Too generous" })
        ).rejects.toThrow(/cannot exceed the bill total/i);

        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");
        // BEGIN, the locked SELECT, the order-total SELECT, and ROLLBACK -
        // no UPDATE call in between, since the over-the-total discount is
        // caught before ever reaching it.
        expect(clientQueryMock).toHaveBeenCalledTimes(4);

    });

    it("writes the discount amount, reason, and admin onto the visit when settling", async () => {

        mockOpenVisit();
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT
        queryMock.mockResolvedValueOnce({ rows: [{ VisitId: 5, AmountDue: "150.00" }] }); // getVisitHeader

        await settleVisit(5, { paymentMethod: "Cash", adminId: 7, discountAmount: 50, discountReason: "Service delay" });

        const updateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("DiscountByAdminId"));

        expect(updateCall[1]).toEqual([5, 50, "Service delay", 7]);

    });

    it("leaves discount columns at their zero/null defaults when no discount is given", async () => {

        mockOpenVisit();
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT
        queryMock.mockResolvedValueOnce({ rows: [{ VisitId: 5 }] });

        await settleVisit(5, { paymentMethod: "Cash", adminId: 7 });

        const updateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("DiscountByAdminId"));

        expect(updateCall[1]).toEqual([5, 0, null, null]);

    });

});
