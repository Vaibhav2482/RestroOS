import * as AdminService from "../services/AdminService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { branchMismatch, resolveBranchId } from "../utils/branchScope.js";

export const getAllAdmins = asyncHandler(async (req, res) => {

    const result = await AdminService.getAllAdmins(req.user.tenantId, resolveBranchId(req));

    return successResponse(res, result.data, result.message);

});

export const getOwnProfile = asyncHandler(async (req, res) => {

    const result = await AdminService.getAdminById(req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const updateOwnProfile = asyncHandler(async (req, res) => {

    const result = await AdminService.updateOwnProfile(req.user.id, req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const changeOwnPassword = asyncHandler(async (req, res) => {

    const { currentPassword, newPassword } = req.body;

    const result = await AdminService.changeOwnPassword(req.user.id, currentPassword, newPassword);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

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

    if (branchMismatch(req, result.data.BranchId)) {
        return errorResponse(res, "You are not authorized to view a staff member from another branch.", 403);
    }

    return successResponse(res, result.data, result.message);

});

export const createAdmin = asyncHandler(async (req, res) => {

    const result = await AdminService.createAdmin(req.body, req.user.tenantId, req.user.id);

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
