import * as BranchService from "../services/BranchService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getActiveBranches = asyncHandler(async (req, res) => {

    const result = await BranchService.getActiveBranchesByTenantSlug(req.query.tenant);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const getAllBranches = asyncHandler(async (req, res) => {

    const result = await BranchService.getAllBranches(req.user.tenantId);

    return successResponse(res, result.data, result.message);

});

export const getBranchById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await BranchService.getBranchById(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const createBranch = asyncHandler(async (req, res) => {

    const result = await BranchService.createBranch(req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateBranch = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await BranchService.updateBranch(id, req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deactivateBranch = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await BranchService.deactivateBranch(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, null, result.message);

});
