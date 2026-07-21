import jwt from "jsonwebtoken";
import * as CustomerAuthService from "../services/CustomerAuthService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const register = asyncHandler(async (req, res) => {

    const { tenantSlug, ...customer } = req.body;

    const result = await CustomerAuthService.register(tenantSlug, customer);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const login = asyncHandler(async (req, res) => {

    const { tenantSlug, email, password } = req.body;

    const result = await CustomerAuthService.login(tenantSlug, email, password);

    if (!result.success) {
        return errorResponse(res, result.message, 401);
    }

    const token = jwt.sign(
        { id: result.data.CustomerId, role: "customer", tenantId: result.data.TenantId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return successResponse(res, { ...result.data, token }, result.message);

});
