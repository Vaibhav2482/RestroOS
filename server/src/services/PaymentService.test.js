import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("PaymentService.recordRazorpayWebhookPayment", () => {

    it("records a new payment when none exists yet for this order", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250 }]);
        PaymentRepository.getPaymentByOrderId.mockResolvedValue([]);
        PaymentRepository.createPayment.mockResolvedValue({ PaymentId: 1 });

        await PaymentService.recordRazorpayWebhookPayment({
            orderId: ORDER_ID,
            transactionId: "pay_ABC123",
            amount: 250
        });

        expect(PaymentRepository.createPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: ORDER_ID,
                paymentMethod: "Razorpay",
                paymentStatus: "Paid",
                transactionId: "pay_ABC123"
            })
        );

    });

    it("is a no-op when this exact payment was already recorded (Razorpay retried the webhook)", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250 }]);
        PaymentRepository.getPaymentByOrderId.mockResolvedValue([
            { PaymentId: 1, TransactionId: "pay_ABC123" }
        ]);

        await PaymentService.recordRazorpayWebhookPayment({
            orderId: ORDER_ID,
            transactionId: "pay_ABC123",
            amount: 250
        });

        expect(PaymentRepository.createPayment).not.toHaveBeenCalled();

    });

    it("swallows a unique-violation race against the client-side verify path", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250 }]);
        PaymentRepository.getPaymentByOrderId.mockResolvedValue([]);

        const uniqueViolation = new Error("duplicate key value");
        uniqueViolation.code = "23505";
        PaymentRepository.createPayment.mockRejectedValue(uniqueViolation);

        await expect(PaymentService.recordRazorpayWebhookPayment({
            orderId: ORDER_ID,
            transactionId: "pay_ABC123",
            amount: 250
        })).resolves.toBeUndefined();

    });

    it("re-throws an unrelated database error", async () => {

        OrderRepository.getOrderById.mockResolvedValue([{ OrderId: ORDER_ID, TotalAmount: 250 }]);
        PaymentRepository.getPaymentByOrderId.mockResolvedValue([]);

        const connectionError = new Error("connection lost");
        PaymentRepository.createPayment.mockRejectedValue(connectionError);

        await expect(PaymentService.recordRazorpayWebhookPayment({
            orderId: ORDER_ID,
            transactionId: "pay_ABC123",
            amount: 250
        })).rejects.toThrow("connection lost");

    });

    it("does nothing when the order from the webhook's receipt doesn't exist", async () => {

        OrderRepository.getOrderById.mockResolvedValue([]);

        await PaymentService.recordRazorpayWebhookPayment({
            orderId: 9999,
            transactionId: "pay_ABC123",
            amount: 250
        });

        expect(PaymentRepository.getPaymentByOrderId).not.toHaveBeenCalled();
        expect(PaymentRepository.createPayment).not.toHaveBeenCalled();

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
