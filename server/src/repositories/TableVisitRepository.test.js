import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository's own test files - stub the pool/client
// these functions call directly, so this exercises the real transaction
// control-flow (BEGIN/COMMIT/ROLLBACK, FOR UPDATE, the unique-violation
// retry) with no actual database involved.
const poolQueryMock = vi.fn();
const clientQueryMock = vi.fn();
const clientReleaseMock = vi.fn();

vi.mock("../config/db.js", () => ({
    default: {
        query: (...args) => poolQueryMock(...args),
        connect: vi.fn(async () => ({ query: clientQueryMock, release: clientReleaseMock }))
    }
}));

const { resolveOpenVisitId, getOpenVisitForTable, settleVisit, getVisitConsolidatedItems, updateGuestCount } = await import("./TableVisitRepository.js");

beforeEach(() => {
    poolQueryMock.mockReset();
    clientQueryMock.mockReset();
    clientReleaseMock.mockReset();
});

describe("resolveOpenVisitId - attaching a Dine In order to its table's visit", () => {

    it("returns the existing Open visit's Id without inserting a new one", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [{ VisitId: 7 }] }) };

        const visitId = await resolveOpenVisitId(client, 1, "A1");

        expect(visitId).toBe(7);
        expect(client.query).toHaveBeenCalledTimes(1);
        expect(client.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);

    });

    it("opens a new visit when the table has none, and returns its Id", async () => {

        const client = { query: vi.fn() };
        client.query.mockResolvedValueOnce({ rows: [] }); // SELECT ... FOR UPDATE -> none
        client.query.mockResolvedValueOnce({ rows: [{ VisitId: 42 }] }); // INSERT ... RETURNING

        const visitId = await resolveOpenVisitId(client, 1, "B3");

        expect(visitId).toBe(42);
        expect(client.query).toHaveBeenCalledTimes(2);
        expect(client.query.mock.calls[1][0]).toMatch(/INSERT INTO "TableVisits"/);

    });

    // The partial unique index (one Open visit per table) is the real
    // backstop against two concurrent "first round at this table" requests
    // both trying to open a visit - this is what makes losing that race a
    // silent re-read instead of a failed order.
    it("re-reads instead of failing when a concurrent request already opened the visit (23505)", async () => {

        const client = { query: vi.fn() };
        client.query.mockResolvedValueOnce({ rows: [] }); // SELECT ... FOR UPDATE -> none
        client.query.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }));
        client.query.mockResolvedValueOnce({ rows: [{ VisitId: 42 }] }); // re-read

        const visitId = await resolveOpenVisitId(client, 1, "B3");

        expect(visitId).toBe(42);
        expect(client.query).toHaveBeenCalledTimes(3);

    });

    it("propagates any other database error instead of swallowing it", async () => {

        const client = { query: vi.fn() };
        client.query.mockResolvedValueOnce({ rows: [] });
        client.query.mockRejectedValueOnce(Object.assign(new Error("connection reset"), { code: "08006" }));

        await expect(resolveOpenVisitId(client, 1, "B3")).rejects.toThrow("connection reset");

    });

    it("passes guestCount through on a new visit's INSERT", async () => {

        const client = { query: vi.fn() };
        client.query.mockResolvedValueOnce({ rows: [] }); // SELECT ... FOR UPDATE -> none
        client.query.mockResolvedValueOnce({ rows: [{ VisitId: 42 }] }); // INSERT ... RETURNING

        await resolveOpenVisitId(client, 1, "B3", 4);

        expect(client.query.mock.calls[1][1]).toEqual([1, "B3", 4]);

    });

    it("never applies guestCount to an already-open visit - the existing SELECT branch ignores it entirely", async () => {

        const client = { query: vi.fn().mockResolvedValue({ rows: [{ VisitId: 7 }] }) };

        const visitId = await resolveOpenVisitId(client, 1, "A1", 6);

        expect(visitId).toBe(7);
        expect(client.query).toHaveBeenCalledTimes(1); // only the SELECT - no UPDATE attempted

    });

});

describe("updateGuestCount - adjusting an already-open visit", () => {

    it("updates and returns the visit when it's still Open", async () => {

        poolQueryMock.mockResolvedValue({ rows: [{ VisitId: 5 }] });

        const result = await updateGuestCount(5, 6);

        expect(result).toEqual({ VisitId: 5 });

        const [sql, params] = poolQueryMock.mock.calls[0];
        expect(sql).toMatch(/WHERE "VisitId" = \$1 AND "Status" = 'Open'/);
        expect(params).toEqual([5, 6]);

    });

    it("returns null (not found/already settled) rather than throwing when the visit isn't Open", async () => {

        poolQueryMock.mockResolvedValue({ rows: [] });

        const result = await updateGuestCount(5, 6);

        expect(result).toBeNull();

    });

});

