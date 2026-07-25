import bcrypt from "bcrypt";
import crypto from "crypto";
import * as TenantRepository from "../repositories/TenantRepository.js";
import * as AdminRepository from "../repositories/AdminRepository.js";

const slugify = (text) =>
    text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

export const getPublicTenant = async (slug) => {

    const tenant = await TenantRepository.getPublicBySlug(slug);

    if (!tenant) {
        return { success: false, message: "Restaurant not found." };
    }

    return { success: true, message: "Restaurant found.", data: tenant };

};

export const getAllTenants = async () => {

    const tenants = await TenantRepository.getAll();

    return { success: true, message: "Tenants fetched successfully.", data: tenants };

};

export const createTenant = async (tenant) => {

    if (!tenant.tenantName || tenant.tenantName.trim() === "") {
        return { success: false, message: "Restaurant name is required." };
    }

    if (!tenant.ownerEmail || tenant.ownerEmail.trim() === "") {
        return { success: false, message: "Owner email is required." };
    }

    const slug = tenant.slug?.trim() ? slugify(tenant.slug) : slugify(tenant.tenantName);

    if (!slug) {
        return { success: false, message: "Could not derive a valid URL slug from the restaurant name." };
    }

    const existing = await TenantRepository.getBySlug(slug);

    if (existing) {
        return { success: false, message: `The slug "${slug}" is already taken. Try a different restaurant name or a custom slug.` };
    }

    // No email delivery is wired up yet, so the one-time owner password is
    // handed back in this response for you (the platform admin) to relay -
    // same "shown once, never stored in plaintext" pattern as a cloud
    // console creating a new account's initial credentials.
    const temporaryPassword = crypto.randomBytes(9).toString("base64url");
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const { tenant: createdTenant, admin } = await TenantRepository.createWithOwnerAdmin(
        { ...tenant, slug },
        hashedPassword
    );

    return {
        success: true,
        message: "Restaurant onboarded successfully.",
        data: {
            ...createdTenant,
            ownerAdmin: { adminId: admin.AdminId, email: admin.Email, temporaryPassword }
        }
    };

};

// There's no self-service "forgot password" for tenant-admin logins (this
// app deliberately has no email channel) - a platform admin generating and
// relaying a new one is the recovery path instead. Same "shown once, never
// stored in plaintext" pattern as the temporary password from onboarding.
export const resetOwnerPassword = async (tenantId) => {

    const tenant = await TenantRepository.getById(tenantId);

    if (!tenant) {
        return { success: false, message: "Restaurant not found." };
    }

    const admin = await AdminRepository.getByTenantAndEmailAny(tenant.TenantId, tenant.OwnerEmail);

    if (!admin) {
        return { success: false, message: "No admin account found for this restaurant's owner email." };
    }

    const temporaryPassword = crypto.randomBytes(9).toString("base64url");
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    await AdminRepository.resetPassword(admin.AdminId, hashedPassword);

    return {
        success: true,
        message: "Password reset successfully.",
        data: { adminId: admin.AdminId, email: admin.Email, temporaryPassword }
    };

};
