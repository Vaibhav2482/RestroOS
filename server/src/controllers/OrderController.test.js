import { describe, it, expect, vi, beforeEach } from "vitest";

import { createOrder } from "./OrderController.js";
import * as OrderService from "../services/OrderService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

vi.mock("../services/OrderService.js");
vi.mock("../repositories/CustomerRepository.js");
vi.mock("../repositories/BranchRepository.js");

const buildRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

beforeEach(() => {

    vi.clearAllMocks();
    OrderService.createOrder.mockResolvedValue({ success: true, message: "Order placed successfully.", data: { OrderId: 1 } });
    // canActOnCustomer looks this up for any admin-placed order (self-placed
    // customer orders skip it entirely) - defaults to the happy path of a
    // customer belonging to the acting admin's own tenant.
    CustomerRepository.getCustomerById.mockResolvedValue({ TenantId: 3 });

});

// The whole point of CreatedByAdminId is that it can't be forged - a
// discount, a suspicious cancellation, or a later dispute needs to trace
// back to whoever actually rang the order up, not whoever the client
// claims that was.
describe("OrderController.createOrder - staff attribution", () => {

    it("attributes the order to the authenticated admin from the token", async () => {

        const req = { user: { id: 7, role: "admin", tenantId: 3 }, body: { customerId: 1, items: [] } };

        // asyncHandler (utils/AsyncHandler.js) fires the controller body
        // without awaiting or returning its promise, so `await createOrder(...)`
        // alone doesn't wait for it to finish - vi.waitFor polls until the
        // fire-and-forget async work has actually landed.
        createOrder(req, buildRes(), vi.fn());

        await vi.waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({ createdByAdminId: 7 })
        ));

    });

    it("ignores any createdByAdminId supplied in the request body itself", async () => {

        const req = { user: { id: 7, role: "admin", tenantId: 3 }, body: { customerId: 1, items: [], createdByAdminId: 999 } };

        createOrder(req, buildRes(), vi.fn());

        await vi.waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({ createdByAdminId: 7 })
        ));

    });

    it("leaves attribution null when a customer places their own order", async () => {

        const req = { user: { id: 42, role: "customer" }, body: { customerId: 42, items: [] } };

        createOrder(req, buildRes(), vi.fn());

        await vi.waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({ createdByAdminId: null })
        ));

    });

    it("rejects an admin placing an order for a customer outside their own tenant, before attribution even matters", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue({ TenantId: 99 });

        const req = { user: { id: 7, role: "admin", tenantId: 3 }, body: { customerId: 1, items: [] } };
        const res = buildRes();

        createOrder(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(OrderService.createOrder).not.toHaveBeenCalled();

    });

});
