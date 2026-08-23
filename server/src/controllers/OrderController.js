import * as OrderService from "../services/OrderService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { resolveBranchId, branchMismatch, assertBranchBelongsToTenant } from "../utils/branchScope.js";
import { canActOnCustomer } from "../utils/customerScope.js";

// An order's real tenant boundary is its Branch's TenantId - branchMismatch
// alone only restricts branch-scoped admins, so a tenant owner (no branchId
// on their token) needs this explicit tenant check too, or they could reach
// into another tenant's orders just by guessing an OrderId.
const canAccessOrder = (req, order) => {

    if (req.user.role === "customer") {
        return String(order.CustomerId) === String(req.user.id);
    }

    if (req.user.role !== "admin") {
        return false;
    }

    if (order.TenantId !== req.user.tenantId) {
        return false;
    }

    return !branchMismatch(req, order.BranchId);

};

export const createOrder = asyncHandler(async (req, res) => {

    if (!(await canActOnCustomer(req, req.body.customerId))) {
        return errorResponse(res, "You are not authorized to place this order.", 403);
    }

    // Attributed to the staff member who actually rang it up - never trusted
    // from the request body, only from the authenticated token, so it can't
    // be spoofed or left blank by the client. Stays null for the (currently
    // unused by any client) case of a customer hitting this route directly -
    // there's no admin to credit, and none should be invented.
    const createdByAdminId = req.user.role === "admin" ? req.user.id : null;

    const result = await OrderService.createOrder({ ...req.body, createdByAdminId });

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const getActiveTableOrders = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (!branchId) {
        return errorResponse(res, "Branch Id is required.", 400);
    }

    if (!(await assertBranchBelongsToTenant(branchId, req.user.tenantId))) {
        return errorResponse(res, "Branch not found.", 404);
    }

    const result = await OrderService.getActiveTableOrders(branchId);

    return successResponse(res, result.data, result.message);

});

export const getKitchenOrders = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (!branchId) {
        return errorResponse(res, "Branch Id is required.", 400);
    }

    if (!(await assertBranchBelongsToTenant(branchId, req.user.tenantId))) {
        return errorResponse(res, "Branch not found.", 404);
    }

    const result = await OrderService.getKitchenOrders(branchId);

    return successResponse(res, result.data, result.message);

});

// A page/limit pair is opt-in: only present when the caller actually sent
// both. Absent either one, getAllOrders keeps returning the full array it
// always has - existing callers (storefront's own order history, POS)
// don't have to change to keep working.
const MAX_PAGE_SIZE = 100;

const resolvePagination = (req) => {

    if (req.query.page === undefined && req.query.limit === undefined) {
        return null;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || 25));

    return { page, limit };

};

export const getAllOrders = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (branchId && !(await assertBranchBelongsToTenant(branchId, req.user.tenantId))) {
        return errorResponse(res, "Branch not found.", 404);
    }

    // No extra ownership check needed - the repository query already scopes
    // every row to req.user.tenantId, so a customerId from another tenant
    // just yields zero rows rather than leaking across tenants.
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const pagination = resolvePagination(req);

    const result = await OrderService.getAllOrders(req.user.tenantId, branchId, customerId, pagination);

    return successResponse(res, result.data, result.message);

});

export const getDashboardSummary = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (branchId && !(await assertBranchBelongsToTenant(branchId, req.user.tenantId))) {
        return errorResponse(res, "Branch not found.", 404);
    }

    const result = await OrderService.getDashboardSummary(req.user.tenantId, branchId);

    return successResponse(res, result.data, result.message);

});

export const getOrderById = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const result = await OrderService.getOrderById(id);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    if (!canAccessOrder(req, result.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getOrdersByCustomer = asyncHandler(async (req, res) => {

    const { customerId } = req.params;

    if (!(await canActOnCustomer(req, customerId))) {
        return errorResponse(res, "You are not authorized to view these orders.", 403);
    }

    const result = await OrderService.getOrdersByCustomer(customerId);

    return successResponse(res, result.data, result.message);

});

export const updateOrderStatus = asyncHandler(async (req, res) => {

    const { id } = req.params;
    const { orderStatus } = req.body;

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.updateOrderStatus(id, orderStatus);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const updateOrderItems = asyncHandler(async (req, res) => {

    const { id } = req.params;
    const { items } = req.body;

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.updateOrderItems(id, items);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const emailBill = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.emailBill(id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

// Self-service only, unlike every other single-order action above -
// reordering always targets the requesting customer's OWN cart, so there's
// no legitimate case for an admin to trigger this on a customer's behalf
// the way they can view/cancel an order for support purposes.
export const reorderOrder = asyncHandler(async (req, res) => {

    const { id } = req.params;

    if (req.user.role !== "customer") {
        return errorResponse(res, "Only a customer can reorder their own order.", 403);
    }

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.reorderOrder(id, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const cancelOrder = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.cancelOrder(id, req.user.role, req.user.id, req.user.tenantId, req.body.reason);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

// Staff-only - refunds without cancelling the order (e.g. a partial goodwill
// refund). requirePermission("manage_orders") in OrderRoutes already keeps
// customers out of this route entirely.
export const refundOrder = asyncHandler(async (req, res) => {

    const { id } = req.params;
    const { amount, reason } = req.body;

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.refundOrder(id, req.user.id, req.user.tenantId, amount, reason);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const getOrderAdjustments = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.getAdjustmentsForOrder(id);

    return successResponse(res, result.data, result.message);

});
