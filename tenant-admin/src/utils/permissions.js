// Mirrors server/src/config/permissions.js (same duplication pattern as
// VALID_UNITS in IngredientDialog.jsx). The backend is the real enforcement
// point - this only drives what the Staff dialog and nav offer to click.
//
// "core" = a day-to-day operational screen a Branch Admin already has
// unconditional access to today; AdminDialog.jsx pre-checks these for a
// newly created Branch Admin so nobody's created locked out of Orders/
// Menu/etc by default. The non-core ones keep the old default of unchecked.
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

// A tenant-wide on/off switch, distinct from staff Permissions above - this
// blocks EVERYONE in the tenant, Owner included. Reuses every
// GRANTABLE_PERMISSIONS key plus manage_branches, which is deliberately not
// staff-grantable but still makes sense as a whole-tenant toggle (e.g. a
// single-location restaurant hiding the Branches page for good).
export const TENANT_FEATURES = [
    ...GRANTABLE_PERMISSIONS,
    { key: "manage_branches", label: "Branches (multi-location)", group: "Management" }
];
