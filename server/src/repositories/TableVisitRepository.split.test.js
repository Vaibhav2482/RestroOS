import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const clientQueryMock = vi.fn();
const releaseMock = vi.fn();

vi.mock("../config/db.js", () => ({
    default: {
        query: (...args) => queryMock(...args),
        connect: () => Promise.resolve({ query: clientQueryMock, release: releaseMock })
    }
}));

const { settleVisit, getVisitPayments } = await import("./TableVisitRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
});

const mockOpenVisit = (totalAmount = "200.00") => {
    clientQueryMock
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ VisitId: 5, Status: "Open" }] }) // lock visit
        .mockResolvedValueOnce({ rows: [{ OrderCount: 1, TotalAmount: totalAmount }] }); // order total
};

describe("TableVisitRepository.settleVisit - split bill", () => {

    it("rejects splits that don't add up to the amount due, and rolls back", async () => {

        mockOpenVisit("200.00");

        await expect(
            settleVisit(5, { paymentMethod: undefined, adminId: 1, discountAmount: 0, splits: [{ amount: 100, paymentMethod: "Cash" }, { amount: 50, paymentMethod: "Card" }] })
        ).rejects.toThrow(/add up to the amount due/i);

        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");
        expect(clientQueryMock.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("TableVisitPayments"))).toBe(false);

    });

    it("validates the split sum against the amount due AFTER the discount, not the raw bill total", async () => {

        mockOpenVisit("200.00");

        // 200 total - 20 discount = 180 due; these splits sum to 200, not 180.
        await expect(
            settleVisit(5, { adminId: 1, discountAmount: 20, discountReason: "loyal", splits: [{ amount: 100, paymentMethod: "Cash" }, { amount: 100, paymentMethod: "Card" }] })
        ).rejects.toThrow(/add up to the amount due/i);

    });

    it("inserts one TableVisitPayments row per split and summarizes PaymentMethod as 'Split' when methods differ", async () => {

        mockOpenVisit("200.00");
        clientQueryMock.mockResolvedValueOnce(undefined); // INSERT split 1
        clientQueryMock.mockResolvedValueOnce(undefined); // INSERT split 2
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT
        queryMock.mockResolvedValueOnce({ rows: [{ VisitId: 5 }] }); // getVisitHeader

        await settleVisit(5, { adminId: 1, discountAmount: 0, splits: [{ amount: 120, paymentMethod: "Cash" }, { amount: 80, paymentMethod: "UPI" }] });

        const inserts = clientQueryMock.mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO \"TableVisitPayments\""));
        expect(inserts).toHaveLength(2);
        expect(inserts[0][1]).toEqual([5, "Cash", 120]);
        expect(inserts[1][1]).toEqual([5, "UPI", 80]);

        const updateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("DiscountByAdminId"));
        expect(updateCall[1][1]).toBe("Split");

    });

    it("summarizes PaymentMethod as the single method when every split used the same one", async () => {

        mockOpenVisit("200.00");
        clientQueryMock.mockResolvedValueOnce(undefined); // INSERT split 1
        clientQueryMock.mockResolvedValueOnce(undefined); // INSERT split 2
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT
        queryMock.mockResolvedValueOnce({ rows: [{ VisitId: 5 }] });

        await settleVisit(5, { adminId: 1, discountAmount: 0, splits: [{ amount: 100, paymentMethod: "Cash" }, { amount: 100, paymentMethod: "Cash" }] });

        const updateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("DiscountByAdminId"));
        expect(updateCall[1][1]).toBe("Cash");

    });

    it("still writes exactly one payment row for an ordinary, unsplit settle", async () => {

        mockOpenVisit("200.00");
        clientQueryMock.mockResolvedValueOnce(undefined); // INSERT
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT
        queryMock.mockResolvedValueOnce({ rows: [{ VisitId: 5 }] });

        await settleVisit(5, { paymentMethod: "UPI", adminId: 1, discountAmount: 0 });

        const inserts = clientQueryMock.mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO \"TableVisitPayments\""));
        expect(inserts).toHaveLength(1);
        expect(inserts[0][1]).toEqual([5, "UPI", 200]);

    });

});

describe("TableVisitRepository.getVisitPayments", () => {

    it("returns every payment row for a visit, in insertion order", async () => {

        queryMock.mockResolvedValue({ rows: [{ TableVisitPaymentId: 1, PaymentMethod: "Cash", Amount: "120.00" }] });

        const payments = await getVisitPayments(5);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/FROM "TableVisitPayments"/);
        expect(sql).toMatch(/ORDER BY "TableVisitPaymentId" ASC/);
        expect(params).toEqual([5]);
        expect(payments).toEqual([{ TableVisitPaymentId: 1, PaymentMethod: "Cash", Amount: "120.00" }]);

    });

});
