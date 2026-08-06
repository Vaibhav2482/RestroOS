// Deliberately excludes staff management (would let a Branch Admin promote
// themselves to Owner) and branch management (structural) - both stay
// requireOwner-only with no override.
//
// "core" marks the day-to-day operational screens a Branch Admin already
// had unconditional access to before this list existed - migration
// 0016_admin_permissions_core_backfill grants these to every already-
// existing Branch Admin so nobody loses access on deploy, and
// AdminDialog.jsx in tenant-admin pre-checks them for a newly created one.
// The non-core ones (the original 5) keep the old default of unchecked -
// an Owner has always had to opt those in explicitly.
export const GRANTABLE_PERMISSIONS = [
    { key: "manage_orders", label: "Orders, Take Order (POS) & Kitchen", group: "Operations", core: true },
    { key: "manage_tables", label: "Manage Tables", group: "Operations", core: true },
    { key: "manage_menu", label: "Manage Menu", group: "Catalog", core: true },
    { key: "manage_categories", label: "Manage Categories", group: "Catalog", core: true },
    { key: "manage_ingredients", label: "Manage Ingredients & Recipes", group: "Catalog", core: false },
    { key: "manage_inventory", label: "Manage Inventory (stock & transactions)", group: "Catalog", core: true },
    { key: "view_customers", label: "View Customers", group: "Customers", core: true },
    { key: "view_analytics", label: "View Analytics", group: "Insights", core: true },
    { key: "view_reports", label: "View Reports", group: "Insights", core: true },
    { key: "manage_coupons", label: "Manage Coupons", group: "Management", core: false },
    { key: "manage_integrations", label: "Manage Integrations", group: "Management", core: false },
    { key: "manage_branding", label: "Manage Branding", group: "Management", core: false },
    { key: "view_activity_log", label: "View Activity Log", group: "Management", core: false }
];

export const CORE_PERMISSION_KEYS = GRANTABLE_PERMISSIONS
    .filter((permission) => permission.core)
    .map((permission) => permission.key);

const GRANTABLE_KEYS = new Set(GRANTABLE_PERMISSIONS.map((permission) => permission.key));

// Drops anything not in GRANTABLE_PERMISSIONS, so a tampered request can't
// smuggle an arbitrary string into the column requirePermission checks.
export const sanitizePermissions = (permissions) => {

    if (!Array.isArray(permissions)) {
        return [];
    }

    return [...new Set(permissions.filter((key) => GRANTABLE_KEYS.has(key)))];

};
