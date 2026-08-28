import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

import * as PaymentService from "./PaymentService.js";
import * as PaymentRepository from "../repositories/PaymentRepository.js";
import * as OrderRepository from "../repositories/OrderRepository.js";
import { getRazorpayClient } from "../config/razorpay.js";

vi.mock("../repositories/PaymentRepository.js");
vi.mock("../repositories/OrderRepository.js");
vi.mock("../config/razorpay.js", () => ({ getRazorpayClient: vi.fn(() => null) }));

const ORDER_ID = 42;

beforeEach(() => {
    vi.clearAllMocks();
});

const RAZORPAY_ORDER_ID = "order_XYZ789";

describe("PaymentService.createRazorpayOrder", () => {

    const razorpayOrdersCreate = vi.fn();

    beforeEach(() => {
        razorpayOrdersCreate.mockReset().mockResolvedValue({ id: RAZORPAY_ORDER_ID, amount: 25000, currency: "INR" });
        getRazorpayClient.mockReturnValue({ orders: { create: razorpayOrdersCreate } });
    });

    it("refuses when Razorpay isn't configured, before touching the order or Payments", async () => {

        getRazorpayClient.mockReturnValue(null);

        const result = await PaymentService.createRazorpayOrder(ORDER_ID);

        expect(result).toEqual({ success: false, message: "Razorpay is not configured on this server yet." });
        expect(OrderRepository.getOrderById).not.toHaveBeenCalled();

    });

    it("fails when the order doesn't exist", async () => {

        OrderRepository.getOrderById.mockResolvedValue([]);

        const result = await PaymentService.createRazorpayOrder(ORDER_ID);

        expect(result.success).toBe(false);
        expect(razorpayOrdersCreate).not.toHaveBeenCalled();

    });

    it("writes a Pending Payments row the moment the Razorpay order is created - not just on later success", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250, PaymentMethod: "Card" }]);

        const result = await PaymentService.createRazorpayOrder(ORDER_ID);

        expect(result.success).toBe(true);
        expect(result.data.razorpayOrderId).toBe(RAZORPAY_ORDER_ID);
        expect(PaymentRepository.createPayment).toHaveBeenCalledWith({
            orderId: ORDER_ID,
            paymentMethod: "Card",
            amount: 250,
            paymentStatus: "Pending",
            razorpayOrderId: RAZORPAY_ORDER_ID
        });

    });

});

describe("PaymentService.recordFailedRazorpayAttempt", () => {

    it("marks a Pending attempt Failed when it belongs to the given order", async () => {

        PaymentRepository.getPaymentByRazorpayOrderId.mockResolvedValue({ OrderId: ORDER_ID, RazorpayOrderId: RAZORPAY_ORDER_ID });
        PaymentRepository.markPaymentFailedIfPending.mockResolvedValue({ PaymentId: 1, PaymentStatus: "Failed" });

        const result = await PaymentService.recordFailedRazorpayAttempt(ORDER_ID, RAZORPAY_ORDER_ID);

        expect(result.success).toBe(true);
        expect(PaymentRepository.markPaymentFailedIfPending).toHaveBeenCalledWith(RAZORPAY_ORDER_ID);

    });

    it("refuses when the Razorpay order id doesn't belong to the given order", async () => {

        PaymentRepository.getPaymentByRazorpayOrderId.mockResolvedValue({ OrderId: 999, RazorpayOrderId: RAZORPAY_ORDER_ID });

        const result = await PaymentService.recordFailedRazorpayAttempt(ORDER_ID, RAZORPAY_ORDER_ID);

        expect(result.success).toBe(false);
        expect(PaymentRepository.markPaymentFailedIfPending).not.toHaveBeenCalled();

    });

    it("refuses when no payment attempt exists for that Razorpay order id at all", async () => {

        PaymentRepository.getPaymentByRazorpayOrderId.mockResolvedValue(undefined);

        const result = await PaymentService.recordFailedRazorpayAttempt(ORDER_ID, RAZORPAY_ORDER_ID);

        expect(result.success).toBe(false);

    });

    it("still succeeds (no-op) when a retry already paid this attempt - never reported as an error", async () => {

        PaymentRepository.getPaymentByRazorpayOrderId.mockResolvedValue({ OrderId: ORDER_ID, RazorpayOrderId: RAZORPAY_ORDER_ID });
        // Already Paid - markPaymentFailedIfPending's WHERE clause matches nothing.
        PaymentRepository.markPaymentFailedIfPending.mockResolvedValue(undefined);

        const result = await PaymentService.recordFailedRazorpayAttempt(ORDER_ID, RAZORPAY_ORDER_ID);

        expect(result.success).toBe(true);

    });

});

