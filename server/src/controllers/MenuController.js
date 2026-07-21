import * as MenuService from "../services/MenuService.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { resolveBranchId, isBranchAdmin, branchMismatch } from "../utils/branchScope.js";

export const getAllMenuItems = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    const result = await MenuService.getAllMenuItems(branchId, req.user?.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const getMenuItemById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await MenuService.getMenuItemById(id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getRecommendations = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await MenuService.getRecommendations(id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const createMenuItem = asyncHandler(async (req, res) => {

    const branchId = isBranchAdmin(req) ? req.user.branchId : req.body.branchId;

    const result = await MenuService.createMenuItem({ ...req.body, branchId }, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

const assertOwnTenant = async (req, branchId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === req.user.tenantId);

};

export const updateMenuItem = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingMenuItem = await MenuService.getMenuItemById(id);

    if (!existingMenuItem.success) {
        return errorResponse(res, existingMenuItem.message, 404);
    }

    if (branchMismatch(req, existingMenuItem.data.BranchId) || !(await assertOwnTenant(req, existingMenuItem.data.BranchId))) {
        return errorResponse(res, "You are not authorized to update a menu item from another branch.", 403);
    }

    const result = await MenuService.updateMenuItem(id, req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deleteMenuItem = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingMenuItem = await MenuService.getMenuItemById(id);

    if (!existingMenuItem.success) {
        return errorResponse(res, existingMenuItem.message, 404);
    }

    if (branchMismatch(req, existingMenuItem.data.BranchId) || !(await assertOwnTenant(req, existingMenuItem.data.BranchId))) {
        return errorResponse(res, "You are not authorized to delete a menu item from another branch.", 403);
    }

    const result = await MenuService.deleteMenuItem(id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, null, result.message);

});
