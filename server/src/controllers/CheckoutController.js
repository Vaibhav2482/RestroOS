import * as CheckoutService from "../services/CheckoutService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const checkout = asyncHandler(async (req, res) => {

    if (String(req.user.id) !== String(req.body.customerId)) {
        return errorResponse(res, "You are not authorized to checkout for another customer.", 403);
    }

    const result = await CheckoutService.checkout(req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});
