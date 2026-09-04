import * as TableRepository from "../repositories/TableRepository.js";
import * as TableVisitRepository from "../repositories/TableVisitRepository.js";
import { assertBranchBelongsToTenant } from "../utils/branchScope.js";

export const getActiveTables = async (branchId, tenantId) => {

    if (!branchId) {
        return { success: false, message: "Branch Id is required." };
    }

    if (!(await assertBranchBelongsToTenant(branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const tables = await TableRepository.getActiveTables(branchId);

    return { success: true, message: "Tables fetched successfully.", data: tables };

};

export const getAllTables = async (tenantId, branchId) => {

    const tables = await TableRepository.getAllTables(tenantId, branchId);

    return { success: true, message: "Tables fetched successfully.", data: tables };

};

export const getTableById = async (tableId, tenantId) => {

    const table = await TableRepository.getTableById(tableId);

    if (!table || table.TenantId !== tenantId) {
        return { success: false, message: "Table not found." };
    }

    return { success: true, message: "Table fetched successfully.", data: table };

};

export const createTable = async (table, tenantId) => {

    if (!table.branchId) {
        return { success: false, message: "Branch Id is required." };
    }

    if (!(await assertBranchBelongsToTenant(table.branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    if (!table.tableName || table.tableName.trim() === "") {
        return { success: false, message: "Table Name is required." };
    }

    const duplicate = await TableRepository.getTableByName(table.branchId, table.tableName);

    if (duplicate) {
        return {
            success: false,
            message: duplicate.IsActive
                ? `A table named "${duplicate.TableName}" already exists in this branch.`
                : `A deactivated table named "${duplicate.TableName}" already exists in this branch — reactivate it instead.`
        };
    }

    const createdTable = await TableRepository.createTable(table);

    return { success: true, message: "Table created successfully.", data: createdTable };

};

export const updateTable = async (tableId, table, tenantId) => {

    const existingTable = await TableRepository.getTableById(tableId);

    if (!existingTable || existingTable.TenantId !== tenantId) {
        return { success: false, message: "Table not found." };
    }

    if (!table.tableName || table.tableName.trim() === "") {
        return { success: false, message: "Table Name is required." };
    }

    const duplicate = await TableRepository.getTableByName(existingTable.BranchId, table.tableName, Number(tableId));

    if (duplicate) {
        return { success: false, message: `A table named "${duplicate.TableName}" already exists in this branch.` };
    }

    // Same guard as deactivateTable, and for the same reason - the Edit
    // dialog's own Active checkbox is a second, separate path to the exact
    // same IsActive column, so it needs the exact same check. Only
    // triggered on the actual Active -> Inactive transition, not on every
    // edit, so changing capacity/floor on an already-active table never
    // pays for a lookup it doesn't need.
    if (existingTable.IsActive && table.isActive === false) {

        const openVisit = await TableVisitRepository.getOpenVisitForTable(existingTable.BranchId, existingTable.TableName);

        if (openVisit) {
            return {
                success: false,
                message: `"${existingTable.TableName}" still has an open bill - settle it first before deactivating this table.`
            };
        }

    }

    const updatedTable = await TableRepository.updateTable({ ...table, tableId: Number(tableId) }, tenantId);

    if (!updatedTable) {
        return { success: false, message: "Table not found." };
    }

    return { success: true, message: "Table updated successfully.", data: updatedTable };

};

export const deactivateTable = async (tableId, tenantId) => {

    const existingTable = await TableRepository.getTableById(tableId);

    if (!existingTable || existingTable.TenantId !== tenantId) {
        return { success: false, message: "Table not found." };
    }

    // A deactivated table drops out of getActiveTables entirely, which is
    // what the floor grid (and Settle Bill, which is only ever reached by
    // tapping a table there) is built on. Deactivating one that still has
    // an Open TableVisit would make that bill unreachable through any
    // screen in the app - not merely hidden, genuinely stuck open with no
    // way to collect payment or close it out. Settling the bill first (the
    // normal end of a sitting) already clears this on its own.
    const openVisit = await TableVisitRepository.getOpenVisitForTable(existingTable.BranchId, existingTable.TableName);

    if (openVisit) {
        return {
            success: false,
            message: `"${existingTable.TableName}" still has an open bill - settle it first before deactivating this table.`
        };
    }

    await TableRepository.deactivateTable(tableId, tenantId);

    return { success: true, message: "Table deactivated successfully." };

};