describe("getOpenVisitForTable", () => {

    it("returns null when the table has no Open visit", async () => {

        poolQueryMock.mockResolvedValue({ rows: [] });

        const visit = await getOpenVisitForTable(1, "A9");

        expect(visit).toBeNull();

    });

    it("returns the visit row when one exists", async () => {

        poolQueryMock.mockResolvedValue({ rows: [{ VisitId: 3, TableNumber: "A9", Status: "Open" }] });

        const visit = await getOpenVisitForTable(1, "A9");

        expect(visit).toEqual({ VisitId: 3, TableNumber: "A9", Status: "Open" });

    });

});

// Regression test for a real bug caught via live verification, not
// review: an older round's OrderItems row stored SelectedOptions as SQL
// NULL, a newer round's stored it as '[]' - grouping on the raw column
// treated those as two different items, splitting "Tea x2" back into two
// separate "Tea x1" lines on the consolidated bill depending on which
// round happened to write which representation.
describe("getVisitConsolidatedItems - merges identical items across rounds", () => {

    it("coalesces SelectedOptions in both the SELECT and GROUP BY, not just one", async () => {

        poolQueryMock.mockResolvedValue({ rows: [] });

        await getVisitConsolidatedItems(5);

        const [sql] = poolQueryMock.mock.calls[0];

        expect(sql).toMatch(/COALESCE\(OI\."SelectedOptions", '\[\]'::jsonb\) AS "SelectedOptions"/);
        expect(sql).toMatch(/GROUP BY .*COALESCE\(OI\."SelectedOptions", '\[\]'::jsonb\)/);

    });

});

describe("settleVisit - closing a table's bill", () => {

    const mockClientSequence = (rows) => {

        clientQueryMock.mockReset();

        for (const row of rows) {
            clientQueryMock.mockResolvedValueOnce(row);
        }

    };

    it("rejects and rolls back when the visit does not exist", async () => {

        mockClientSequence([
            {}, // BEGIN
            { rows: [] } // SELECT ... FOR UPDATE -> not found
        ]);

        await expect(settleVisit(99, { paymentMethod: "Cash", adminId: 5 })).rejects.toThrow("Table visit not found.");

        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");
        expect(clientReleaseMock).toHaveBeenCalled();

    });

    it("rejects and rolls back a visit that's already Closed - never double-settles", async () => {

        mockClientSequence([
            {}, // BEGIN
            { rows: [{ VisitId: 5, Status: "Closed" }] }
        ]);

        await expect(settleVisit(5, { paymentMethod: "Cash", adminId: 5 })).rejects.toThrow("already been settled");

        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");

    });

    it("rejects a visit with zero non-cancelled orders", async () => {

        mockClientSequence([
            {}, // BEGIN
            { rows: [{ VisitId: 5, Status: "Open" }] },
            { rows: [{ count: 0 }] } // order count
        ]);

        await expect(settleVisit(5, { paymentMethod: "Cash", adminId: 5 })).rejects.toThrow("no orders to settle");

        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");

    });

    it("closes the visit, commits, and returns the fresh header on success", async () => {

        mockClientSequence([
            {}, // BEGIN
            { rows: [{ VisitId: 5, Status: "Open" }] },
            { rows: [{ count: 2 }] }, // order count
            {} // UPDATE
        ]);

        poolQueryMock.mockResolvedValue({
            rows: [{ VisitId: 5, Status: "Closed", TotalAmount: "417.90", OrderCount: 2 }]
        });

        const result = await settleVisit(5, { paymentMethod: "Cash", adminId: 5 });

        expect(clientQueryMock).toHaveBeenCalledWith("COMMIT");
        expect(clientQueryMock).not.toHaveBeenCalledWith("ROLLBACK");
        expect(result).toEqual({ VisitId: 5, Status: "Closed", TotalAmount: "417.90", OrderCount: 2 });

        const updateCall = clientQueryMock.mock.calls.find(([sql]) => sql.includes("UPDATE \"TableVisits\""));
        expect(updateCall[1]).toEqual([5, "Cash", 5]);

    });

});
