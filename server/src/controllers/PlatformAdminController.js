import jwt from "jsonwebtoken";
import * as PlatformAdminService from "../services/PlatformAdminService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const login = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    const result = await PlatformAdminService.login(email, password);

    if (!result.success) {
        return errorResponse(res, result.message, 401);
    }

    const token = jwt.sign(
        { id: result.data.PlatformAdminId, role: "platform_admin", email: result.data.Email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return successResponse(res, { ...result.data, token }, result.message);

});

export const bootstrap = asyncHandler(async (req, res) => {

    const result = await PlatformAdminService.bootstrapFirstAdmin(req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});
