import bcrypt from "bcrypt";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as TenantRepository from "../repositories/TenantRepository.js";

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

    const passwordMatches = await bcrypt.compare(password, admin.Password);

    if (!passwordMatches) {
        return { success: false, message: "Invalid email or password." };
    }

    delete admin.Password;

    return { success: true, message: "Login successful.", data: { ...admin, tenantSlug: tenant.Slug, tenantName: tenant.TenantName } };

};