describe("PaymentService.recordFailedRazorpayWebhookPayment", () => {

    it("delegates straight to the conditional Pending-only update", async () => {

        await PaymentService.recordFailedRazorpayWebhookPayment(RAZORPAY_ORDER_ID);

        expect(PaymentRepository.markPaymentFailedIfPending).toHaveBeenCalledWith(RAZORPAY_ORDER_ID);

    });

});

describe("PaymentService.recordRazorpayWebhookPayment", () => {

    it("updates the existing Pending row (found by Razorpay order id) to Paid", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250, PaymentMethod: "Card" }]);
        PaymentRepository.updatePaymentByRazorpayOrderId.mockResolvedValue({ PaymentId: 1, PaymentStatus: "Paid" });

        await PaymentService.recordRazorpayWebhookPayment({
            orderId: ORDER_ID,
            razorpayOrderId: RAZORPAY_ORDER_ID,
            transactionId: "pay_ABC123",
            amount: 250
        });

        expect(PaymentRepository.updatePaymentByRazorpayOrderId).toHaveBeenCalledWith(
            RAZORPAY_ORDER_ID,
            { paymentStatus: "Paid", transactionId: "pay_ABC123" }
        );
        expect(PaymentRepository.createPayment).not.toHaveBeenCalled();

    });

    it("is naturally idempotent against Razorpay's own webhook retries - repeated calls just re-run the same UPDATE", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250, PaymentMethod: "Card" }]);
        PaymentRepository.updatePaymentByRazorpayOrderId.mockResolvedValue({ PaymentId: 1, PaymentStatus: "Paid" });

        const payload = { orderId: ORDER_ID, razorpayOrderId: RAZORPAY_ORDER_ID, transactionId: "pay_ABC123", amount: 250 };
        await PaymentService.recordRazorpayWebhookPayment(payload);
        await PaymentService.recordRazorpayWebhookPayment(payload);

        expect(PaymentRepository.updatePaymentByRazorpayOrderId).toHaveBeenCalledTimes(2);
        expect(PaymentRepository.createPayment).not.toHaveBeenCalled();

    });

    it("falls back to inserting a fresh Paid row if no Pending row exists for this Razorpay order id (defensive - shouldn't happen via the normal flow)", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250, PaymentMethod: "Card" }]);
        PaymentRepository.updatePaymentByRazorpayOrderId.mockResolvedValue(undefined);

        await PaymentService.recordRazorpayWebhookPayment({
            orderId: ORDER_ID,
            razorpayOrderId: RAZORPAY_ORDER_ID,
            transactionId: "pay_ABC123",
            amount: 250
        });

        expect(PaymentRepository.createPayment).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: ORDER_ID, paymentStatus: "Paid", transactionId: "pay_ABC123" })
        );

    });

    it("does nothing when the order from the webhook's receipt doesn't exist", async () => {

        OrderRepository.getOrderById.mockResolvedValue([]);

        await PaymentService.recordRazorpayWebhookPayment({
            orderId: 9999,
            razorpayOrderId: RAZORPAY_ORDER_ID,
            transactionId: "pay_ABC123",
            amount: 250
        });

        expect(PaymentRepository.updatePaymentByRazorpayOrderId).not.toHaveBeenCalled();
        expect(PaymentRepository.createPayment).not.toHaveBeenCalled();

    });

});

