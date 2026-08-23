import { describe, it, expect, vi, beforeEach } from "vitest";

import * as OrderService from "./OrderService.js";
import * as OrderRepository from "../repositories/OrderRepository.js";
import * as OrderAdjustmentRepository from "../repositories/OrderAdjustmentRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as PaymentService from "./PaymentService.js";
import * as NotificationService from "./NotificationService.js";
import * as AuditService from "./AuditService.js";
import * as CartService from "./CartService.js";
import { waitUntil } from "@vercel/functions";

vi.mock("../repositories/OrderRepository.js");
vi.mock("../repositories/OrderAdjustmentRepository.js");
vi.mock("./RealtimeService.js");
vi.mock("./PaymentService.js");
vi.mock("./NotificationService.js");
vi.mock("./AuditService.js");
vi.mock("./CartService.js");
vi.mock("@vercel/functions");

const order = { OrderId: 62, CustomerId: 1, TotalAmount: 105 };

beforeEach(() => {

    vi.clearAllMocks();

    RealtimeService.publishOrderCreated.mockResolvedValue();
    RealtimeService.publishOrderStatusChanged.mockResolvedValue();
    AuditService.record.mockResolvedValue();
    OrderAdjustmentRepository.recordAdjustment.mockResolvedValue();

});

// Notifications must never make the order flow wait on a slow WhatsApp/SMS/
// email provider - these tests prove that by having NotificationService
// return a promise that never resolves, and asserting the service call
// still resolves anyway.
describe("OrderService - notifications never block the response", () => {

    it("createOrder resolves without waiting for notifyOrderCreated", async () => {

        OrderRepository.createOrder.mockResolvedValue(order);
        NotificationService.notifyOrderCreated.mockReturnValue(new Promise(() => {}));

        const result = await OrderService.createOrder({
            customerId: 1,
            items: [{ menuItemId: 1 }],
            deliveryType: "Delivery",
            addressId: 1,
            paymentMethod: "Cash"
        });

        expect(result.success).toBe(true);
        expect(waitUntil).toHaveBeenCalledTimes(1);

    });

    it("updateOrderStatus resolves without waiting for notifyOrderStatusChanged", async () => {

        OrderRepository.updateOrderStatus.mockResolvedValue(order);
        NotificationService.notifyOrderStatusChanged.mockReturnValue(new Promise(() => {}));

        const result = await OrderService.updateOrderStatus(62, "Ready");

        expect(result.success).toBe(true);
        expect(waitUntil).toHaveBeenCalledTimes(1);

    });

    it("cancelOrder resolves without waiting for notifyOrderCancelled", async () => {

        OrderRepository.cancelOrder.mockResolvedValue(order);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: true });
        NotificationService.notifyOrderCancelled.mockReturnValue(new Promise(() => {}));

        const result = await OrderService.cancelOrder(62);

        expect(result.success).toBe(true);
        expect(waitUntil).toHaveBeenCalledTimes(1);

    });

    it("logs but does not throw when the notification promise itself rejects", async () => {

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        OrderRepository.createOrder.mockResolvedValue(order);
        NotificationService.notifyOrderCreated.mockRejectedValue(new Error("boom"));

        // waitUntil's real implementation just registers the promise -
        // invoke it here to simulate the platform observing it, and confirm
        // the rejection is caught rather than becoming unhandled.
        waitUntil.mockImplementation((promise) => promise);

        const result = await OrderService.createOrder({
            customerId: 1,
            items: [{ menuItemId: 1 }],
            deliveryType: "Delivery",
            addressId: 1,
            paymentMethod: "Cash"
        });

        expect(result.success).toBe(true);

        await new Promise((resolve) => setImmediate(resolve));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("notifyOrderCreated failed"));

    });

});

