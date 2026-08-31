import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as the other repository query-shape tests - stub the pool
// this function queries directly, asserting the real SQL rather than
// hitting an actual database. No test file existed for TableRepository
// before this - scoped here to just the new Floor column plumbing.
const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getActiveTables, createTable, updateTable } = await import("./TableRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

describe("TableRepository - Floor column", () => {

    it("selects Floor and sorts by it (nulls last) in getActiveTables", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getActiveTables(1);

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"TableName", "Capacity", "Floor"/);
        expect(sql).toMatch(/ORDER BY "Floor" NULLS LAST/);

    });

    it("inserts the trimmed floor value, or null when not given", async () => {

        queryMock.mockResolvedValue({ rows: [{ TableId: 1 }] });

        await createTable({ branchId: 1, tableName: "A1", floor: "  Ground Floor  " });

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"Floor"/);
        expect(params).toEqual([1, "A1", null, "Ground Floor"]);

    });

    it("defaults floor to null when omitted entirely", async () => {

        queryMock.mockResolvedValue({ rows: [{ TableId: 1 }] });

        await createTable({ branchId: 1, tableName: "A1" });

        const [, params] = queryMock.mock.calls[0];

        expect(params).toEqual([1, "A1", null, null]);

    });

    it("updates the floor value the same way", async () => {

        queryMock.mockResolvedValue({ rows: [{ TableId: 1 }] });

        await updateTable({ tableId: 1, tableName: "A1", isActive: true, floor: "Terrace" }, 9);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"Floor" = \$3/);
        expect(params).toEqual(["A1", null, "Terrace", true, 1, 9]);

    });

});
