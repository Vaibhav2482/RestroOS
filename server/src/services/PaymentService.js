import crypto from "crypto";

import * as PaymentRepository from "../repositories/PaymentRepository.js";
import * as OrderRepository from "../repositories/OrderRepository.js";
import { getRazorpayClient } from "../config/razorpay.js";

export const createPayment = async (payment) => {

    if (!payment.orderId) {
        return { success: false, message: "Order Id is required." };
    }

    if (!payment.paymentMethod || payment.paymentMethod.trim() === "") {
        return { success: false, message: "Payment Method is required." };
    }

    if (payment.amount === undefined || payment.amount === null || payment.amount <= 0) {
        return { success: false, message: "Amount must be greater than zero." };
    }

    const order = await OrderRepository.getOrderById(payment.orderId);

    if (!order || order.length === 0) {
        return { success: false, message: "Order not found." };
    }

    const orderTotal = Number(order[0].TotalAmount);

    if (Number(payment.amount) !== orderTotal) {
        return { success: false, message: `Payment amount does not match the order total of ${orderTotal}.` };
    }

    const createdPayment = await PaymentRepository.createPayment(payment);

    return { success: true, message: "Payment created successfully.", data: createdPayment };

};

export const getPaymentByOrderId = async (orderId) => {

    const payments = await PaymentRepository.getPaymentByOrderId(orderId);

    return { success: true, message: "Payment fetched successfully.", data: payments };

};

export const getPaymentsByCustomer = async (customerId) => {

    const payments = await PaymentRepository.getPaymentsByCustomer(customerId);

    return { success: true, message: "Payment history fetched successfully.", data: payments };

};

// Demo/test-mode Razorpay flow: create a Razorpay order for the amount already
// committed on the RestroOS order, then verify the signature Razorpay returns.
// A "Pending" Payments row is written the moment the Razorpay order exists -
// not just on a successful verify - so there's a real record of every
// attempt (including one that's abandoned or declined) from the start. The
// verify/webhook paths below update this same row rather than inserting a
// fresh one for every state a single attempt passes through.
export const createRazorpayOrder = async (orderId) => {

    const razorpay = getRazorpayClient();

    if (!razorpay) {
        return { success: false, message: "Razorpay is not configured on this server yet." };
    }

    const order = await OrderRepository.getOrderById(orderId);

    if (!order || order.length === 0) {
        return { success: false, message: "Order not found." };
    }

    const amount = Number(order[0].TotalAmount);

    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `restroos_order_${orderId}`
    });

    await PaymentRepository.createPayment({
        orderId,
        paymentMethod: order[0].PaymentMethod,
        amount,
        paymentStatus: "Pending",
        razorpayOrderId: razorpayOrder.id
    });

    return {
        success: true,
        message: "Razorpay order created successfully.",
        data: {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        }
    };

};

// Called when the checkout widget reports payment.failed, or the customer
// dismisses it without paying - the client-side, immediate counterpart to
// recordFailedRazorpayWebhookPayment below (which is the async backstop for
// when the browser closes before either handler fires). orderId is passed
// so a caller can't mark an arbitrary razorpayOrderId's payment failed -
// the row must actually belong to the order they're allowed to act on
// (checked by the controller's canAccessOrderPayment before this is called).
export const recordFailedRazorpayAttempt = async (orderId, razorpayOrderId) => {

    const payment = await PaymentRepository.getPaymentByRazorpayOrderId(razorpayOrderId);

    if (!payment || String(payment.OrderId) !== String(orderId)) {
        return { success: false, message: "No matching payment attempt found for this order." };
    }

    const updated = await PaymentRepository.markPaymentFailedIfPending(razorpayOrderId);

    // Already Paid (e.g. a retry succeeded moments earlier) or already
    // Failed - either way, not an error, just nothing left to do.
    return { success: true, message: "Payment attempt recorded.", data: updated ?? payment };

};

