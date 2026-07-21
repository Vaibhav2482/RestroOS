import * as OrderRepository from "../repositories/OrderRepository.js";
import * as PaymentService from "../services/PaymentService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { branchMismatch } from "../utils/branchScope.js";

// Same tenant boundary as canAccessOrder in OrderController: order[0].TenantId
// (carried through the Branch join in OrderRepository.getOrderById) is what
// actually stops a tenant-owner admin from reaching another tenant's payment
// records - branchMismatch alone only restricts branch-scoped admins.
const canAccessOrderPayment = (req, order) => {

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

export const createPayment = asyncHandler(async (req, res) => {

    const order = await OrderRepository.getOrderById(req.body.orderId);

    if (!order || order.length === 0) {
        return errorResponse(res, "Order not found.", 404);
    }

    if (!canAccessOrderPayment(req, order[0])) {
        return errorResponse(res, "You are not authorized to pay for this order.", 403);
    }

    const result = await PaymentService.createPayment(req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const getPaymentByOrderId = asyncHandler(async (req, res) => {

    const { orderId } = req.params;

    const order = await OrderRepository.getOrderById(orderId);

    if (!order || order.length === 0) {
        return errorResponse(res, "Order not found.", 404);
    }

    if (!canAccessOrderPayment(req, order[0])) {
        return errorResponse(res, "You are not authorized to view this payment.", 403);
    }

    const result = await PaymentService.getPaymentByOrderId(orderId);

    if (!result.data || result.data.length === 0) {
        return errorResponse(res, "Payment not found.", 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getPaymentsByCustomer = asyncHandler(async (req, res) => {

    const { customerId } = req.params;

    if (String(req.user.id) === String(customerId) && req.user.role === "customer") {
        // self-access, always allowed
    } else if (req.user.role === "admin") {

        const customer = await CustomerRepository.getCustomerById(customerId);

        if (!customer || customer.TenantId !== req.user.tenantId) {
            return errorResponse(res, "You are not authorized to view this payment history.", 403);
        }

    } else {
        return errorResponse(res, "You are not authorized to view this payment history.", 403);
    }

    const result = await PaymentService.getPaymentsByCustomer(customerId);

    return successResponse(res, result.data, result.message);

});
