import axiosClient from "../api/axiosClient";

// Unauthenticated, tenant-slug-scoped browsing endpoints - used before a
// customer has logged in (or even created an account).

// Resolves the tenant's display name from its URL slug - also doubles as
// the "does this restaurant exist?" check for an unknown/mistyped slug.
export const getPublicTenant = async (tenantSlug) => {
    const response = await axiosClient.get("/tenants/public", { params: { slug: tenantSlug } });
    return response.data;
};

export const getActiveBranches = async (tenantSlug) => {
    const response = await axiosClient.get("/branches/active", { params: { tenant: tenantSlug } });
    return response.data;
};

export const getPublicCategories = async (tenantSlug) => {
    const response = await axiosClient.get("/categories/public", { params: { tenant: tenantSlug } });
    return response.data;
};

// Menu items are looked up by branchId (already resolved via getActiveBranches),
// not by tenant slug directly.
export const getMenuItems = async (branchId) => {
    const response = await axiosClient.get("/menu", { params: { branchId } });
    return response.data;
};

// Public, unauthenticated cross-sell suggestions for a given menu item -
// up to 6 other items from the same branch (same category preferred, then
// popular items), excluding the item itself.
export const getRecommendations = async (menuItemId) => {
    const response = await axiosClient.get(`/menu/${menuItemId}/recommendations`);
    return response.data;
};
