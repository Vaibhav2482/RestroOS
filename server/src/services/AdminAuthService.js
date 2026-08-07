import bcrypt from "bcrypt";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as TenantRepository from "../repositories/TenantRepository.js";
import { MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } from "../config/lockoutPolicy.js";

// Admin emails are unique per-tenant, not platform-wide (two different
// restaurants can each have their own "owner@example.com"), so a plain
// email+password login is ambiguous without also knowing which tenant.
// tenantSlug pins that down - it's what the tenant's own login page/URL
// already knows about itself.
export const login = async (tenantSlug, email, password) => {

    if (!tenantSlug || !email || !password) {
        return { success: false, message: "Restaurant, email, and password are required." };
    }

    const tenant = await TenantRepository.getBySlug(tenantSlug);

    if (!tenant || !tenant.IsActive) {
        return { success: false, message: "Restaurant not found." };
    }

    const admin = await AdminRepository.getByTenantAndEmail(tenant.TenantId, email);

    if (!admin) {
        return { success: false, message: "Invalid email or password." };
    }

    // Checked before the password compare, not after - a locked account
    // shouldn't leak whether the attempted password was actually correct.
    if (admin.LockedUntil && new Date(admin.LockedUntil) > new Date()) {
        return { success: false, message: `Too many failed attempts. Try again in a few minutes.` };
    }

    const passwordMatches = await bcrypt.compare(password, admin.Password);

    if (!passwordMatches) {

        const nextAttempts = admin.FailedLoginAttempts + 1;
        const lockedUntil = nextAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null;

        await AdminRepository.recordFailedLogin(admin.AdminId, lockedUntil);

        return {
            success: false,
            message: lockedUntil
                ? `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`
                : "Invalid email or password."
        };

    }

    await AdminRepository.resetFailedLogins(admin.AdminId);

    delete admin.Password;
    delete admin.FailedLoginAttempts;
    delete admin.LockedUntil;

    return {
        success: true,
        message: "Login successful.",
        data: { ...admin, tenantSlug: tenant.Slug, tenantName: tenant.TenantName, tenantDisabledFeatures: tenant.DisabledFeatures || [] }
    };

};
