import * as TableService from "../services/TableService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { resolveBranchId, isBranchAdmin, branchMismatch } from "../utils/branchScope.js";

export const getActiveTables = asyncHandler(async (req, res) => {

    const result = await TableService.getActiveTables(resolveBranchId(req), req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const getAllTables = asyncHandler(async (req, res) => {

    const result = await TableService.getAllTables(req.user.tenantId, resolveBranchId(req));

    return successResponse(res, result.data, result.message);

});

export const getTableById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await TableService.getTableById(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    if (branchMismatch(req, result.data.BranchId)) {
        return errorResponse(res, "You are not authorized to view a table from another branch.", 403);
    }

    return successResponse(res, result.data, result.message);

});

export const createTable = asyncHandler(async (req, res) => {

    const branchId = isBranchAdmin(req) ? req.user.branchId : req.body.branchId;

    const result = await TableService.createTable({ ...req.body, branchId }, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateTable = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingTable = await TableService.getTableById(id, req.user.tenantId);

    if (!existingTable.success) {
        return errorResponse(res, existingTable.message, 404);
    }

    if (branchMismatch(req, existingTable.data.BranchId)) {
        return errorResponse(res, "You are not authorized to update a table from another branch.", 403);
    }

    const result = await TableService.updateTable(id, req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deactivateTable = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingTable = await TableService.getTableById(id, req.user.tenantId);

    if (!existingTable.success) {
        return errorResponse(res, existingTable.message, 404);
    }

    if (branchMismatch(req, existingTable.data.BranchId)) {
        return errorResponse(res, "You are not authorized to deactivate a table from another branch.", 403);
    }

    const result = await TableService.deactivateTable(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, null, result.message);

});
