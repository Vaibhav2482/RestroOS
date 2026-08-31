import bcrypt from "bcrypt";
import crypto from "crypto";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

const GUEST_PHONE = "0000000000";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const fullName = customer.fullName?.trim();
    const email = customer.email?.trim();
    const phone = customer.phone?.trim();

    if (!fullName) {
        return { success: false, message: "Full Name is required." };
    }

    if (!email) {
        return { success: false, message: "Email is required." };
    }

    if (!EMAIL_PATTERN.test(email)) {
        return { success: false, message: "Enter a valid email address." };
    }

    if (!phone) {
        return { success: false, message: "Phone is required." };
    }

    if (email !== existingCustomer.Email) {

        const emailOwner = await CustomerRepository.getCustomerByTenantAndEmail(existingCustomer.TenantId, email);

        if (emailOwner && String(emailOwner.CustomerId) !== String(customerId)) {
            return { success: false, message: "Email already registered." };
        }

    }

    const updatedCustomer = await CustomerRepository.updateCustomer({
        customerId: Number(customerId),
        fullName,
        email,
        phone,
        avatarUrl: customer.avatarUrl ?? existingCustomer.AvatarUrl
    });

    return { success: true, message: "Customer updated successfully.", data: updatedCustomer };

};

const MIN_PASSWORD_LENGTH = 8;

// Self-service - the customer's own password change, verified against the
// current hash the same way AdminService's equivalent is. Never touches
// FullName/Email/Phone, so it can't be used to smuggle a profile edit
// through alongside a password change.
export const changeOwnPassword = async (customerId, currentPassword, newPassword) => {

    if (!currentPassword) {
        return { success: false, message: "Current password is required." };
    }

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        return { success: false, message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }

    const existingCustomer = await CustomerRepository.getCustomerById(customerId);

    if (!existingCustomer) {
        return { success: false, message: "Customer not found." };
    }

    const currentHash = await CustomerRepository.getPasswordHash(customerId);
    const isCorrect = currentHash && await bcrypt.compare(currentPassword, currentHash);

    if (!isCorrect) {
        return { success: false, message: "Current password is incorrect." };
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await CustomerRepository.updatePassword(customerId, newHash);

    return { success: true, message: "Password changed successfully." };

};

export const getAllCustomers = async (tenantId, pagination = null, filters = null) => {

    const result = await CustomerRepository.getAllCustomersByTenant(tenantId, pagination, filters);

    if (!pagination) {
        return { success: true, message: "Customers fetched successfully.", data: result };
    }

    return {
        success: true,
        message: "Customers fetched successfully.",
        data: { customers: result.customers, total: result.total, page: pagination.page, limit: pagination.limit }
    };

};
