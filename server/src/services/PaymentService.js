import * as PaymentRepository from "../repositories/PaymentRepository.js";
import * as OrderRepository from "../repositories/OrderRepository.js";

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
