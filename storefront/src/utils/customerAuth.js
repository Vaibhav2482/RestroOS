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

// The table a customer scanned into, kept for the rest of their visit (not
// just the one page load that had ?table= in the URL) - they may navigate
// around the menu, or even close and reopen the tab, before checking out.
export const getStoredTableNumber = (tenantSlug) => localStorage.getItem(`customerTable_${tenantSlug}`) || null;

export const setStoredTableNumber = (tenantSlug, tableNumber) => {
    localStorage.setItem(`customerTable_${tenantSlug}`, tableNumber);
};

export const clearStoredTableNumber = (tenantSlug) => {
    localStorage.removeItem(`customerTable_${tenantSlug}`);
};
