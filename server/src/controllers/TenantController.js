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

export const suspendTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.suspendTenant(req.params.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const reactivateTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.reactivateTenant(req.params.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

// Same TenantService.updateDisabledFeatures a tenant's own Owner uses via
// PUT /tenants/me/features - this is the platform-admin path to the exact
// same column, for any tenant by id rather than only the caller's own.
export const updateTenantFeatures = asyncHandler(async (req, res) => {

    const result = await TenantService.updateDisabledFeatures(req.params.tenantId, req.body.disabledFeatures);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});
