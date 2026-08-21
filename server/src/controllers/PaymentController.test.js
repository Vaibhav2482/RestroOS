import { describe, it, expect, vi, beforeEach } from "vitest";

import {
    createPayment,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getPaymentByOrderId,
    getPaymentsByCustomer
} from "./PaymentController.js";
import * as OrderRepository from "../repositories/OrderRepository.js";
import * as PaymentService from "../services/PaymentService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

vi.mock("../repositories/OrderRepository.js");
vi.mock("../services/PaymentService.js");
vi.mock("../repositories/CustomerRepository.js");

const buildRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

// Order rows are the join-shaped array OrderRepository.getOrderById
// actually returns (order[0] carries TenantId via the Branch join, per
// canAccessOrderPayment's own comment) - not the shaped single-object form
// OrderService.getOrderById returns after shapeOrder().
const orderRow = (overrides = {}) => [{
    OrderId: 42,
    TenantId: 3,
    BranchId: 9,
    CustomerId: 100,
    ...overrides
}];

beforeEach(() => {

    vi.clearAllMocks();

    PaymentService.createPayment.mockResolvedValue({ success: true, message: "Payment recorded.", data: { PaymentId: 1 } });
    PaymentService.createRazorpayOrder.mockResolvedValue({ success: true, message: "Razorpay order created.", data: { id: "order_1" } });
    PaymentService.verifyRazorpayPayment.mockResolvedValue({ success: true, message: "Payment verified.", data: { PaymentId: 1 } });
    PaymentService.getPaymentByOrderId.mockResolvedValue({ success: true, message: "Payment fetched.", data: [{ PaymentId: 1 }] });
    PaymentService.getPaymentsByCustomer.mockResolvedValue({ success: true, message: "Payments fetched.", data: [] });

});

// The same canAccessOrderPayment guard fronts createPayment, createRazorpayOrder,
// and verifyRazorpayPayment - table-driven over the three so the tenant/role
// boundary is proven for each real route, not just asserted once and assumed
// to generalize.
describe.each([
    ["createPayment", createPayment, PaymentService.createPayment],
    ["createRazorpayOrder", createRazorpayOrder, PaymentService.createRazorpayOrder],
    ["verifyRazorpayPayment", verifyRazorpayPayment, PaymentService.verifyRazorpayPayment]
])("PaymentController.%s - canAccessOrderPayment guard", (name, handler, serviceFn) => {

    it("allows an admin from the order's own tenant, same branch", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRow());

        const req = { body: { orderId: 42 }, user: { id: 7, role: "admin", tenantId: 3, branchId: 9 } };
        const res = buildRes();

        handler(req, res, vi.fn());

        await vi.waitFor(() => expect(serviceFn).toHaveBeenCalled());

    });

    it("allows the customer who owns the order", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRow());

        const req = { body: { orderId: 42 }, user: { id: 100, role: "customer" } };
        const res = buildRes();

        handler(req, res, vi.fn());

        await vi.waitFor(() => expect(serviceFn).toHaveBeenCalled());

    });

    it("rejects a different customer entirely, before the service is ever called", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRow());

        const req = { body: { orderId: 42 }, user: { id: 999, role: "customer" } };
        const res = buildRes();

        handler(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(serviceFn).not.toHaveBeenCalled();

    });

    it("rejects an admin from another tenant, before the service is ever called", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRow({ TenantId: 3 }));

        const req = { body: { orderId: 42 }, user: { id: 7, role: "admin", tenantId: 999, branchId: null } };
        const res = buildRes();

        handler(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(serviceFn).not.toHaveBeenCalled();

    });

    it("rejects a branch admin from a different branch in the same tenant", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRow({ TenantId: 3, BranchId: 9 }));

        const req = { body: { orderId: 42 }, user: { id: 7, role: "admin", tenantId: 3, branchId: 55 } };
        const res = buildRes();

        handler(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(serviceFn).not.toHaveBeenCalled();

    });

    it("returns 404 without calling the service when the order doesn't exist", async () => {

        OrderRepository.getOrderById.mockResolvedValue([]);

        const req = { body: { orderId: 999 }, user: { id: 7, role: "admin", tenantId: 3, branchId: null } };
        const res = buildRes();

        handler(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));
        expect(serviceFn).not.toHaveBeenCalled();

    });

});

describe("PaymentController.getPaymentByOrderId", () => {

    it("returns the payment for an authorized caller", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRow());

        const req = { params: { orderId: 42 }, user: { id: 7, role: "admin", tenantId: 3, branchId: null } };
        const res = buildRes();

        getPaymentByOrderId(req, res, vi.fn());

        await vi.waitFor(() => expect(PaymentService.getPaymentByOrderId).toHaveBeenCalledWith(42));

    });

    it("returns 404 when the order has no payment yet, distinct from an authorization failure", async () => {

        OrderRepository.getOrderById.mockResolvedValue(orderRow());
        PaymentService.getPaymentByOrderId.mockResolvedValue({ success: true, message: "Payment fetched.", data: [] });

        const req = { params: { orderId: 42 }, user: { id: 7, role: "admin", tenantId: 3, branchId: null } };
        const res = buildRes();

        getPaymentByOrderId(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));

    });

});

describe("PaymentController.getPaymentsByCustomer", () => {

    it("allows a customer to view their own payment history", async () => {

        const req = { params: { customerId: "100" }, user: { id: 100, role: "customer" } };
        const res = buildRes();

        getPaymentsByCustomer(req, res, vi.fn());

        await vi.waitFor(() => expect(PaymentService.getPaymentsByCustomer).toHaveBeenCalledWith("100"));

    });

    it("rejects a customer trying to view someone else's payment history", async () => {

        const req = { params: { customerId: "555" }, user: { id: 100, role: "customer" } };
        const res = buildRes();

        getPaymentsByCustomer(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(PaymentService.getPaymentsByCustomer).not.toHaveBeenCalled();

    });

    it("allows an admin to view a customer's history within their own tenant", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: 100, TenantId: 3 });

        const req = { params: { customerId: "100" }, user: { id: 7, role: "admin", tenantId: 3 } };
        const res = buildRes();

        getPaymentsByCustomer(req, res, vi.fn());

        await vi.waitFor(() => expect(PaymentService.getPaymentsByCustomer).toHaveBeenCalledWith("100"));

    });

    it("rejects an admin trying to reach a customer in another tenant", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: 100, TenantId: 999 });

        const req = { params: { customerId: "100" }, user: { id: 7, role: "admin", tenantId: 3 } };
        const res = buildRes();

        getPaymentsByCustomer(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(PaymentService.getPaymentsByCustomer).not.toHaveBeenCalled();

    });

});
