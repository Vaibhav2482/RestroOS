import { describe, it, expect, vi, beforeEach } from "vitest";

import * as OrderService from "./OrderService.js";
import * as OrderRepository from "../repositories/OrderRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as PaymentService from "./PaymentService.js";
import * as NotificationService from "./NotificationService.js";
import * as AuditService from "./AuditService.js";
import * as CartService from "./CartService.js";
import { waitUntil } from "@vercel/functions";

vi.mock("../repositories/OrderRepository.js");
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

    it("records an audit entry when a staff member (admin role) cancels", async () => {

        OrderRepository.cancelOrder.mockResolvedValue(order);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: true });
        NotificationService.notifyOrderCancelled.mockReturnValue(Promise.resolve());

        await OrderService.cancelOrder(62, "admin", 7, 9);

        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: 9, actorAdminId: 7, action: "ORDER_CANCELLED", entityId: 62 })
        );

    });

    it("does not record an audit entry when a customer cancels their own order", async () => {

        OrderRepository.cancelOrder.mockResolvedValue(order);
        PaymentService.refundPaymentForOrder.mockResolvedValue({ refunded: true });
        NotificationService.notifyOrderCancelled.mockReturnValue(Promise.resolve());

        await OrderService.cancelOrder(62, "customer");

        expect(AuditService.record).not.toHaveBeenCalled();

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
