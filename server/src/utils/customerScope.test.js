import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/CustomerRepository.js");

const CustomerRepository = await import("../repositories/CustomerRepository.js");
const { canActOnCustomer } = await import("./customerScope.js");

beforeEach(() => {
    vi.clearAllMocks();
});

// Extracted from 4 controllers (Cart, Coupon, CustomerAddress, Order) that
// each reimplemented this identically - a production-readiness audit
// flagged the duplication. These tests exist here now so the one shared
// implementation only needs proving correct once, not at every call site.
describe("canActOnCustomer", () => {

    it("lets a customer act on their own account", async () => {

        const req = { user: { role: "customer", id: 7 } };

        expect(await canActOnCustomer(req, 7)).toBe(true);
        expect(CustomerRepository.getCustomerById).not.toHaveBeenCalled();

    });

    it("never lets a customer act on a different customer's account", async () => {

        const req = { user: { role: "customer", id: 7 } };

        expect(await canActOnCustomer(req, 8)).toBe(false);

    });

    it("lets an admin act on a customer belonging to their own tenant", async () => {

        const req = { user: { role: "admin", id: 3, tenantId: 9 } };
        CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: 7, TenantId: 9 });

        expect(await canActOnCustomer(req, 7)).toBe(true);

    });

    it("never lets an admin act on another tenant's customer", async () => {

        const req = { user: { role: "admin", id: 3, tenantId: 9 } };
        CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: 7, TenantId: 99 });

        expect(await canActOnCustomer(req, 7)).toBe(false);

    });

    it("returns false when the customer does not exist at all", async () => {

        const req = { user: { role: "admin", id: 3, tenantId: 9 } };
        CustomerRepository.getCustomerById.mockResolvedValue(undefined);

        expect(await canActOnCustomer(req, 999)).toBe(false);

    });

    it("rejects any role other than customer/admin without a lookup", async () => {

        const req = { user: { role: "platform_admin", id: 1 } };

        expect(await canActOnCustomer(req, 7)).toBe(false);
        expect(CustomerRepository.getCustomerById).not.toHaveBeenCalled();

    });

});
