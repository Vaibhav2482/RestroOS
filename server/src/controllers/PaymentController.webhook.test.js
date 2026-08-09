import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import request from "supertest";

import app from "../app.js";
import * as PaymentService from "../services/PaymentService.js";

vi.mock("../services/PaymentService.js");

const WEBHOOK_SECRET = "test-webhook-secret";

const sign = (body) => crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");

const orderPaidPayload = (receipt, transactionId = "pay_ABC123", amountPaise = 25000) => JSON.stringify({
    event: "order.paid",
    payload: {
        order: { entity: { receipt } },
        payment: { entity: { id: transactionId, amount: amountPaise } }
    }
});

// razorpayWebhook reads process.env.RAZORPAY_WEBHOOK_SECRET fresh on every
// request rather than caching it at import time, so tests can just flip
// this per-test - no need to reset/re-import the whole app module graph
// (which pulls in every route, and was timing out doing so repeatedly).
describe("POST /api/v1/payments/webhook", () => {

    const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    });

    afterEach(() => {
        process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
    });

    it("acks 200 without processing anything when no webhook secret is configured", async () => {

        delete process.env.RAZORPAY_WEBHOOK_SECRET;

        const body = orderPaidPayload("restroos_order_42");

        const response = await request(app)
            .post("/api/v1/payments/webhook")
            .set("Content-Type", "application/json")
            .set("x-razorpay-signature", "irrelevant")
            .send(body);

        expect(response.status).toBe(200);
        expect(PaymentService.recordRazorpayWebhookPayment).not.toHaveBeenCalled();

    });

    it("rejects a request with a missing signature", async () => {

        const body = orderPaidPayload("restroos_order_42");

        const response = await request(app)
            .post("/api/v1/payments/webhook")
            .set("Content-Type", "application/json")
            .send(body);

        expect(response.status).toBe(400);
        expect(PaymentService.recordRazorpayWebhookPayment).not.toHaveBeenCalled();

    });

    it("rejects a request with an invalid signature", async () => {

        const body = orderPaidPayload("restroos_order_42");

        const response = await request(app)
            .post("/api/v1/payments/webhook")
            .set("Content-Type", "application/json")
            .set("x-razorpay-signature", "0".repeat(64))
            .send(body);

        expect(response.status).toBe(400);
        expect(PaymentService.recordRazorpayWebhookPayment).not.toHaveBeenCalled();

    });

    it("ignores a correctly-signed event that isn't order.paid", async () => {

        const body = JSON.stringify({ event: "payment.failed", payload: {} });

        const response = await request(app)
            .post("/api/v1/payments/webhook")
            .set("Content-Type", "application/json")
            .set("x-razorpay-signature", sign(body))
            .send(body);

        expect(response.status).toBe(200);
        expect(PaymentService.recordRazorpayWebhookPayment).not.toHaveBeenCalled();

    });

    it("records the payment for a correctly-signed order.paid event with a matching receipt", async () => {

        const body = orderPaidPayload("restroos_order_42", "pay_XYZ789", 25000);

        const response = await request(app)
            .post("/api/v1/payments/webhook")
            .set("Content-Type", "application/json")
            .set("x-razorpay-signature", sign(body))
            .send(body);

        expect(response.status).toBe(200);
        expect(PaymentService.recordRazorpayWebhookPayment).toHaveBeenCalledWith({
            orderId: 42,
            transactionId: "pay_XYZ789",
            amount: 250
        });

    });

    it("does nothing for a correctly-signed order.paid event whose receipt doesn't match our format", async () => {

        const body = orderPaidPayload("some_other_systems_receipt");

        const response = await request(app)
            .post("/api/v1/payments/webhook")
            .set("Content-Type", "application/json")
            .set("x-razorpay-signature", sign(body))
            .send(body);

        expect(response.status).toBe(200);
        expect(PaymentService.recordRazorpayWebhookPayment).not.toHaveBeenCalled();

    });

});
