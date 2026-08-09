import crypto from "crypto";

import * as OrderRepository from "../repositories/OrderRepository.js";
import * as PaymentService from "../services/PaymentService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { branchMismatch } from "../utils/branchScope.js";

// PaymentService.createRazorpayOrder sets `receipt` to exactly this shape -
// how the webhook maps Razorpay's order back to ours without needing a new
// column to store the Razorpay order id on our Orders table.
const RECEIPT_PATTERN = /^restroos_order_(\d+)$/;

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

export const createRazorpayOrder = asyncHandler(async (req, res) => {

    const { orderId } = req.body;

    const order = await OrderRepository.getOrderById(orderId);

    if (!order || order.length === 0) {
        return errorResponse(res, "Order not found.", 404);
    }

    if (!canAccessOrderPayment(req, order[0])) {
        return errorResponse(res, "You are not authorized to pay for this order.", 403);
    }

    const result = await PaymentService.createRazorpayOrder(orderId);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {

    const { orderId } = req.body;

    const order = await OrderRepository.getOrderById(orderId);

    if (!order || order.length === 0) {
        return errorResponse(res, "Order not found.", 404);
    }

    if (!canAccessOrderPayment(req, order[0])) {
        return errorResponse(res, "You are not authorized to pay for this order.", 403);
    }

    const result = await PaymentService.verifyRazorpayPayment(req.body);

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

// Mounted directly in app.js with express.raw() body parsing, ahead of
// PaymentRoutes.js's authenticate/authorize gate and express.json() - this
// is called by Razorpay's own servers, which can't carry a customer/admin
// Bearer token, and signature verification needs the exact raw request
// bytes rather than a re-serialized parsed body.
export const razorpayWebhook = asyncHandler(async (req, res) => {

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
        // Not configured - ack with 200 anyway so Razorpay doesn't queue
        // endless retries for a merchant who hasn't set this up yet; the
        // client-side verifyRazorpayPayment path is still the primary one.
        return res.status(200).send("Webhook not configured.");
    }

    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body;

    if (!signature || !Buffer.isBuffer(rawBody)) {
        return res.status(400).send("Missing signature or body.");
    }

    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    if (expectedSignature !== signature) {
        return res.status(400).send("Invalid signature.");
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    // order.paid fires once, when the order's full amount is captured, and
    // is the one event that carries both the order (with our receipt) and
    // the payment together - payment.captured alone only carries Razorpay's
    // own order id, not our receipt.
    if (event.event !== "order.paid") {
        return res.status(200).send("Ignored.");
    }

    const orderEntity = event.payload?.order?.entity;
    const paymentEntity = event.payload?.payment?.entity;
    const receiptMatch = orderEntity?.receipt?.match(RECEIPT_PATTERN);

    if (!receiptMatch || !paymentEntity) {
        return res.status(200).send("No matching order.");
    }

    await PaymentService.recordRazorpayWebhookPayment({
        orderId: Number(receiptMatch[1]),
        transactionId: paymentEntity.id,
        amount: paymentEntity.amount / 100
    });

    return res.status(200).send("ok");

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
