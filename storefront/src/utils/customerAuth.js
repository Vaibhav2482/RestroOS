// A customer's account is tenant-owned (email uniqueness is per-tenant, not
// platform-wide), so someone browsing two different restaurants on RestroOS
// in the same browser needs two separate logins. Auth (and the selected
// branch) is therefore stored per tenantSlug, not as one global session.

export const getTenantSlugFromPath = () => window.location.pathname.split("/")[1] || null;

export const getStoredAuth = (tenantSlug) => {

    try {
        return JSON.parse(localStorage.getItem(`customerAuth_${tenantSlug}`));
    } catch {
        return null;
    }

};

export const setStoredAuth = (tenantSlug, auth) => {
    localStorage.setItem(`customerAuth_${tenantSlug}`, JSON.stringify(auth));
};

export const clearStoredAuth = (tenantSlug) => {
    localStorage.removeItem(`customerAuth_${tenantSlug}`);
};

export const getStoredBranchId = (tenantSlug) => {

    const value = localStorage.getItem(`customerBranch_${tenantSlug}`);
    return value ? Number(value) : null;

};

export const setStoredBranchId = (tenantSlug, branchId) => {
    localStorage.setItem(`customerBranch_${tenantSlug}`, String(branchId));
};
