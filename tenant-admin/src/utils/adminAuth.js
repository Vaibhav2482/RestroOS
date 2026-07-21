export const getStoredAuth = () => {

    try {
        return JSON.parse(localStorage.getItem("tenantAdmin"));
    } catch {
        return null;
    }

};

export const setStoredAuth = (auth) => {
    localStorage.setItem("tenantAdmin", JSON.stringify(auth));
};

export const clearStoredAuth = () => {
    localStorage.removeItem("tenantAdmin");
};

// Owners are tenant admins with no BranchId - unrestricted across their own
// tenant's branches. Branch Admins are locked to one branch and cannot
// manage branches, staff, or other tenant-wide settings. Mirrors the
// backend's requireOwner check in middleware/Auth.js.
export const isOwner = (admin) => Boolean(admin && !admin.BranchId);
