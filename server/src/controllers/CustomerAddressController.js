import * as CustomerAddressService from "../services/CustomerAddressService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { canActOnCustomer } from "../utils/customerScope.js";

export const createCustomerAddress = asyncHandler(async (req, res) => {

    if (!(await canActOnCustomer(req, req.body.customerId))) {
        return errorResponse(res, "You are not authorized to add an address for another customer.", 403);
    }

    const result = await CustomerAddressService.createCustomerAddress(req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const getCustomerAddresses = asyncHandler(async (req, res) => {

    const { customerId } = req.params;

    if (!(await canActOnCustomer(req, customerId))) {
        return errorResponse(res, "You are not authorized to view these addresses.", 403);
    }

    const result = await CustomerAddressService.getCustomerAddresses(customerId);

    return successResponse(res, result.data, result.message);

});

export const updateCustomerAddress = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingAddress = await CustomerAddressService.getCustomerAddressById(id);

    if (!existingAddress) {
        return errorResponse(res, "Address not found.", 404);
    }

    if (!(await canActOnCustomer(req, existingAddress.CustomerId))) {
        return errorResponse(res, "You are not authorized to update this address.", 403);
    }

    const result = await CustomerAddressService.updateCustomerAddress(id, req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const deleteCustomerAddress = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existingAddress = await CustomerAddressService.getCustomerAddressById(id);

    if (!existingAddress) {
        return errorResponse(res, "Address not found.", 404);
    }

    if (!(await canActOnCustomer(req, existingAddress.CustomerId))) {
        return errorResponse(res, "You are not authorized to delete this address.", 403);
    }

    const result = await CustomerAddressService.deleteCustomerAddress(id, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, null, result.message);

});
