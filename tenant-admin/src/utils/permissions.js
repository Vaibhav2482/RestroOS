// Mirrors server/src/config/permissions.js - kept as a small duplicated
// list (same pattern as VALID_UNITS in IngredientDialog.jsx/IngredientService.js)
// rather than fetched from the API, since it changes about as often as the
// rest of the UI's copy does. The backend is the actual enforcement point;
// this only drives what the Owner sees offered in the Staff dialog and
// which nav items/routes a Branch Admin sees.
export const GRANTABLE_PERMISSIONS = [
    { key: "manage_ingredients", label: "Manage Ingredients & Recipes" },
    { key: "manage_coupons", label: "Manage Coupons" },
    { key: "manage_integrations", label: "Manage Integrations" },
    { key: "manage_branding", label: "Manage Branding" },
    { key: "view_activity_log", label: "View Activity Log" }
];
