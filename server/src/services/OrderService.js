import { waitUntil } from "@vercel/functions";

import * as OrderRepository from "../repositories/OrderRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as PaymentService from "./PaymentService.js";
import * as NotificationService from "./NotificationService.js";

// Not awaited at any call site below - a slow WhatsApp/SMS/email provider
// must never make an order-placing/status-changing request hang. waitUntil
// (not a bare un-awaited call) is what actually matters here: this runs as
// a Vercel serverless function, which can freeze right after the response
// is sent, so the platform needs an explicit signal to keep the invocation
// alive until the notification finishes. The .catch is a safety net for
// errors outside NotificationService's own per-channel try/catch (e.g. the
// customer/order lookups it does internally).
const notifyInBackground = (promise, label) => {
    waitUntil(promise.catch((error) => console.error(`${label} failed: ${error.message}`)));
};

const VALID_DELIVERY_TYPES = ["Delivery", "Dine In", "Takeaway"];
const VALID_PAYMENT_METHODS = ["Cash", "Card", "UPI"];

const shapeOrder = (rows) => {

    if (!rows || rows.length === 0) {
        return null;
    }

    const { OrderItemId, MenuItemId, ItemName, Price, Quantity, TotalPrice, SelectedOptions, ...order } = rows[0];

    order.Items = rows.map((row) => ({
        OrderItemId: row.OrderItemId,
        MenuItemId: row.MenuItemId,
        ItemName: row.ItemName,
        Price: row.Price,
        Quantity: row.Quantity,
        TotalPrice: row.TotalPrice,
        SelectedOptions: row.SelectedOptions ?? []
    }));

    return order;

};

export const createOrder = async (order) => {

    if (!order.customerId) {
        return { success: false, message: "Customer Id is required." };
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
        return { success: false, message: "Order must contain at least one item." };
    }

    const deliveryType = order.deliveryType ?? "Delivery";

    if (!VALID_DELIVERY_TYPES.includes(deliveryType)) {
        return { success: false, message: "Invalid delivery type." };
    }

    if (deliveryType === "Dine In" && !order.tableNumber) {
        return { success: false, message: "Table number is required for dine-in orders." };
    }

    if (!order.paymentMethod || !VALID_PAYMENT_METHODS.includes(order.paymentMethod)) {
        return { success: false, message: "A valid payment method is required." };
    }

    try {

        const createdOrder = await OrderRepository.createOrder(order);

        await RealtimeService.publishOrderCreated(createdOrder);
        notifyInBackground(NotificationService.notifyOrderCreated(createdOrder), "notifyOrderCreated");

        return { success: true, message: "Order placed successfully.", data: createdOrder };

    } catch (error) {

        return { success: false, message: error.message };

    }

};

export const getActiveTableOrders = async (branchId) => {

    if (!branchId) {
        return { success: false, message: "Branch Id is required." };
    }

    const orders = await OrderRepository.getActiveTableOrders(branchId);

    return { success: true, message: "Active table orders fetched successfully.", data: orders };

};

export const getKitchenOrders = async (branchId) => {

    if (!branchId) {
        return { success: false, message: "Branch Id is required." };
    }

    const orders = await OrderRepository.getKitchenOrders(branchId);

    return { success: true, message: "Kitchen orders fetched successfully.", data: orders };

};

export const getAllOrders = async (tenantId, branchId) => {

    const orders = await OrderRepository.getAllOrders(tenantId, branchId);

    return { success: true, message: "Orders fetched successfully.", data: orders };

};

export const getOrderById = async (orderId) => {

    const rows = await OrderRepository.getOrderById(orderId);

    const order = shapeOrder(rows);

    if (!order) {
        return { success: false, message: "Order not found." };
    }

    return { success: true, message: "Order fetched successfully.", data: order };

};

export const getOrdersByCustomer = async (customerId) => {

    const orders = await OrderRepository.getOrdersByCustomer(customerId);

    return { success: true, message: "Orders fetched successfully.", data: orders };

};

export const updateOrderStatus = async (id, orderStatus) => {

    if (!orderStatus) {
        return { success: false, message: "Order status is required." };
    }

    try {

        const updatedOrder = await OrderRepository.updateOrderStatus(id, orderStatus);

        await RealtimeService.publishOrderStatusChanged(updatedOrder);
        notifyInBackground(NotificationService.notifyOrderStatusChanged(updatedOrder), "notifyOrderStatusChanged");

        return { success: true, message: "Order status updated successfully.", data: updatedOrder };

    } catch (error) {

        return { success: false, message: error.message };

    }

};

export const updateOrderItems = async (orderId, items) => {

    if (!Array.isArray(items) || items.length === 0) {
        return { success: false, message: "Order must contain at least one item." };
    }

    try {

        const updatedOrder = await OrderRepository.updateOrderItems(orderId, items);

        return { success: true, message: "Order items updated successfully.", data: updatedOrder };

    } catch (error) {

        return { success: false, message: error.message };

    }

};

export const cancelOrder = async (orderId) => {

    try {

        const cancelledOrder = await OrderRepository.cancelOrder(orderId);

        await RealtimeService.publishOrderStatusChanged(cancelledOrder);

        const refundResult = await PaymentService.refundPaymentForOrder(orderId);

        notifyInBackground(NotificationService.notifyOrderCancelled(cancelledOrder, refundResult.refunded), "notifyOrderCancelled");

        const message = refundResult.refunded
            ? "Order cancelled and payment refunded successfully."
            : refundResult.reason === "refund-api-failed"
                ? "Order cancelled, but the automatic refund failed - please refund manually via the Razorpay dashboard."
                : "Order cancelled successfully.";

        return { success: true, message, data: cancelledOrder };

    } catch (error) {

        return { success: false, message: error.message };

    }

};
