import * as TenantService from "../services/TenantService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getAllTenants = asyncHandler(async (req, res) => {

    const result = await TenantService.getAllTenants();

    return successResponse(res, result.data, result.message);

});

export const createTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.createTenant(req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const resetOwnerPassword = asyncHandler(async (req, res) => {

    const result = await TenantService.resetOwnerPassword(req.params.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});
