import * as TenantRepository from "../repositories/TenantRepository.js";

const slugify = (text) =>
    text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

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

    const created = await TenantRepository.create({ ...tenant, slug });

    return { success: true, message: "Restaurant onboarded successfully.", data: created };

};
