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
// committed on the RestroOS order, then verify the signature Razorpay returns
// before recording a Payment - the Payments row is only ever written after
// signature verification succeeds, so an unpaid checkout can't be recorded as Paid.
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

    const createdPayment = await PaymentRepository.createPayment({
        orderId,
        paymentMethod: paymentMethod || "Razorpay",
        amount: Number(order[0].TotalAmount),
        paymentStatus: "Paid",
        transactionId: razorpayPaymentId
    });

    return { success: true, message: "Payment verified and recorded successfully.", data: createdPayment };

};
