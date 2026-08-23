// Deliberately excludes staff management - granting it would let a Branch
// Admin promote themselves to Owner, so it stays requireOwner-only with no
// override, on this list or the tenant-feature one below. Branch management
// isn't grantable to staff either, but IS toggleable per-tenant - see
// TENANT_FEATURES.
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
    { key: "manage_delivery", label: "Manage Delivery Settings", group: "Management", core: false },
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

// A tenant-wide kill switch an Owner sets for their own restaurant (e.g. a
// single-location tenant hiding Branches, or one that doesn't track stock
// hiding Inventory) - this blocks EVERYONE in that tenant, Owner included,
// unlike Admins.Permissions which only ever narrows a Branch Admin.
// Reuses every GRANTABLE_PERMISSIONS key (same screens) plus
// manage_branches, which is deliberately absent from the staff-grantable
// list above but still makes sense as a whole-tenant on/off switch.
export const TENANT_FEATURES = [
    ...GRANTABLE_PERMISSIONS,
    { key: "manage_branches", label: "Branches (multi-location)", group: "Management" }
];

const TENANT_FEATURE_KEYS = new Set(TENANT_FEATURES.map((feature) => feature.key));

export const sanitizeDisabledFeatures = (features) => {

    if (!Array.isArray(features)) {
        return [];
    }

    return [...new Set(features.filter((key) => TENANT_FEATURE_KEYS.has(key)))];

};
