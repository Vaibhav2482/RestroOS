import jwt from "jsonwebtoken";
import * as AdminAuthService from "../services/AdminAuthService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const login = asyncHandler(async (req, res) => {

    const { tenantSlug, email, password } = req.body;

    const result = await AdminAuthService.login(tenantSlug, email, password);

    if (!result.success) {
        return errorResponse(res, result.message, 401);
    }

    const token = jwt.sign(
        {
            id: result.data.AdminId,
            role: "admin",
            tenantId: result.data.TenantId,
            branchId: result.data.BranchId
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return successResponse(res, { ...result.data, token }, result.message);

});
