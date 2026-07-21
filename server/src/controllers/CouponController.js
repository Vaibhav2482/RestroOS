import * as CouponService from "../services/CouponService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const getAllCoupons = asyncHandler(async (req, res) => {

    const result = await CouponService.getAllCoupons(req.user.tenantId);

    return successResponse(res, result.data, result.message);

});

export const createCoupon = asyncHandler(async (req, res) => {

    const result = await CouponService.createCoupon(req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const updateCoupon = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await CouponService.updateCoupon(id, req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deactivateCoupon = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await CouponService.deactivateCoupon(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, null, result.message);

});

const canActOnCustomer = async (req, customerId) => {

    if (String(req.user.id) === String(customerId) && req.user.role === "customer") {
        return true;
    }

    if (req.user.role !== "admin") {
        return false;
    }

    const customer = await CustomerRepository.getCustomerById(customerId);

    return Boolean(customer && customer.TenantId === req.user.tenantId);

};

export const previewCoupon = asyncHandler(async (req, res) => {

    const { code, customerId, subtotal } = req.body;

    if (!(await canActOnCustomer(req, customerId))) {
        return errorResponse(res, "You are not authorized to preview a coupon for this customer.", 403);
    }

    const result = await CouponService.previewCoupon(req.user.tenantId, code, customerId, Number(subtotal));

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});
