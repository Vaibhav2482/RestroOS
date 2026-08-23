import * as TenantService from "../services/TenantService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getPublicTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.getPublicTenant(req.query.slug);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getOwnTenant = asyncHandler(async (req, res) => {

    const result = await TenantService.getOwnTenant(req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const updateBranding = asyncHandler(async (req, res) => {

    const { logoUrl, primaryColor } = req.body;

    const result = await TenantService.updateBranding(req.user.tenantId, { logoUrl, primaryColor });

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const updateDeliveryStaffingMode = asyncHandler(async (req, res) => {

    const result = await TenantService.updateDeliveryStaffingMode(req.user.tenantId, req.body.deliveryStaffingMode);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const updateDisabledFeatures = asyncHandler(async (req, res) => {

    const result = await TenantService.updateDisabledFeatures(req.user.tenantId, req.body.disabledFeatures);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});
