import bcrypt from "bcrypt";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import * as TenantRepository from "../repositories/TenantRepository.js";

export const register = async (tenantSlug, customer) => {

    if (!tenantSlug) {
        return { success: false, message: "Restaurant is required." };
    }

    if (!customer.fullName || customer.fullName.trim() === "") {
        return { success: false, message: "Full Name is required." };
    }

    if (!customer.email || customer.email.trim() === "") {
        return { success: false, message: "Email is required." };
    }

    if (!customer.phone || customer.phone.trim() === "") {
        return { success: false, message: "Phone is required." };
    }

    if (!customer.password || customer.password.trim() === "") {
        return { success: false, message: "Password is required." };
    }

    const tenant = await TenantRepository.getBySlug(tenantSlug);

    if (!tenant || !tenant.IsActive) {
        return { success: false, message: "Restaurant not found." };
    }

    const existing = await CustomerRepository.getCustomerByTenantAndEmail(tenant.TenantId, customer.email);

    if (existing) {
        return { success: false, message: "Email already registered." };
    }

    const hashedPassword = await bcrypt.hash(customer.password, 10);

    const created = await CustomerRepository.createCustomer({
        ...customer,
        tenantId: tenant.TenantId,
        password: hashedPassword
    });

    delete created.Password;

    return { success: true, message: "Customer registered successfully.", data: created };

};

// Same reasoning as AdminAuthService: Customer emails are unique per-tenant,
// not platform-wide, so login needs to know which restaurant it's for.
export const login = async (tenantSlug, email, password) => {

    if (!tenantSlug || !email || !password) {
        return { success: false, message: "Restaurant, email, and password are required." };
    }

    const tenant = await TenantRepository.getBySlug(tenantSlug);

    if (!tenant || !tenant.IsActive) {
        return { success: false, message: "Restaurant not found." };
    }

    const customer = await CustomerRepository.customerLogin(tenant.TenantId, email);

    if (!customer) {
        return { success: false, message: "Invalid Email or Password." };
    }

    const passwordMatches = await bcrypt.compare(password, customer.Password);

    if (!passwordMatches) {
        return { success: false, message: "Invalid Email or Password." };
    }

    delete customer.Password;

    return { success: true, message: "Login successful.", data: { ...customer, tenantSlug: tenant.Slug } };

};
