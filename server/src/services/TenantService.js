import bcrypt from "bcrypt";
import crypto from "crypto";
import * as TenantRepository from "../repositories/TenantRepository.js";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as NotificationService from "./NotificationService.js";
import * as AuditService from "./AuditService.js";
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

const DELIVERY_STAFFING_MODES = new Set(["branch_staff", "dedicated_riders"]);

export const updateDeliveryStaffingMode = async (tenantId, deliveryStaffingMode) => {

    if (!DELIVERY_STAFFING_MODES.has(deliveryStaffingMode)) {
        return { success: false, message: "Delivery staffing mode must be 'branch_staff' or 'dedicated_riders'." };
    }

    const tenant = await TenantRepository.updateDeliveryStaffingMode(tenantId, deliveryStaffingMode);

    return { success: true, message: "Delivery settings updated.", data: tenant };

};

// The tenant Owner's own self-service toggle - PUT /tenants/me/features,
// tenantId always valid here since it's their own JWT's. Distinct from
// updatePlatformRestrictedFeatures below, which is the platform-admin-only
// plan-tier restriction the Owner can never touch: whatever's already in
// PlatformRestrictedFeatures is force-unioned back into whatever the Owner
// submits, so even a tampered/stale request that tries to "enable" a
// platform-restricted key just has it silently kept disabled - the real
// defense is the frontend never rendering it as toggleable at all
// (tenant-admin's Features.jsx), this is only the backstop.
export const updateDisabledFeatures = async (tenantId, disabledFeatures, actorAdminId = null) => {

    const existing = await TenantRepository.getById(tenantId);

    if (!existing) {
        return { success: false, message: "Restaurant not found." };
    }

    const merged = [...new Set([
        ...sanitizeDisabledFeatures(disabledFeatures),
        ...(existing.PlatformRestrictedFeatures || [])
    ])];

    const tenant = await TenantRepository.updateDisabledFeatures(tenantId, merged);

    if (actorAdminId) {
        AuditService.record({
            tenantId,
            actorAdminId,
            action: "TENANT_FEATURES_UPDATED",
            entityType: "Tenant",
            entityId: Number(tenantId),
            summary: `Owner updated feature toggles for "${existing.TenantName}"`
        });
    }

    return { success: true, message: "Features updated.", data: tenant };

};

// Platform-admin-only, PUT /platform-admin/tenants/:tenantId/features - a
// plan-tier restriction, not the tenant's own preference. Audited under a
// distinct action from TENANT_FEATURES_UPDATED so the two are told apart
// in the audit log (platform changed this tenant's plan, vs. the tenant
// changed their own preference).
export const updatePlatformRestrictedFeatures = async (tenantId, platformRestrictedFeatures, actorPlatformAdminId = null) => {

    const existing = await TenantRepository.getById(tenantId);

    if (!existing) {
        return { success: false, message: "Restaurant not found." };
    }

    const tenant = await TenantRepository.updatePlatformRestrictedFeatures(tenantId, sanitizeDisabledFeatures(platformRestrictedFeatures));

    if (actorPlatformAdminId) {
        AuditService.record({
            tenantId,
            actorPlatformAdminId,
            actorType: "PlatformAdmin",
            action: "TENANT_PLATFORM_RESTRICTIONS_UPDATED",
            entityType: "Tenant",
            entityId: Number(tenantId),
            summary: `Platform admin updated plan restrictions for "${existing.TenantName}"`
        });
    }

    return { success: true, message: "Features updated.", data: tenant };

};

export const getAllTenants = async () => {

    const tenants = await TenantRepository.getAll();

    return { success: true, message: "Tenants fetched successfully.", data: tenants };

};

export const createTenant = async (tenant, actorPlatformAdminId = null) => {

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

    AuditService.record({
        tenantId: createdTenant.TenantId,
        actorPlatformAdminId,
        actorType: "PlatformAdmin",
        action: "TENANT_CREATED",
        entityType: "Tenant",
        entityId: createdTenant.TenantId,
        summary: `Platform admin onboarded "${createdTenant.TenantName}"`
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

export const suspendTenant = async (tenantId, actorPlatformAdminId = null) => {

    const tenant = await TenantRepository.getById(tenantId);

    if (!tenant) {
        return { success: false, message: "Restaurant not found." };
    }

    if (!tenant.IsActive) {
        return { success: false, message: "This restaurant is already suspended." };
    }

    const updated = await TenantRepository.setActive(tenantId, false);

    AuditService.record({
        tenantId,
        actorPlatformAdminId,
        actorType: "PlatformAdmin",
        action: "TENANT_SUSPENDED",
        entityType: "Tenant",
        entityId: Number(tenantId),
        summary: `Platform admin suspended "${tenant.TenantName}"`
    });

    return { success: true, message: "Restaurant suspended.", data: updated };

};

export const reactivateTenant = async (tenantId, actorPlatformAdminId = null) => {

    const tenant = await TenantRepository.getById(tenantId);

    if (!tenant) {
        return { success: false, message: "Restaurant not found." };
    }

    if (tenant.IsActive) {
        return { success: false, message: "This restaurant is already active." };
    }

    const updated = await TenantRepository.setActive(tenantId, true);

    AuditService.record({
        tenantId,
        actorPlatformAdminId,
        actorType: "PlatformAdmin",
        action: "TENANT_REACTIVATED",
        entityType: "Tenant",
        entityId: Number(tenantId),
        summary: `Platform admin reactivated "${tenant.TenantName}"`
    });

    return { success: true, message: "Restaurant reactivated.", data: updated };

};

// There's no self-service "forgot password" for tenant-admin logins - a
// platform admin generating and relaying a new one is the recovery path
// instead. notifyOwnerCredentials emails it too when Resend is configured,
// but the response below still carries it (same "shown once, never stored
// in plaintext" pattern as onboarding) since that email is best-effort.
export const resetOwnerPassword = async (tenantId, actorPlatformAdminId = null) => {

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

    // A stolen-but-still-valid token doesn't contain the password - bumping
    // TokenVersion here closes the same gap AdminService.changeOwnPassword
    // closes for a self-service change, for a platform-admin-triggered reset.
    await AdminRepository.bumpTokenVersion(admin.AdminId);

    await NotificationService.notifyOwnerCredentials({
        tenantName: tenant.TenantName,
        email: admin.Email,
        temporaryPassword,
        isReset: true
    });

    AuditService.record({
        tenantId,
        actorPlatformAdminId,
        actorType: "PlatformAdmin",
        action: "TENANT_OWNER_PASSWORD_RESET",
        entityType: "Tenant",
        entityId: Number(tenantId),
        summary: `Platform admin reset the owner password for "${tenant.TenantName}"`
    });

    return {
        success: true,
        message: "Password reset successfully.",
        data: { adminId: admin.AdminId, email: admin.Email, temporaryPassword }
    };

};
