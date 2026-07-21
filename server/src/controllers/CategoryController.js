import * as CategoryService from "../services/CategoryService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

// Public - customer storefront browsing a tenant's menu, resolved by slug
// since there's no admin JWT to derive a tenant from at this call site.
export const getPublicCategories = asyncHandler(async (req, res) => {

    const result = await CategoryService.getAllCategoriesByTenantSlug(req.query.tenant);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

// Admin - tenant resolved from the caller's JWT, not a query param.
export const getAllCategories = asyncHandler(async (req, res) => {

    const result = await CategoryService.getAllCategories(req.user.tenantId);

    return successResponse(res, result.data, result.message);

});

export const getCategoryById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await CategoryService.getCategoryById(id, req.user?.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const createCategory = asyncHandler(async (req, res) => {

    const result = await CategoryService.createCategory(req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateCategory = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await CategoryService.updateCategory(id, req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deleteCategory = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await CategoryService.deleteCategory(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, null, result.message);

});
