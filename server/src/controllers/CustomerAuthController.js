import jwt from "jsonwebtoken";
import * as CustomerAuthService from "../services/CustomerAuthService.js";
import * as CustomerService from "../services/CustomerService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

const signCustomerToken = (customer) =>
    jwt.sign(
        { id: customer.CustomerId, role: "customer", tenantId: customer.TenantId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

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

    const token = signCustomerToken(result.data);

    return successResponse(res, { ...result.data, token }, result.message);

});

// Silently provisions a disposable Customer row so a storefront visitor can
// browse/customize/add-to-cart without hitting a registration form first -
// the wall a customer used to hit before they could even open an item's
// customization dialog. Public (no existing session required); rate-limited
// the same as register to bound how many rows a script could churn out.
export const guestSession = asyncHandler(async (req, res) => {

    const { tenantSlug } = req.body;

    const result = await CustomerService.createGuestSession(tenantSlug);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    const token = signCustomerToken(result.data);

    return successResponse(res, { ...result.data, token }, result.message, 201);

});
