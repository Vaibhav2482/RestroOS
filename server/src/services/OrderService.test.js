import { describe, it, expect, vi, beforeEach } from "vitest";

import * as OrderService from "./OrderService.js";
import * as OrderRepository from "../repositories/OrderRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as PaymentService from "./PaymentService.js";
import * as NotificationService from "./NotificationService.js";
import { waitUntil } from "@vercel/functions";

vi.mock("../repositories/OrderRepository.js");
vi.mock("./RealtimeService.js");
vi.mock("./PaymentService.js");
vi.mock("./NotificationService.js");
vi.mock("@vercel/functions");

const order = { OrderId: 62, CustomerId: 1, TotalAmount: 105 };

beforeEach(() => {

    vi.clearAllMocks();

    RealtimeService.publishOrderCreated.mockResolvedValue();
    RealtimeService.publishOrderStatusChanged.mockResolvedValue();

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
