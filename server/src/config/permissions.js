// Grantable Branch Admin permissions. An Owner always has every one of
// these implicitly (see requirePermission in middleware/Auth.js) - this
// list only matters for deciding what a Branch Admin can be granted.
//
// Deliberately NOT on this list: staff management (creating/editing other
// Admins - granting that would let a Branch Admin promote themselves or
// anyone else to Owner) and branch management (structural/financial,
// left owner-only). Both stay behind requireOwner with no override.
export const GRANTABLE_PERMISSIONS = [
    { key: "manage_ingredients", label: "Manage Ingredients & Recipes" },
    { key: "manage_coupons", label: "Manage Coupons" },
    { key: "manage_integrations", label: "Manage Integrations" },
    { key: "manage_branding", label: "Manage Branding" },
    { key: "view_activity_log", label: "View Activity Log" }
];

const GRANTABLE_KEYS = new Set(GRANTABLE_PERMISSIONS.map((permission) => permission.key));

// Filters out anything a client sends that isn't a real, grantable key -
// so a malformed or tampered request can't smuggle an arbitrary string
// into the column that requirePermission checks against.
export const sanitizePermissions = (permissions) => {

    if (!Array.isArray(permissions)) {
        return [];
    }

    return [...new Set(permissions.filter((key) => GRANTABLE_KEYS.has(key)))];

};
