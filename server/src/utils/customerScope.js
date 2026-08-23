import * as CustomerRepository from "../repositories/CustomerRepository.js";

// A customer can always act on their own account (self-service - cart,
// addresses, coupons, orders); an admin can act on any customer that
// belongs to their own tenant (staff/POS actions on a customer's behalf).
// Anyone else - a different customer, or an admin from another tenant -
// cannot, regardless of what customerId a request asks for.
//
// ChaiChakhna's original equivalent let ANY admin bypass the ownership
// check purely on role === "admin" - fine in a single-tenant app, but here
// that would let an admin from Tenant A read/write Tenant B's customer
// data just by guessing a customerId. This checks the admin's own tenant
// against the customer's before allowing the bypass.
export const canActOnCustomer = async (req, customerId) => {

    if (String(req.user.id) === String(customerId) && req.user.role === "customer") {
        return true;
    }

    if (req.user.role !== "admin") {
        return false;
    }

    const customer = await CustomerRepository.getCustomerById(customerId);

    return Boolean(customer && customer.TenantId === req.user.tenantId);

};