// A customer cancelling their own order is expected self-service, not the
// "who did this" question an audit trail exists for - only a staff-
// initiated cancellation (role "admin") should ever produce an audit
// entry. Getting this boolean backwards would either spam the audit log
// with every customer cancellation or silently drop staff cancellations.
describe("OrderService - cancelOrder audits staff action, not customer self-service", () => {

    it("records an audit entry and a VOID ledger row when a staff member (admin role) cancels with a reason", async () => {

        OrderRepository.cancelOrder.mockResolvedValue(order);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: true });
        NotificationService.notifyOrderCancelled.mockReturnValue(Promise.resolve());

        await OrderService.cancelOrder(62, "admin", 7, 9, "Customer changed their mind");

        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: 9, actorAdminId: 7, action: "ORDER_CANCELLED", entityId: 62 })
        );

        expect(OrderAdjustmentRepository.recordAdjustment).toHaveBeenCalledWith({
            tenantId: 9,
            orderId: 62,
            adjustmentType: "VOID",
            amount: null,
            reason: "Customer changed their mind",
            actorAdminId: 7
        });

    });

    it("refuses to cancel as staff without a reason - never falls back to silently voiding it anyway", async () => {

        const result = await OrderService.cancelOrder(62, "admin", 7, 9);

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/reason is required/i);
        expect(OrderRepository.cancelOrder).not.toHaveBeenCalled();

    });

    it("rejects a whitespace-only reason the same as a missing one", async () => {

        const result = await OrderService.cancelOrder(62, "admin", 7, 9, "   ");

        expect(result.success).toBe(false);
        expect(OrderRepository.cancelOrder).not.toHaveBeenCalled();

    });

    it("does not record an audit entry or a ledger row when a customer cancels their own order", async () => {

        OrderRepository.cancelOrder.mockResolvedValue(order);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: true });
        NotificationService.notifyOrderCancelled.mockReturnValue(Promise.resolve());

        await OrderService.cancelOrder(62, "customer");

        expect(AuditService.record).not.toHaveBeenCalled();
        expect(OrderAdjustmentRepository.recordAdjustment).not.toHaveBeenCalled();

    });

});

describe("OrderService.refundOrder", () => {

    const paidPayment = { PaymentId: 1, PaymentMethod: "Razorpay", Amount: 200, PaymentStatus: "Paid" };

    it("requires a reason", async () => {

        const result = await OrderService.refundOrder(62, 7, 9, 50, "");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/reason is required/i);
        expect(PaymentService.refundPaymentForOrder).not.toHaveBeenCalled();

    });

    it("requires a positive amount", async () => {

        const result = await OrderService.refundOrder(62, 7, 9, 0, "Wrong item sent");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/greater than 0/i);

    });

    it("fails when the order has no paid or partially-refunded payment", async () => {

        PaymentService.getPaymentByOrderId.mockResolvedValue({ data: [{ PaymentStatus: "Pending" }] });

        const result = await OrderService.refundOrder(62, 7, 9, 50, "Wrong item sent");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/no payment to refund/i);

    });

    it("refuses a refund larger than what's actually left to refund", async () => {

        PaymentService.getPaymentByOrderId.mockResolvedValue({ data: [paidPayment] });
        OrderAdjustmentRepository.getTotalRefundedForOrder.mockResolvedValue(180);

        // Only ₹20 of the ₹200 payment remains refundable.
        const result = await OrderService.refundOrder(62, 7, 9, 50, "Wrong item sent");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/exceeds the remaining refundable balance of ₹20\.00/i);
        expect(PaymentService.refundPaymentForOrder).not.toHaveBeenCalled();

    });

    it("processes a partial refund, landing on Partially Refunded, and logs it to the ledger", async () => {

        PaymentService.getPaymentByOrderId.mockResolvedValue({ data: [paidPayment] });
        OrderAdjustmentRepository.getTotalRefundedForOrder.mockResolvedValue(0);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: true });

        const result = await OrderService.refundOrder(62, 7, 9, 50, "Wrong item sent");

        expect(result.success).toBe(true);
        expect(PaymentService.refundPaymentForOrder).toHaveBeenCalledWith(62, 50, "Partially Refunded");
        expect(OrderAdjustmentRepository.recordAdjustment).toHaveBeenCalledWith({
            tenantId: 9, orderId: 62, adjustmentType: "REFUND", amount: 50, reason: "Wrong item sent", actorAdminId: 7
        });

    });

    it("lands on Refunded once a refund (on top of what's already been refunded) covers the full payment", async () => {

        PaymentService.getPaymentByOrderId.mockResolvedValue({ data: [paidPayment] });
        OrderAdjustmentRepository.getTotalRefundedForOrder.mockResolvedValue(150);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: true });

        await OrderService.refundOrder(62, 7, 9, 50, "Wrong item sent");

        expect(PaymentService.refundPaymentForOrder).toHaveBeenCalledWith(62, 50, "Refunded");

    });

    it("treats a cash refund as handled and still logs it, even though PaymentService reports refunded: false", async () => {

        PaymentService.getPaymentByOrderId.mockResolvedValue({ data: [{ ...paidPayment, PaymentMethod: "Cash" }] });
        OrderAdjustmentRepository.getTotalRefundedForOrder.mockResolvedValue(0);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: false, reason: "cash-payment" });

        const result = await OrderService.refundOrder(62, 7, 9, 50, "Wrong item sent");

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/hand the cash back/i);
        expect(OrderAdjustmentRepository.recordAdjustment).toHaveBeenCalled();

    });

    it("fails without logging anything when the gateway refund actually fails", async () => {

        PaymentService.getPaymentByOrderId.mockResolvedValue({ data: [paidPayment] });
        OrderAdjustmentRepository.getTotalRefundedForOrder.mockResolvedValue(0);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: false, reason: "refund-api-failed" });

        const result = await OrderService.refundOrder(62, 7, 9, 50, "Wrong item sent");

        expect(result.success).toBe(false);
        expect(OrderAdjustmentRepository.recordAdjustment).not.toHaveBeenCalled();

    });

});

