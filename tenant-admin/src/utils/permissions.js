// Mirrors server/src/config/permissions.js (same duplication pattern as
// VALID_UNITS in IngredientDialog.jsx). The backend is the real enforcement
// point - this only drives what the Staff dialog and nav offer to click.
export const GRANTABLE_PERMISSIONS = [
    { key: "manage_ingredients", label: "Manage Ingredients & Recipes" },
    { key: "manage_coupons", label: "Manage Coupons" },
    { key: "manage_integrations", label: "Manage Integrations" },
    { key: "manage_branding", label: "Manage Branding" },
    { key: "view_activity_log", label: "View Activity Log" }
];
