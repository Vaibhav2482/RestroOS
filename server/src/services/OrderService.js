import { waitUntil } from "@vercel/functions";

import * as OrderRepository from "../repositories/OrderRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as PaymentService from "./PaymentService.js";
import * as NotificationService from "./NotificationService.js";
import * as InventoryService from "./InventoryService.js";
import * as AuditService from "./AuditService.js";
import * as CartService from "./CartService.js";

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

export const getAllOrders = async (tenantId, branchId, customerId) => {

    const orders = await OrderRepository.getAllOrders(tenantId, branchId, customerId);

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

// On-demand - the controller has already checked the order exists and the
// caller (customer or admin) is allowed to see it, same as any other
// single-order action, so this just needs the order itself to hand to
// NotificationService.
export const emailBill = async (orderId) => {

    const rows = await OrderRepository.getOrderById(orderId);
    const order = shapeOrder(rows);

    if (!order) {
        return { success: false, message: "Order not found." };
    }

    return NotificationService.emailBill(order);

};

export const getOrdersByCustomer = async (customerId) => {

    const orders = await OrderRepository.getOrdersByCustomer(customerId);

    return { success: true, message: "Orders fetched successfully.", data: orders };

};

// Re-adds every item from a past order to the customer's cart - a Zomato/
// Swiggy staple. Each item's stored SelectedOptions snapshot already
// includes the original OptionIds (menuOptionResolver.js saves them, not
// just display names), so a customized item can be reordered exactly, not
// just its base item. Items are added one at a time via CartService (full
// validation reused, not duplicated) rather than in bulk, so one
// unavailable item (deactivated since the original order) or an option
// group that's since changed doesn't block the rest - it's just skipped
// and reported, the same way Swiggy silently drops items that are no
// longer on the menu when you reorder.
export const reorderOrder = async (orderId, customerId) => {

    const rows = await OrderRepository.getOrderById(orderId);
    const order = shapeOrder(rows);

    if (!order || String(order.CustomerId) !== String(customerId)) {
        return { success: false, message: "Order not found." };
    }

    let addedCount = 0;
    const skippedItems = [];

    for (const item of order.Items) {

        const result = await CartService.addToCart({
            customerId,
            menuItemId: item.MenuItemId,
            quantity: item.Quantity,
            selectedOptionIds: (item.SelectedOptions || []).map((option) => option.OptionId)
        });

        if (result.success) {
            addedCount += 1;
        } else {
            skippedItems.push(item.ItemName);
        }

    }

    if (addedCount === 0) {

        return {
            success: false,
            message: "Couldn't add any items to your cart - they may no longer be available, or your cart already has items from a different branch."
        };

    }

    return {
        success: true,
        message: skippedItems.length === 0
            ? "All items added to your cart."
            : `${addedCount} item${addedCount === 1 ? "" : "s"} added. ${skippedItems.length} no longer available: ${skippedItems.join(", ")}.`,
        data: { addedCount, skippedItems }
    };

};

export const updateOrderStatus = async (id, orderStatus) => {

    if (!orderStatus) {
        return { success: false, message: "Order status is required." };
    }

    try {

        // Fires once the order reaches "Preparing" *or anything past it* - not
        // only on an exact match. Status is allowed to jump forward several
        // steps at a time, so marking a Pending order straight to Ready used
        // to skip this hook entirely and the order could reach Delivered
        // having never deducted a gram of stock. consumeForOrder is
        // idempotent (it checks for existing rows against the order under a
        // row lock), so firing it on each later transition is safe.
        const updatedOrder = await OrderRepository.updateOrderStatus(id, orderStatus, async (client, order) => {

            if (OrderRepository.hasStartedPreparing(order.OrderStatus, order.DeliveryType)) {
                await InventoryService.consumeForOrder(client, order.OrderId, order.BranchId);
            }

        });

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

// FRS A4: a customer's cancellation window stops at Accepted - once the
// kitchen has started (Preparing), only staff can still call it off.
const CUSTOMER_CANCELLABLE_STATUSES = ["Pending", "Accepted"];
const STAFF_CANCELLABLE_STATUSES = ["Pending", "Accepted", "Preparing"];

export const cancelOrder = async (orderId, role, actorAdminId, actorTenantId) => {

    try {

        const allowedStatuses = role === "customer" ? CUSTOMER_CANCELLABLE_STATUSES : STAFF_CANCELLABLE_STATUSES;

        const cancelledOrder = await OrderRepository.cancelOrder(orderId, allowedStatuses, async (client, order) => {
            await InventoryService.reverseConsumptionForOrder(client, order.OrderId, order.BranchId);
        });

        // Only a staff-initiated cancellation is audited - a customer
        // cancelling their own order is expected self-service, not the
        // "who did this and why" accountability question an audit trail
        // exists for.
        if (role === "admin") {

            AuditService.record({
                tenantId: actorTenantId,
                actorAdminId,
                action: "ORDER_CANCELLED",
                entityType: "Order",
                entityId: cancelledOrder.OrderId,
                summary: `Cancelled order #${cancelledOrder.OrderId} (₹${Number(cancelledOrder.TotalAmount).toFixed(2)})`
            });

        }

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