describe("OrderService.reorderOrder", () => {

    const orderRows = [
        {
            OrderId: 62, CustomerId: 1, OrderItemId: 1, MenuItemId: 10, ItemName: "Veg Fried Rice",
            Price: 200, Quantity: 2, TotalPrice: 400, SelectedOptions: []
        },
        {
            OrderId: 62, CustomerId: 1, OrderItemId: 2, MenuItemId: 11, ItemName: "Paneer Tikka",
            Price: 250, Quantity: 1, TotalPrice: 280,
            SelectedOptions: [{ OptionId: 5, GroupName: "Spice Level", OptionName: "Extra Spicy", PriceDelta: 30 }]
        }
    ];

    it("rejects reordering someone else's order", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRows);

        const result = await OrderService.reorderOrder(62, 999);

        expect(result.success).toBe(false);
        expect(CartService.addToCart).not.toHaveBeenCalled();

    });

    it("re-adds every item, passing the original OptionIds through for a customized item", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRows);
        CartService.addToCart.mockResolvedValue({ success: true });

        const result = await OrderService.reorderOrder(62, 1);

        expect(result.success).toBe(true);
        expect(CartService.addToCart).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: 1, menuItemId: 10, quantity: 2, selectedOptionIds: [] })
        );
        expect(CartService.addToCart).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: 1, menuItemId: 11, quantity: 1, selectedOptionIds: [5] })
        );
        expect(result.data).toEqual({ addedCount: 2, skippedItems: [] });

    });

    it("skips an item that's no longer available and reports it, without failing the whole reorder", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRows);
        CartService.addToCart
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ success: false, message: "Menu item not found." });

        const result = await OrderService.reorderOrder(62, 1);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ addedCount: 1, skippedItems: ["Paneer Tikka"] });
        expect(result.message).toContain("Paneer Tikka");

    });

    it("fails the whole reorder when every item was skipped", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRows);
        CartService.addToCart.mockResolvedValue({ success: false, message: "Menu item not found." });

        const result = await OrderService.reorderOrder(62, 1);

        expect(result.success).toBe(false);

    });

});

describe("OrderService.getAllOrders", () => {

    it("returns the plain array unchanged when no pagination is requested", async () => {

        OrderRepository.getAllOrders.mockResolvedValue([order]);

        const result = await OrderService.getAllOrders(3, null, null, null);

        expect(result.data).toEqual([order]);
        expect(OrderRepository.getAllOrders).toHaveBeenCalledWith(3, null, null, null);

    });

    it("shapes the response as { orders, total, page, limit } when pagination is requested", async () => {

        OrderRepository.getAllOrders.mockResolvedValue({ orders: [order], total: 47 });

        const result = await OrderService.getAllOrders(3, null, null, { page: 2, limit: 25 });

        expect(result.data).toEqual({ orders: [order], total: 47, page: 2, limit: 25 });

    });

});

describe("OrderService.getDashboardSummary", () => {

    it("passes the repository's aggregate numbers straight through", async () => {

        const summary = { totalOrders: 10, activeOrders: 2, todaysRevenue: 500, recentOrders: [order] };
        OrderRepository.getDashboardSummary.mockResolvedValue(summary);

        const result = await OrderService.getDashboardSummary(3, 7);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(summary);
        expect(OrderRepository.getDashboardSummary).toHaveBeenCalledWith(3, 7);

    });

});