describe("PaymentService.verifyRazorpayPayment", () => {

    const KEY_SECRET = "test_key_secret";
    const RAZORPAY_PAYMENT_ID = "pay_ABC123";

    const sign = (razorpayOrderId, razorpayPaymentId) =>
        crypto.createHmac("sha256", KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");

    const validPayload = () => ({
        orderId: ORDER_ID,
        paymentMethod: "Card",
        razorpayOrderId: RAZORPAY_ORDER_ID,
        razorpayPaymentId: RAZORPAY_PAYMENT_ID,
        razorpaySignature: sign(RAZORPAY_ORDER_ID, RAZORPAY_PAYMENT_ID)
    });

    beforeEach(() => {
        process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    });

    afterEach(() => {
        delete process.env.RAZORPAY_KEY_SECRET;
    });

    it("fails closed when Razorpay isn't configured, before even checking the signature", async () => {

        delete process.env.RAZORPAY_KEY_SECRET;

        const result = await PaymentService.verifyRazorpayPayment(validPayload());

        expect(result.success).toBe(false);
        expect(PaymentRepository.updatePaymentByRazorpayOrderId).not.toHaveBeenCalled();

    });

    it("rejects a signature that doesn't match, without recording anything", async () => {

        const result = await PaymentService.verifyRazorpayPayment({ ...validPayload(), razorpaySignature: "tampered" });

        expect(result).toEqual({ success: false, message: "Payment verification failed." });
        expect(PaymentRepository.updatePaymentByRazorpayOrderId).not.toHaveBeenCalled();

    });

    it("rejects when required fields are missing", async () => {

        const result = await PaymentService.verifyRazorpayPayment({ orderId: ORDER_ID });

        expect(result.success).toBe(false);

    });

    it("on a valid signature, updates the existing Pending row to Paid rather than inserting a new one", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250 }]);
        PaymentRepository.updatePaymentByRazorpayOrderId.mockResolvedValue({ PaymentId: 1, PaymentStatus: "Paid" });

        const result = await PaymentService.verifyRazorpayPayment(validPayload());

        expect(result.success).toBe(true);
        expect(PaymentRepository.updatePaymentByRazorpayOrderId).toHaveBeenCalledWith(
            RAZORPAY_ORDER_ID,
            { paymentStatus: "Paid", transactionId: RAZORPAY_PAYMENT_ID }
        );
        expect(PaymentRepository.createPayment).not.toHaveBeenCalled();

    });

    it("falls back to inserting when no Pending row exists for this Razorpay order id (defensive)", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250 }]);
        PaymentRepository.updatePaymentByRazorpayOrderId.mockResolvedValue(undefined);
        PaymentRepository.createPayment.mockResolvedValue({ PaymentId: 1, PaymentStatus: "Paid" });

        const result = await PaymentService.verifyRazorpayPayment(validPayload());

        expect(result.success).toBe(true);
        expect(PaymentRepository.createPayment).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: ORDER_ID, paymentStatus: "Paid", transactionId: RAZORPAY_PAYMENT_ID })
        );

    });

    it("fails when the order doesn't exist, even with a valid signature", async () => {

        OrderRepository.getOrderById.mockResolvedValue([]);

        const result = await PaymentService.verifyRazorpayPayment(validPayload());

        expect(result.success).toBe(false);
        expect(PaymentRepository.updatePaymentByRazorpayOrderId).not.toHaveBeenCalled();

    });

});

