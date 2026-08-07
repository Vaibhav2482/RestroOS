// Mirrors server/src/config/permissions.js TENANT_FEATURES (same
// duplication pattern the tenant-admin app already uses for this list) -
// the backend is the real enforcement point, this only drives what the
// "Manage Features" dialog offers to click.
export const TENANT_FEATURES = [
    { key: "manage_orders", label: "Orders, Take Order (POS) & Kitchen", group: "Operations" },
    { key: "manage_tables", label: "Manage Tables", group: "Operations" },
    { key: "manage_menu", label: "Manage Menu", group: "Catalog" },
    { key: "manage_categories", label: "Manage Categories", group: "Catalog" },
    { key: "manage_ingredients", label: "Manage Ingredients & Recipes", group: "Catalog" },
    { key: "manage_inventory", label: "Manage Inventory (stock & transactions)", group: "Catalog" },
    { key: "view_customers", label: "View Customers", group: "Customers" },
    { key: "view_analytics", label: "View Analytics", group: "Insights" },
    { key: "view_reports", label: "View Reports", group: "Insights" },
    { key: "manage_coupons", label: "Manage Coupons", group: "Management" },
    { key: "manage_integrations", label: "Manage Integrations", group: "Management" },
    { key: "manage_branding", label: "Manage Branding", group: "Management" },
    { key: "view_activity_log", label: "View Activity Log", group: "Management" },
    { key: "manage_branches", label: "Branches (multi-location)", group: "Management" }
];

export const TENANT_FEATURE_GROUPS = [...new Set(TENANT_FEATURES.map((feature) => feature.group))];
