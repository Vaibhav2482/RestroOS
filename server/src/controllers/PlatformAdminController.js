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

    // Deliberately shorter than the 7d default used for admin/customer
    // tokens (JWT_EXPIRES_IN) - this is the single most privileged role in
    // the whole platform (cross-tenant access), so a stolen token should
    // have a much smaller window to be useful. A separate env var rather
    // than reusing JWT_EXPIRES_IN so this can't silently drift back to 7d
    // if that variable is ever changed for the other two roles.
    const token = jwt.sign(
        { id: result.data.PlatformAdminId, role: "platform_admin", email: result.data.Email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.PLATFORM_ADMIN_JWT_EXPIRES_IN || "24h" }
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
