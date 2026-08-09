import { describe, it, expect, vi, beforeEach } from "vitest";

import * as PaymentService from "./PaymentService.js";
import * as PaymentRepository from "../repositories/PaymentRepository.js";
import * as OrderRepository from "../repositories/OrderRepository.js";

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
