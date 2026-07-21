import * as MenuOptionService from "../services/MenuOptionService.js";
import * as MenuOptionRepository from "../repositories/MenuOptionRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getGroupsForMenuItem = asyncHandler(async (req, res) => {

    const { menuItemId } = req.params;

    const result = await MenuOptionService.getGroupsForMenuItem(menuItemId);

    return successResponse(res, result.data, result.message);

});

export const createGroup = asyncHandler(async (req, res) => {

    const { menuItemId } = req.body;

    const tenantId = await MenuOptionRepository.getMenuItemTenantId(menuItemId);

    if (!tenantId || tenantId !== req.user.tenantId) {
        return errorResponse(res, "Menu item not found.", 404);
    }

    const result = await MenuOptionService.createGroup(req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateGroup = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await MenuOptionRepository.getGroupWithTenant(id);

    if (!existing || existing.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Option group not found.", 404);
    }

    const result = await MenuOptionService.updateGroup(id, req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deleteGroup = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await MenuOptionRepository.getGroupWithTenant(id);

    if (!existing || existing.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Option group not found.", 404);
    }

    const result = await MenuOptionService.deleteGroup(id);

    return successResponse(res, null, result.message);

});

export const createOption = asyncHandler(async (req, res) => {

    const { groupId } = req.params;

    const existing = await MenuOptionRepository.getGroupWithTenant(groupId);

    if (!existing || existing.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Option group not found.", 404);
    }

    const result = await MenuOptionService.createOption(groupId, req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateOption = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await MenuOptionRepository.getOptionWithTenant(id);

    if (!existing || existing.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Option not found.", 404);
    }

    const result = await MenuOptionService.updateOption(id, req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deleteOption = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await MenuOptionRepository.getOptionWithTenant(id);

    if (!existing || existing.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Option not found.", 404);
    }

    const result = await MenuOptionService.deleteOption(id);

    return successResponse(res, null, result.message);

});
