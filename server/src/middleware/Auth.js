import jwt from "jsonwebtoken";
import { errorResponse } from "../utils/ApiResponse.js";

// JWT payload shape across the platform: { id, role, tenantId }.
// role: "platform_admin" (no tenantId - manages all tenants) | "admin"
// (tenant-scoped restaurant staff, added in a later phase) | "customer".
export const authenticate = (req, res, next) => {

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return errorResponse(res, "Authentication token is required.", 401);
    }

    const token = header.slice("Bearer ".length);

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch (error) {
        return errorResponse(res, "Invalid or expired token.", 401);
    }

};

export const authorize = (...roles) => (req, res, next) => {

    if (!req.user || !roles.includes(req.user.role)) {
        return errorResponse(res, "You are not authorized to perform this action.", 403);
    }

    return next();

};
