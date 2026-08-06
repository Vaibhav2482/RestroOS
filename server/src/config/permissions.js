// Deliberately excludes staff management (would let a Branch Admin promote
// themselves to Owner) and branch management (structural) - both stay
// requireOwner-only with no override.
export const GRANTABLE_PERMISSIONS = [
    { key: "manage_ingredients", label: "Manage Ingredients & Recipes" },
    { key: "manage_coupons", label: "Manage Coupons" },
    { key: "manage_integrations", label: "Manage Integrations" },
    { key: "manage_branding", label: "Manage Branding" },
    { key: "view_activity_log", label: "View Activity Log" }
];

const GRANTABLE_KEYS = new Set(GRANTABLE_PERMISSIONS.map((permission) => permission.key));

// Drops anything not in GRANTABLE_PERMISSIONS, so a tampered request can't
// smuggle an arbitrary string into the column requirePermission checks.
export const sanitizePermissions = (permissions) => {

    if (!Array.isArray(permissions)) {
        return [];
    }

    return [...new Set(permissions.filter((key) => GRANTABLE_KEYS.has(key)))];

};
