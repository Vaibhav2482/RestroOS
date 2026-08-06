export const getStoredAuth = () => {

    try {
        return JSON.parse(localStorage.getItem("tenantAdmin"));
    } catch {
        return null;
    }

};

// A same-tab custom event, not just relying on the browser's native
// "storage" event - "storage" only fires in *other* tabs/windows, never the
// one that made the write, so Layout.jsx (which reads auth once at its own
// render time, not from a shared store) had no way to notice a profile save
// from a page it's the parent of.
export const AUTH_CHANGED_EVENT = "tenantAdminAuthChanged";

export const setStoredAuth = (auth) => {
    localStorage.setItem("tenantAdmin", JSON.stringify(auth));
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const clearStoredAuth = () => {
    localStorage.removeItem("tenantAdmin");
};

// Owners are tenant admins with no BranchId - unrestricted across their own
// tenant's branches. Branch Admins are locked to one branch and cannot
// manage branches, staff, or other tenant-wide settings. Mirrors the
// backend's requireOwner check in middleware/Auth.js.
export const isOwner = (admin) => Boolean(admin && !admin.BranchId);

// Mirrors the backend's requirePermission (middleware/Auth.js): an Owner
// always has every permission implicitly; a Branch Admin only has what's
// in their stored Permissions list. This reads from the admin object cached
// in localStorage at login time, so a permission an Owner just granted
// won't show up here until the Branch Admin's next login - the backend
// re-checks fresh on every request regardless, so this only affects what
// the UI offers to click, never what's actually allowed to happen.
export const hasPermission = (admin, key) => isOwner(admin) || Boolean(admin?.Permissions?.includes(key));
