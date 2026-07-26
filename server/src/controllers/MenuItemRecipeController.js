import * as MenuItemRecipeService from "../services/MenuItemRecipeService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getRecipeForMenuItem = asyncHandler(async (req, res) => {

    const { menuItemId } = req.params;

    const result = await MenuItemRecipeService.getRecipeForMenuItem(menuItemId, req);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const replaceRecipe = asyncHandler(async (req, res) => {

    const { menuItemId } = req.params;

    const result = await MenuItemRecipeService.replaceRecipe(menuItemId, req.body.lines, req);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});
