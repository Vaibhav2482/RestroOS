import * as CustomerService from "../services/CustomerService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

const assertOwnRecordOrAdmin = (req, id) =>
    req.user.role === "admin" || String(req.user.id) === String(id);

export const getCustomerById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    if (!assertOwnRecordOrAdmin(req, id)) {
        return errorResponse(res, "You are not authorized to view this customer.", 403);
    }

    const result = await CustomerService.getCustomerById(id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    if (req.user.role !== "admin" && result.data.TenantId !== req.user.tenantId) {
        return errorResponse(res, "Customer not found.", 404);
    }

    return successResponse(res, result.data, result.message);

});

export const updateCustomer = asyncHandler(async (req, res) => {

    const { id } = req.params;

    if (!assertOwnRecordOrAdmin(req, id)) {
        return errorResponse(res, "You are not authorized to update this customer.", 403);
    }

    const result = await CustomerService.updateCustomer(id, req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getAllCustomers = asyncHandler(async (req, res) => {

    const result = await CustomerService.getAllCustomers(req.user.tenantId);

    return successResponse(res, result.data, result.message);

});
