import * as OrderService from "../services/OrderService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { resolveBranchId, branchMismatch } from "../utils/branchScope.js";

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

const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};

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

    const result = await OrderService.createOrder(req.body);

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

export const getAllOrders = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (branchId && !(await assertBranchBelongsToTenant(branchId, req.user.tenantId))) {
        return errorResponse(res, "Branch not found.", 404);
    }

    const result = await OrderService.getAllOrders(req.user.tenantId, branchId);

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

export const cancelOrder = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const existing = await OrderService.getOrderById(id);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessOrder(req, existing.data)) {
        return errorResponse(res, "Order not found.", 404);
    }

    const result = await OrderService.cancelOrder(id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});
