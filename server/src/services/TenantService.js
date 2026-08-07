import bcrypt from "bcrypt";
import crypto from "crypto";
import * as TenantRepository from "../repositories/TenantRepository.js";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as NotificationService from "./NotificationService.js";
import { sanitizeDisabledFeatures } from "../config/permissions.js";

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

export const getOwnTenant = async (tenantId) => {

    const tenant = await TenantRepository.getById(tenantId);

    if (!tenant) {
        return { success: false, message: "Restaurant not found." };
    }

    return { success: true, message: "Restaurant found.", data: tenant };

};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const updateBranding = async (tenantId, { logoUrl, primaryColor }) => {

    if (primaryColor && !HEX_COLOR.test(primaryColor)) {
        return { success: false, message: "Theme color must be a hex code like #4F46E5." };
    }

    const tenant = await TenantRepository.updateBranding(tenantId, { logoUrl, primaryColor });

    return { success: true, message: "Branding updated.", data: tenant };

};

// Reachable two ways: a tenant's own Owner via PUT /tenants/me/features
// (tenantId always valid there - it's their own JWT's tenantId) and a
// platform admin via PUT /platform-admin/tenants/:tenantId/features (an
// arbitrary, typeable id) - the existence check matters for the second path.
export const updateDisabledFeatures = async (tenantId, disabledFeatures) => {

    const existing = await TenantRepository.getById(tenantId);

    if (!existing) {
        return { success: false, message: "Restaurant not found." };
    }

    const tenant = await TenantRepository.updateDisabledFeatures(tenantId, sanitizeDisabledFeatures(disabledFeatures));

    return { success: true, message: "Features updated.", data: tenant };

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

    // The one-time owner password is also handed back in this response for
    // you (the platform admin) to relay yourself - notifyOwnerCredentials is
    // best-effort (silently skips if Resend isn't configured, or if the
    // send fails), so this stays the guaranteed path, same "shown once,
    // never stored in plaintext" pattern as a cloud console creating a new
    // account's initial credentials.
    const temporaryPassword = crypto.randomBytes(9).toString("base64url");
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const { tenant: createdTenant, admin } = await TenantRepository.createWithOwnerAdmin(
        { ...tenant, slug },
        hashedPassword
    );

    await NotificationService.notifyOwnerCredentials({
        tenantName: createdTenant.TenantName,
        email: admin.Email,
        temporaryPassword,
        isReset: false
    });

    return {
        success: true,
        message: "Restaurant onboarded successfully.",
        data: {
            ...createdTenant,
            ownerAdmin: { adminId: admin.AdminId, email: admin.Email, temporaryPassword }
        }
    };

};

export const suspendTenant = async (tenantId) => {

    const tenant = await TenantRepository.getById(tenantId);

    if (!tenant) {
        return { success: false, message: "Restaurant not found." };
    }

    if (!tenant.IsActive) {
        return { success: false, message: "This restaurant is already suspended." };
    }

    const updated = await TenantRepository.setActive(tenantId, false);

    return { success: true, message: "Restaurant suspended.", data: updated };

};

export const reactivateTenant = async (tenantId) => {

    const tenant = await TenantRepository.getById(tenantId);

    if (!tenant) {
        return { success: false, message: "Restaurant not found." };
    }

    if (tenant.IsActive) {
        return { success: false, message: "This restaurant is already active." };
    }

    const updated = await TenantRepository.setActive(tenantId, true);

    return { success: true, message: "Restaurant reactivated.", data: updated };

};

// There's no self-service "forgot password" for tenant-admin logins - a
// platform admin generating and relaying a new one is the recovery path
// instead. notifyOwnerCredentials emails it too when Resend is configured,
// but the response below still carries it (same "shown once, never stored
// in plaintext" pattern as onboarding) since that email is best-effort.
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

    await NotificationService.notifyOwnerCredentials({
        tenantName: tenant.TenantName,
        email: admin.Email,
        temporaryPassword,
        isReset: true
    });

    return {
        success: true,
        message: "Password reset successfully.",
        data: { adminId: admin.AdminId, email: admin.Email, temporaryPassword }
    };

};
