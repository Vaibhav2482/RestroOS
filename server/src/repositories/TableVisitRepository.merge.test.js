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

const { settleVisit, getVisitHeader, getVisitConsolidatedItems, getVisitOrders, mergeVisits, unmergeVisit } = await import("./TableVisitRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
});

// getVisitHeader/Items/Orders all resolve $1 to its merge group via the
// same CTE (see TableVisitRepository.GROUP_VISITS_CTE) - these just check
// each query shape actually rolls up to the group rather than the single
// input visit, since that's the whole point of a merge being invisible to
// every existing caller.
describe("Billing queries roll up a merge group, not just the input visit", () => {

    it("getVisitHeader aggregates orders across every visit in the group and returns MergedVisits", async () => {

        queryMock.mockResolvedValue({ rows: [{ VisitId: 5, MergedVisits: [{ VisitId: 5, TableNumber: "A1" }, { VisitId: 6, TableNumber: "A2" }] }] });

        await getVisitHeader(6);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/COALESCE\(\(SELECT "MergedIntoVisitId" FROM "TableVisits" WHERE "VisitId" = \$1\), \$1\)/);
        expect(sql).toMatch(/"VisitId" = root\."RootVisitId" OR "MergedIntoVisitId" = root\."RootVisitId"/);
        expect(sql).toMatch(/O\."VisitId" IN \(SELECT "VisitId" FROM group_visits\)/);
        expect(sql).toMatch(/"MergedVisits"/);
        expect(params).toEqual([6]);

    });

    it("getVisitConsolidatedItems scopes to the whole group", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getVisitConsolidatedItems(6);

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/O\."VisitId" IN \(SELECT "VisitId" FROM group_visits\)/);

    });

    it("getVisitOrders scopes to the whole group and includes each order's own TableNumber", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getVisitOrders(6);

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/O\."VisitId" IN \(SELECT "VisitId" FROM group_visits\)/);
        expect(sql).toMatch(/O\."TableNumber"/);

    });

});

describe("TableVisitRepository.settleVisit - merged tables", () => {

    it("locks and closes every visit in the group, not just the one that was clicked", async () => {

        clientQueryMock
            .mockResolvedValueOnce(undefined) // BEGIN
            // Called with the CHILD's VisitId (6) - the group still includes
            // both the root (5) and the child (6) itself.
            .mockResolvedValueOnce({ rows: [{ VisitId: 5, Status: "Open", MergedIntoVisitId: null }, { VisitId: 6, Status: "Open", MergedIntoVisitId: 5 }] })
            .mockResolvedValueOnce({ rows: [{ OrderCount: 2, TotalAmount: "400.00" }] }) // combined order total
            .mockResolvedValueOnce(undefined) // INSERT payment
            .mockResolvedValueOnce(undefined) // UPDATE Status (both visits)
            .mockResolvedValueOnce(undefined) // UPDATE Discount (root only)
            .mockResolvedValueOnce(undefined); // COMMIT

        queryMock.mockResolvedValueOnce({ rows: [{ VisitId: 5, TotalAmount: "400.00" }] }); // getVisitHeader

        await settleVisit(6, { paymentMethod: "Cash", adminId: 1 });

        const totalCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("FROM \"Orders\" WHERE"));
        expect(totalCall[1]).toEqual([[5, 6]]);

        const insertCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO \"TableVisitPayments\""));
        // Written against the root (5), not the child that was actually clicked (6).
        expect(insertCall[1]).toEqual([5, "Cash", 400]);

        const statusUpdateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes(`SET "Status" = 'Closed'`));
        expect(statusUpdateCall[1][0]).toEqual([5, 6]);

        const discountUpdateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("DiscountByAdminId"));
        expect(discountUpdateCall[1][0]).toBe(5);

    });

    it("rejects settling if any visit in the group is already Closed", async () => {

        clientQueryMock
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockResolvedValueOnce({ rows: [{ VisitId: 5, Status: "Closed", MergedIntoVisitId: null }, { VisitId: 6, Status: "Open", MergedIntoVisitId: 5 }] });

        await expect(settleVisit(6, { paymentMethod: "Cash", adminId: 1 })).rejects.toThrow(/already been settled/i);
        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");

    });

});