describe("PaymentService.refundPaymentForOrder", () => {

    const razorpayRefund = vi.fn();

    beforeEach(() => {
        razorpayRefund.mockReset().mockResolvedValue({});
        getRazorpayClient.mockReturnValue({ payments: { refund: razorpayRefund } });
    });

    it("reports nothing to refund when there's no Paid or Partially Refunded payment", async () => {

        PaymentRepository.getPaymentByOrderId.mockResolvedValue([{ PaymentStatus: "Pending" }]);

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID);

        expect(result).toEqual({ refunded: false, reason: "no-payment-to-refund" });
        expect(razorpayRefund).not.toHaveBeenCalled();

    });

    it("refuses a cash payment - there's no gateway to call", async () => {

        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, PaymentStatus: "Paid", PaymentMethod: "Cash", Amount: 200 }
        ]);

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID);

        expect(result.refunded).toBe(false);
        expect(result.reason).toBe("cash-payment");
        expect(razorpayRefund).not.toHaveBeenCalled();

    });

    it("reports the server has no Razorpay client configured at all", async () => {

        getRazorpayClient.mockReturnValue(null);
        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, PaymentStatus: "Paid", PaymentMethod: "Card", Amount: 200, TransactionId: "pay_ABC" }
        ]);

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID);

        expect(result.refunded).toBe(false);
        expect(result.reason).toBe("not-configured");
        expect(razorpayRefund).not.toHaveBeenCalled();

    });

    // Distinct from the case above - the gateway itself is configured and
    // working (real storefront orders refund fine), this specific payment
    // just never went through it. A staff-created in-person Card/UPI order
    // (server/src/repositories/OrderRepository.js's createOrder writes it
    // with no TransactionId) is exactly this shape.
    it("reports no online transaction to refund when the payment has no TransactionId, even with Razorpay configured", async () => {

        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, PaymentStatus: "Paid", PaymentMethod: "Card", Amount: 200, TransactionId: null }
        ]);

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID);

        expect(result.refunded).toBe(false);
        expect(result.reason).toBe("no-online-transaction");
        expect(razorpayRefund).not.toHaveBeenCalled();

    });

    it("refunds the full payment amount and marks it Refunded when no amount is given (the cancel-order default)", async () => {

        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, PaymentStatus: "Paid", PaymentMethod: "Razorpay", Amount: 200, TransactionId: "pay_ABC" }
        ]);

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID);

        expect(razorpayRefund).toHaveBeenCalledWith("pay_ABC", { amount: 20000 });
        expect(PaymentRepository.updatePaymentStatus).toHaveBeenCalledWith(1, "Refunded");
        expect(result).toEqual({ refunded: true, payment: expect.objectContaining({ PaymentId: 1 }), amount: 200 });

    });

    it("refunds only the given partial amount and lands on whatever status the caller asked for", async () => {

        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, PaymentStatus: "Paid", PaymentMethod: "Razorpay", Amount: 200, TransactionId: "pay_ABC" }
        ]);

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID, 50, "Partially Refunded");

        expect(razorpayRefund).toHaveBeenCalledWith("pay_ABC", { amount: 5000 });
        expect(PaymentRepository.updatePaymentStatus).toHaveBeenCalledWith(1, "Partially Refunded");
        expect(result.amount).toBe(50);

    });

    it("finds a payment already Partially Refunded, not just a fresh Paid one - so a second partial refund is possible", async () => {

        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, PaymentStatus: "Partially Refunded", PaymentMethod: "Razorpay", Amount: 200, TransactionId: "pay_ABC" }
        ]);

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID, 50, "Partially Refunded");

        expect(result.refunded).toBe(true);

    });

    it("surfaces a gateway failure without throwing, so it never blocks the caller's own state change", async () => {

        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, PaymentStatus: "Paid", PaymentMethod: "Razorpay", Amount: 200, TransactionId: "pay_ABC" }
        ]);
        razorpayRefund.mockRejectedValue(new Error("gateway down"));

        const result = await PaymentService.refundPaymentForOrder(ORDER_ID);

        expect(result.refunded).toBe(false);
        expect(result.reason).toBe("refund-api-failed");
        expect(PaymentRepository.updatePaymentStatus).not.toHaveBeenCalled();

    });

});
