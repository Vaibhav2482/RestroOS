import { describe, it, expect, vi, beforeEach } from "vitest";

import * as CheckoutService from "./CheckoutService.js";
import * as CheckoutRepository from "../repositories/CheckoutRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as NotificationService from "./NotificationService.js";
import { waitUntil } from "@vercel/functions";

vi.mock("../repositories/CheckoutRepository.js");
vi.mock("./RealtimeService.js");
vi.mock("./NotificationService.js");
vi.mock("@vercel/functions");

const order = { OrderId: 62, CustomerId: 1, TotalAmount: 105 };

beforeEach(() => {
    vi.clearAllMocks();
    RealtimeService.publishOrderCreated.mockResolvedValue();
});

// Same guarantee as OrderService - a slow WhatsApp/SMS/email provider must
// never make the customer's checkout click hang.
describe("CheckoutService.checkout - notifications never block the response", () => {

    it("resolves without waiting for notifyOrderCreated to settle", async () => {

        CheckoutRepository.checkout.mockResolvedValue(order);
        NotificationService.notifyOrderCreated.mockReturnValue(new Promise(() => {}));

        const result = await CheckoutService.checkout({
            customerId: 1,
            addressId: 1,
            deliveryType: "Delivery",
            paymentMethod: "Cash"
        });

        expect(result.success).toBe(true);
        expect(waitUntil).toHaveBeenCalledTimes(1);

    });

    it("logs but does not throw when the notification promise itself rejects", async () => {

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        CheckoutRepository.checkout.mockResolvedValue(order);
        NotificationService.notifyOrderCreated.mockRejectedValue(new Error("boom"));
        waitUntil.mockImplementation((promise) => promise);

        const result = await CheckoutService.checkout({
            customerId: 1,
            addressId: 1,
            deliveryType: "Delivery",
            paymentMethod: "Cash"
        });

        expect(result.success).toBe(true);

        await new Promise((resolve) => setImmediate(resolve));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("notifyOrderCreated failed"));

    });

});

// Table-linked (QR) dine-in ordering: a table's number only ever matters for
// a Dine In order (see OrderRepository.createOrder's VisitId resolution) - a
// Delivery order must never carry one through, even if the storefront still
// had a stale table number cached from an earlier dine-in visit.
describe("CheckoutService.checkout - table number only reaches a Dine In order", () => {

    it("passes tableNumber through for a Dine In order", async () => {

        CheckoutRepository.checkout.mockResolvedValue(order);

        await CheckoutService.checkout({
            customerId: 1,
            deliveryType: "Dine In",
            paymentMethod: "Cash",
            tableNumber: "12"
        });

        expect(CheckoutRepository.checkout).toHaveBeenCalledWith(1, null, "Dine In", "Cash", undefined, undefined, "12");

    });

    it("strips a stale tableNumber off a Delivery order", async () => {

        CheckoutRepository.checkout.mockResolvedValue(order);

        await CheckoutService.checkout({
            customerId: 1,
            addressId: 1,
            deliveryType: "Delivery",
            paymentMethod: "Cash",
            tableNumber: "12"
        });

        expect(CheckoutRepository.checkout).toHaveBeenCalledWith(1, 1, "Delivery", "Cash", undefined, undefined, null);

    });

});
