import * as IngredientService from "../services/IngredientService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getAllIngredients = asyncHandler(async (req, res) => {

    const result = await IngredientService.getAllIngredients(req.user.tenantId);

    return successResponse(res, result.data, result.message);

});

export const getIngredientById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await IngredientService.getIngredientById(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const createIngredient = asyncHandler(async (req, res) => {

    const result = await IngredientService.createIngredient(req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateIngredient = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await IngredientService.updateIngredient(id, req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});