describe("TableVisitRepository.mergeVisits", () => {

    const mockVisitsLookup = (rows) => {
        clientQueryMock
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockResolvedValueOnce({ rows });
    };

    it("rejects merging a table into itself", async () => {

        await expect(mergeVisits(1, "A1", "A1")).rejects.toThrow(/two different tables/i);
        expect(clientQueryMock).not.toHaveBeenCalled();

    });

    it("rejects when the source table has no open bill", async () => {

        mockVisitsLookup([{ VisitId: 6, TableNumber: "A2", MergedIntoVisitId: null, HasChildren: false }]);

        await expect(mergeVisits(1, "A1", "A2")).rejects.toThrow(/Table A1 has no open bill/i);
        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");

    });

    it("rejects when the target table has no open bill", async () => {

        mockVisitsLookup([{ VisitId: 5, TableNumber: "A1", MergedIntoVisitId: null, HasChildren: false }]);

        await expect(mergeVisits(1, "A1", "A2")).rejects.toThrow(/Table A2 has no open bill/i);

    });

    it("rejects a source that's already merged into another table", async () => {

        mockVisitsLookup([
            { VisitId: 5, TableNumber: "A1", MergedIntoVisitId: 9, HasChildren: false },
            { VisitId: 6, TableNumber: "A2", MergedIntoVisitId: null, HasChildren: false }
        ]);

        await expect(mergeVisits(1, "A1", "A2")).rejects.toThrow(/already merged with another table/i);

    });

    it("rejects a source that already has other tables merged into it", async () => {

        mockVisitsLookup([
            { VisitId: 5, TableNumber: "A1", MergedIntoVisitId: null, HasChildren: true },
            { VisitId: 6, TableNumber: "A2", MergedIntoVisitId: null, HasChildren: false }
        ]);

        await expect(mergeVisits(1, "A1", "A2")).rejects.toThrow(/already has other tables merged into it/i);

    });

    it("rejects a target that's itself merged into another table", async () => {

        mockVisitsLookup([
            { VisitId: 5, TableNumber: "A1", MergedIntoVisitId: null, HasChildren: false },
            { VisitId: 6, TableNumber: "A2", MergedIntoVisitId: 9, HasChildren: false }
        ]);

        await expect(mergeVisits(1, "A1", "A2")).rejects.toThrow(/itself merged into another table/i);

    });

    it("merges the source into the target and returns the target's VisitId", async () => {

        mockVisitsLookup([
            { VisitId: 5, TableNumber: "A1", MergedIntoVisitId: null, HasChildren: false },
            { VisitId: 6, TableNumber: "A2", MergedIntoVisitId: null, HasChildren: false }
        ]);
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        const targetVisitId = await mergeVisits(1, "A1", "A2");

        expect(targetVisitId).toBe(6);

        const updateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes(`SET "MergedIntoVisitId"`));
        expect(updateCall[1]).toEqual([5, 6]);
        expect(clientQueryMock).toHaveBeenCalledWith("COMMIT");

    });

});

describe("TableVisitRepository.unmergeVisit", () => {

    it("clears MergedIntoVisitId and returns the VisitId", async () => {

        queryMock.mockResolvedValue({ rows: [{ VisitId: 6 }] });

        const visitId = await unmergeVisit(1, "A2");

        expect(visitId).toBe(6);

        const [sql, params] = queryMock.mock.calls[0];
        expect(sql).toMatch(/SET "MergedIntoVisitId" = NULL/);
        expect(params).toEqual([1, "A2"]);

    });

    it("rejects a table that isn't currently merged with anything", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await expect(unmergeVisit(1, "A2")).rejects.toThrow(/isn't merged with another table/i);

    });

});
