import * as TableRepository from "../repositories/TableRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};

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

    const updatedTable = await TableRepository.updateTable({ ...table, tableId: Number(tableId) });

    return { success: true, message: "Table updated successfully.", data: updatedTable };

};

export const deactivateTable = async (tableId, tenantId) => {

    const existingTable = await TableRepository.getTableById(tableId);

    if (!existingTable || existingTable.TenantId !== tenantId) {
        return { success: false, message: "Table not found." };
    }

    await TableRepository.deactivateTable(tableId);

    return { success: true, message: "Table deactivated successfully." };

};
