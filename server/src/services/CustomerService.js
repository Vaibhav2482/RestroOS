import bcrypt from "bcrypt";
import crypto from "crypto";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

const GUEST_PHONE = "0000000000";

// A no-login placeholder customer for POS/dine-in orders where staff don't
// want to collect any details. Scoped per tenant (not a single global row)
// since Customers are tenant-owned and the phone/email uniqueness
// constraints are per-tenant.
export const getOrCreateGuestCustomer = async (tenantId) => {

    const existing = await CustomerRepository.getCustomerByTenantAndPhone(tenantId, GUEST_PHONE);

    if (existing) {
        delete existing.Password;
        return { success: true, message: "Guest customer ready.", data: existing };
    }

    const randomPassword = crypto.randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const createdCustomer = await CustomerRepository.createCustomer({
        tenantId,
        fullName: "Walk-in Guest",
        email: `guest@tenant-${tenantId}.restroos.local`,
        phone: GUEST_PHONE,
        password: hashedPassword
    });

    delete createdCustomer.Password;

    return { success: true, message: "Guest customer ready.", data: createdCustomer };

};

// Looks a customer up by phone within the tenant; creates one if none
// exists yet, so POS staff can attach a real name/phone to a dine-in order
// without that customer ever setting a password of their own.
export const findOrCreateWalkInCustomer = async (customer, tenantId) => {

    if (!customer.phone || customer.phone.trim() === "") {
        return { success: false, message: "Phone is required." };
    }

    const phone = customer.phone.trim();

    const existingCustomer = await CustomerRepository.getCustomerByTenantAndPhone(tenantId, phone);

    if (existingCustomer) {
        delete existingCustomer.Password;
        return { success: true, message: "Existing customer found.", data: existingCustomer };
    }

    if (!customer.fullName || customer.fullName.trim() === "") {
        return { success: false, message: "Full Name is required for a new customer." };
    }

    const email = customer.email && customer.email.trim() !== ""
        ? customer.email.trim()
        : `walkin.${phone}@tenant-${tenantId}.restroos.local`;

    const existingByEmail = await CustomerRepository.getCustomerByTenantAndEmail(tenantId, email);

    if (existingByEmail) {
        return { success: false, message: "A customer with this email already exists." };
    }

    const randomPassword = crypto.randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const createdCustomer = await CustomerRepository.createCustomer({
        tenantId,
        fullName: customer.fullName.trim(),
        email,
        phone,
        password: hashedPassword
    });

    delete createdCustomer.Password;

    return { success: true, message: "Walk-in customer created successfully.", data: createdCustomer };

};

export const getCustomerById = async (customerId) => {

    const customer = await CustomerRepository.getCustomerById(customerId);

    if (!customer) {
        return { success: false, message: "Customer not found." };
    }

    return { success: true, message: "Customer fetched successfully.", data: customer };

};

export const updateCustomer = async (customerId, customer) => {

    const existingCustomer = await CustomerRepository.getCustomerById(customerId);

    if (!existingCustomer) {
        return { success: false, message: "Customer not found." };
    }

    customer.customerId = Number(customerId);

    const updatedCustomer = await CustomerRepository.updateCustomer(customer);

    return { success: true, message: "Customer updated successfully.", data: updatedCustomer };

};

export const getAllCustomers = async (tenantId) => {

    const customers = await CustomerRepository.getAllCustomersByTenant(tenantId);

    return { success: true, message: "Customers fetched successfully.", data: customers };

};
