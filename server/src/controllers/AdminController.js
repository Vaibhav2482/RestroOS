import * as AdminService from "../services/AdminService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getAllAdmins = asyncHandler(async (req, res) => {

    const result = await AdminService.getAllAdmins(req.user.tenantId);

    return successResponse(res, result.data, result.message);

});

export const getAdminById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await AdminService.getAdminById(id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    if (result.data.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Admin not found.", 404);
    }

    return successResponse(res, result.data, result.message);

});

export const createAdmin = asyncHandler(async (req, res) => {

    const result = await AdminService.createAdmin(req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateAdmin = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingAdmin = await AdminService.getAdminById(id);

    if (!existingAdmin.success) {
        return errorResponse(res, existingAdmin.message, 404);
    }

    if (existingAdmin.data.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Admin not found.", 404);
    }

    const result = await AdminService.updateAdmin(id, req.body, req.user.id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deactivateAdmin = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingAdmin = await AdminService.getAdminById(id);

    if (!existingAdmin.success) {
        return errorResponse(res, existingAdmin.message, 404);
    }

    if (existingAdmin.data.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Admin not found.", 404);
    }

    const result = await AdminService.deactivateAdmin(id, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, null, result.message);

});
