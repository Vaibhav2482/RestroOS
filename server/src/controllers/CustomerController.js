import * as CustomerService from "../services/CustomerService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

// A page/limit pair is opt-in - same pattern as OrderController's own
// resolvePagination - only present when the caller actually sent both.
// Absent either one, getAllCustomers keeps returning the full array it
// always has.
const MAX_PAGE_SIZE = 100;

const resolvePagination = (req) => {

    if (req.query.page === undefined && req.query.limit === undefined) {
        return null;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || 25));

    return { page, limit };

};

// Self-access is always tenant-safe (a customer's own record already belongs
// to their own tenant). Admin access is NOT automatically tenant-safe - it
// must be checked against the fetched record's TenantId explicitly, or any
// admin from any tenant could reach any other tenant's customers.
const canAccessCustomer = (req, customer) => {

    if (req.user.role === "customer") {
        return String(req.user.id) === String(customer.CustomerId);
    }

    return req.user.role === "admin" && customer.TenantId === req.user.tenantId;

};

export const getCustomerById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await CustomerService.getCustomerById(id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    if (!canAccessCustomer(req, result.data)) {
        return errorResponse(res, "Customer not found.", 404);
    }

    return successResponse(res, result.data, result.message);

});

export const updateCustomer = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await CustomerService.getCustomerById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessCustomer(req, existing.data)) {
        return errorResponse(res, "Customer not found.", 404);
    }

    const result = await CustomerService.updateCustomer(id, req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

// Password changes are exclusively self-service, unlike getCustomerById/
// updateCustomer above which an admin can also reach for the same tenant's
// customers (POS/support lookups) - canAccessCustomer is intentionally not
// reused here.
export const changePassword = asyncHandler(async (req, res) => {

    const { id } = req.params;

    if (req.user.role !== "customer" || String(req.user.id) !== String(id)) {
        return errorResponse(res, "You can only change your own password.", 403);
    }

    const { currentPassword, newPassword } = req.body;

    const result = await CustomerService.changeOwnPassword(id, currentPassword, newPassword);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const getAllCustomers = asyncHandler(async (req, res) => {

    const pagination = resolvePagination(req);
    const filters = pagination ? { search: req.query.search || null } : null;

    const result = await CustomerService.getAllCustomers(req.user.tenantId, pagination, filters);

    return successResponse(res, result.data, result.message);

});

export const getOrCreateGuestCustomer = asyncHandler(async (req, res) => {

    const result = await CustomerService.getOrCreateGuestCustomer(req.user.tenantId);

    return successResponse(res, result.data, result.message);

});

export const findOrCreateWalkInCustomer = asyncHandler(async (req, res) => {

    const result = await CustomerService.findOrCreateWalkInCustomer(req.body, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});
