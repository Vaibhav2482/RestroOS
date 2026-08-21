import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository.pagination.test.js - stub the pool this
// module calls directly, so this exercises the real query-building logic
// with no actual database involved.
const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { createPayment, getPaymentByOrderId, updatePaymentStatus, getPaymentsByCustomer } = await import("./PaymentRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

describe("PaymentRepository.createPayment", () => {

    it("checks the order exists before inserting a payment row for it", async () => {

        queryMock
            .mockResolvedValueOnce({ rows: [] }) // order existence check - not found
            .mockResolvedValueOnce({ rows: [] }); // would-be insert, never reached

        await expect(createPayment({ orderId: 999, paymentMethod: "Cash", amount: 100 }))
            .rejects.toThrow("Order not found.");

        // Only the existence check ran - no orphan Payments row inserted
        // for an order that doesn't exist.
        expect(queryMock).toHaveBeenCalledTimes(1);

    });

    it("inserts with Pending status and a null transaction id when neither is supplied", async () => {

        queryMock
            .mockResolvedValueOnce({ rows: [{ OrderId: 42 }] })
            .mockResolvedValueOnce({ rows: [{ PaymentId: 1, OrderId: 42, PaymentStatus: "Pending" }] });

        const result = await createPayment({ orderId: 42, paymentMethod: "Cash", amount: 250 });

        expect(result).toEqual({ PaymentId: 1, OrderId: 42, PaymentStatus: "Pending" });

        const [insertSql, insertParams] = queryMock.mock.calls[1];
        expect(insertSql).toMatch(/INSERT INTO "Payments"/);
        expect(insertParams).toEqual([42, "Cash", 250, "Pending", null]);

    });

    it("passes an explicit status and transaction id through unchanged", async () => {

        queryMock
            .mockResolvedValueOnce({ rows: [{ OrderId: 42 }] })
            .mockResolvedValueOnce({ rows: [{ PaymentId: 1 }] });

        await createPayment({
            orderId: 42,
            paymentMethod: "Razorpay",
            amount: 250,
            paymentStatus: "Paid",
            transactionId: "pay_ABC123"
        });

        const [, insertParams] = queryMock.mock.calls[1];
        expect(insertParams).toEqual([42, "Razorpay", 250, "Paid", "pay_ABC123"]);

    });

});

describe("PaymentRepository.getPaymentByOrderId", () => {

    it("scopes the query to the given order", async () => {

        queryMock.mockResolvedValue({ rows: [{ PaymentId: 1 }] });

        const result = await getPaymentByOrderId(42);

        expect(result).toEqual([{ PaymentId: 1 }]);
        expect(queryMock).toHaveBeenCalledWith(expect.stringMatching(/WHERE "OrderId" = \$1/), [42]);

    });

});

describe("PaymentRepository.updatePaymentStatus", () => {

    it("updates only the targeted payment's status", async () => {

        queryMock.mockResolvedValue({ rows: [{ PaymentId: 1, PaymentStatus: "Refunded" }] });

        const result = await updatePaymentStatus(1, "Refunded");

        expect(result).toEqual({ PaymentId: 1, PaymentStatus: "Refunded" });
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringMatching(/UPDATE "Payments" SET "PaymentStatus" = \$1 WHERE "PaymentId" = \$2/),
            ["Refunded", 1]
        );

    });

});

describe("PaymentRepository.getPaymentsByCustomer", () => {

    it("joins through Orders to scope by customer, newest first", async () => {

        queryMock.mockResolvedValue({ rows: [{ PaymentId: 2 }, { PaymentId: 1 }] });

        const result = await getPaymentsByCustomer(100);

        expect(result).toEqual([{ PaymentId: 2 }, { PaymentId: 1 }]);

        const [sql, params] = queryMock.mock.calls[0];
        expect(sql).toMatch(/INNER JOIN "Orders"/);
        expect(sql).toMatch(/WHERE O\."CustomerId" = \$1/);
        expect(sql).toMatch(/ORDER BY P\."PaymentDate" DESC/);
        expect(params).toEqual([100]);

    });

});
