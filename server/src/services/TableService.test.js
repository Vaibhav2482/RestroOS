import { describe, it, expect, vi, beforeEach } from "vitest";

import * as TableService from "./TableService.js";
import * as TableRepository from "../repositories/TableRepository.js";
import * as TableVisitRepository from "../repositories/TableVisitRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

vi.mock("../repositories/TableRepository.js");
vi.mock("../repositories/TableVisitRepository.js");
vi.mock("../repositories/BranchRepository.js");

const TENANT_ID = 9;

const activeTable = { TableId: 1, BranchId: 5, TenantId: TENANT_ID, TableName: "A1", IsActive: true };

beforeEach(() => {

    vi.clearAllMocks();

    BranchRepository.getBranchById.mockResolvedValue({ BranchId: 5, TenantId: TENANT_ID });
    TableRepository.getTableById.mockResolvedValue(activeTable);
    TableRepository.getTableByName.mockResolvedValue(undefined);
    TableVisitRepository.getOpenVisitForTable.mockResolvedValue(null);

});

// A deactivated table drops out of getActiveTables entirely, which is what
// the floor grid (and Settle Bill, only ever reached by tapping a table
// there) is built on. Deactivating one that still has an Open TableVisit
// would make that bill unreachable through any screen in the app - not
// merely hidden, genuinely stuck open with no way to collect payment.
describe("TableService.deactivateTable - blocks a table with an open bill", () => {

    it("refuses to deactivate a table with an open visit", async () => {

        TableVisitRepository.getOpenVisitForTable.mockResolvedValue({ VisitId: 42 });

        const result = await TableService.deactivateTable(1, TENANT_ID);

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/open bill/i);
        expect(TableRepository.deactivateTable).not.toHaveBeenCalled();

    });

    it("deactivates cleanly when there's no open visit", async () => {

        const result = await TableService.deactivateTable(1, TENANT_ID);

        expect(result.success).toBe(true);
        expect(TableRepository.deactivateTable).toHaveBeenCalledWith(1, TENANT_ID);

    });

});

describe("TableService.updateTable - the Edit dialog's own Active checkbox needs the same guard", () => {

    it("refuses to flip an active table to inactive while it has an open visit", async () => {

        TableVisitRepository.getOpenVisitForTable.mockResolvedValue({ VisitId: 42 });

        const result = await TableService.updateTable(1, { tableName: "A1", isActive: false }, TENANT_ID);

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/open bill/i);
        expect(TableRepository.updateTable).not.toHaveBeenCalled();

    });

    it("does not check for an open visit when the table stays active", async () => {

        TableRepository.updateTable.mockResolvedValue({ ...activeTable, Capacity: 6 });

        const result = await TableService.updateTable(1, { tableName: "A1", isActive: true, capacity: 6 }, TENANT_ID);

        expect(result.success).toBe(true);
        expect(TableVisitRepository.getOpenVisitForTable).not.toHaveBeenCalled();

    });

    it("does not check for an open visit when a table that's already inactive is edited without touching Active", async () => {

        TableRepository.getTableById.mockResolvedValue({ ...activeTable, IsActive: false });
        TableRepository.updateTable.mockResolvedValue({ ...activeTable, IsActive: false, Capacity: 6 });

        const result = await TableService.updateTable(1, { tableName: "A1", capacity: 6 }, TENANT_ID);

        expect(result.success).toBe(true);
        expect(TableVisitRepository.getOpenVisitForTable).not.toHaveBeenCalled();

    });

});