// Called when an order is cancelled (full refund, the two defaults below),
// and also by OrderService.refundOrder for a manual partial/full refund that
// doesn't cancel the order - amount and resultingStatus let that second
// caller refund less than the full payment and land on "Partially Refunded"
// rather than "Refunded". Best-effort: a failed or unavailable refund
// attempt must never block the cancellation itself (kitchen needs to stop
// preparing regardless) - callers surface `refunded: false` instead of
// losing the order state change over it.
export const refundPaymentForOrder = async (orderId, amount, resultingStatus = "Refunded") => {

    const payments = await PaymentRepository.getPaymentByOrderId(orderId);

    // Includes an already-partially-refunded payment, not just a fresh
    // "Paid" one - a second partial refund on the same order needs to find
    // it too, not just the first.
    const payment = payments.find((row) => row.PaymentStatus === "Paid" || row.PaymentStatus === "Partially Refunded");

    if (!payment) {
        return { refunded: false, reason: "no-payment-to-refund" };
    }

    const refundAmount = amount ?? Number(payment.Amount);

    if (payment.PaymentMethod === "Cash") {
        return { refunded: false, reason: "cash-payment", payment, amount: refundAmount };
    }

    const razorpay = getRazorpayClient();

    if (!razorpay) {
        return { refunded: false, reason: "not-configured", payment, amount: refundAmount };
    }

    // Distinct from the server having no Razorpay client at all - this
    // payment simply never went through Razorpay in the first place (an
    // in-person Card/UPI sale, e.g. a staff-created POS order), so there's
    // nothing to refund via the gateway. Callers treat this like a Cash
    // refund - handled outside the system, not a real failure.
    if (!payment.TransactionId) {
        return { refunded: false, reason: "no-online-transaction", payment, amount: refundAmount };
    }

    try {

        await razorpay.payments.refund(payment.TransactionId, {
            amount: Math.round(refundAmount * 100)
        });

        await PaymentRepository.updatePaymentStatus(payment.PaymentId, resultingStatus);

        return { refunded: true, payment, amount: refundAmount };

    } catch (error) {

        console.error(`Refund failed for order ${orderId}: ${error.message}`);

        return { refunded: false, reason: "refund-api-failed", payment, amount: refundAmount };

    }

};

// Called from the Razorpay webhook (razorpayWebhook in PaymentController.js),
// never directly from a client request. This exists because
// verifyRazorpayPayment below is only ever reached if the customer's
// browser stays online long enough to call it after paying - a dropped
// connection, closed tab, or crashed app right after a successful payment
// would otherwise leave a paid order with no Payments row at all. The
// webhook is Razorpay's own server telling us payment succeeded, independent
// of whether the client ever calls back. Updates the same Pending row
// createRazorpayOrder wrote - an UPDATE is naturally idempotent against
// Razorpay's own retry-until-2xx behavior and against racing the
// client-side verify path, so no duplicate-check/unique-violation dance is
// needed here anymore.
export const recordRazorpayWebhookPayment = async ({ orderId, razorpayOrderId, transactionId, amount }) => {

    const order = await OrderRepository.getOrderById(orderId);

    if (!order || order.length === 0) {
        console.error(`Razorpay webhook: order ${orderId} (from receipt) not found.`);
        return;
    }

    const updated = await PaymentRepository.updatePaymentByRazorpayOrderId(razorpayOrderId, {
        paymentStatus: "Paid",
        transactionId
    });

    // No Pending row found (shouldn't happen via the normal flow, since
    // createRazorpayOrder always writes one first) - fall back to inserting
    // one directly rather than silently dropping a real payment.
    if (!updated) {

        await PaymentRepository.createPayment({
            orderId,
            paymentMethod: order[0].PaymentMethod,
            amount,
            paymentStatus: "Paid",
            transactionId,
            razorpayOrderId
        });

    }

};

// Webhook counterpart to recordFailedRazorpayAttempt above - the async
// backstop for when the customer's browser closes before either the
// payment.failed or modal-dismiss client handler fires. Razorpay's
// payment.failed payload only carries its own order id (payload.payment.entity.order_id),
// not our receipt, which is exactly why this is keyed by razorpayOrderId
// rather than reusing the receipt-matching path order.paid uses.
export const recordFailedRazorpayWebhookPayment = async (razorpayOrderId) => {
    await PaymentRepository.markPaymentFailedIfPending(razorpayOrderId);
};

export const verifyRazorpayPayment = async (payment) => {

    const { orderId, paymentMethod, razorpayOrderId, razorpayPaymentId, razorpaySignature } = payment;

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return { success: false, message: "Missing Razorpay payment details." };
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
        return { success: false, message: "Razorpay is not configured on this server yet." };
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    if (expectedSignature !== razorpaySignature) {
        return { success: false, message: "Payment verification failed." };
    }

    const order = await OrderRepository.getOrderById(orderId);

    if (!order || order.length === 0) {
        return { success: false, message: "Order not found." };
    }

    const updated = await PaymentRepository.updatePaymentByRazorpayOrderId(razorpayOrderId, {
        paymentStatus: "Paid",
        transactionId: razorpayPaymentId
    });

    // No Pending row found (shouldn't happen - createRazorpayOrder always
    // writes one first) - fall back to inserting directly rather than
    // failing a payment that already passed signature verification.
    const recordedPayment = updated ?? await PaymentRepository.createPayment({
        orderId,
        paymentMethod: paymentMethod || "Razorpay",
        amount: Number(order[0].TotalAmount),
        paymentStatus: "Paid",
        transactionId: razorpayPaymentId,
        razorpayOrderId
    });

    return { success: true, message: "Payment verified and recorded successfully.", data: recordedPayment };

};
