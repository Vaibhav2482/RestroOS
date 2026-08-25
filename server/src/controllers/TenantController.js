import * as TenantService from "../services/TenantService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getAllTenants = asyncHandler(async (req, res) => {

    const result = await TenantService.getAllTenants();

    return successResponse(res, result.data, result.message);

});

export const createTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.createTenant(req.body, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const resetOwnerPassword = asyncHandler(async (req, res) => {

    const result = await TenantService.resetOwnerPassword(req.params.tenantId, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const suspendTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.suspendTenant(req.params.tenantId, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const reactivateTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.reactivateTenant(req.params.tenantId, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

// A plan-tier restriction (PlatformRestrictedFeatures), distinct from
// PUT /tenants/me/features (DisabledFeatures, the tenant Owner's own
// preference) - this one the Owner can never override, see
// TenantService.updatePlatformRestrictedFeatures.
export const updateTenantFeatures = asyncHandler(async (req, res) => {

    const result = await TenantService.updatePlatformRestrictedFeatures(req.params.tenantId, req.body.platformRestrictedFeatures, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});
