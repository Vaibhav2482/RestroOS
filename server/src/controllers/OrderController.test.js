import { describe, it, expect, vi, beforeEach } from "vitest";

import { createOrder, getAllOrders, getDashboardSummary } from "./OrderController.js";
import * as OrderService from "../services/OrderService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

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
    OrderService.getAllOrders.mockResolvedValue({ success: true, message: "Orders fetched successfully.", data: [] });
    OrderService.getDashboardSummary.mockResolvedValue({ success: true, message: "Dashboard summary fetched successfully.", data: {} });
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

describe("OrderController.getAllOrders - pagination is opt-in from the query string", () => {

    it("passes no pagination through when neither page nor limit is in the query", async () => {

        const req = { query: {}, user: { id: 7, role: "admin", tenantId: 3, branchId: null } };

        getAllOrders(req, buildRes(), vi.fn());

        await vi.waitFor(() => expect(OrderService.getAllOrders).toHaveBeenCalledWith(3, undefined, null, null));

    });

    it("parses page/limit from the query string and clamps limit to the maximum page size", async () => {

        const req = { query: { page: "2", limit: "500" }, user: { id: 7, role: "admin", tenantId: 3, branchId: null } };

        getAllOrders(req, buildRes(), vi.fn());

        await vi.waitFor(() => expect(OrderService.getAllOrders).toHaveBeenCalledWith(3, undefined, null, { page: 2, limit: 100 }));

    });

    it("falls back to page 1 for a garbage page value instead of erroring", async () => {

        const req = { query: { page: "not-a-number", limit: "10" }, user: { id: 7, role: "admin", tenantId: 3, branchId: null } };

        getAllOrders(req, buildRes(), vi.fn());

        await vi.waitFor(() => expect(OrderService.getAllOrders).toHaveBeenCalledWith(3, undefined, null, { page: 1, limit: 10 }));

    });

});

describe("OrderController.getDashboardSummary", () => {

    it("scopes the summary to the caller's tenant and branch", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 9, TenantId: 3 });

        const req = { query: { branchId: "9" }, user: { id: 7, role: "admin", tenantId: 3, branchId: 9 } };

        getDashboardSummary(req, buildRes(), vi.fn());

        await vi.waitFor(() => expect(OrderService.getDashboardSummary).toHaveBeenCalledWith(3, 9));

    });

});
