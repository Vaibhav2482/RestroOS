// Mirrors server/src/config/migrations.js's seeded "Units" table exactly -
// this is fixed reference data (never edited through the app), so it's
// hardcoded here rather than fetched from a dedicated endpoint, the same
// way CouponDialog hardcodes "Percentage"/"Flat" instead of fetching them.
export const UNIT_OPTIONS = [
    { code: "g", label: "Gram (g)", type: "Weight" },
    { code: "kg", label: "Kilogram (kg)", type: "Weight" },
    { code: "ml", label: "Millilitre (ml)", type: "Volume" },
    { code: "l", label: "Litre (l)", type: "Volume" },
    { code: "pc", label: "Piece (pc)", type: "Count" }
];

export const unitLabel = (code) => UNIT_OPTIONS.find((unit) => unit.code === code)?.label || code;

// Only units sharing the same UnitType as the ingredient's own BaseUnit can
// legally be entered for it (structurally prevents a kg-to-litre style
// mix-up) - mirrors InventoryService.convertToIngredientBase on the server.
export const compatibleUnits = (baseUnitCode) => {

    const baseType = UNIT_OPTIONS.find((unit) => unit.code === baseUnitCode)?.type;

    return UNIT_OPTIONS.filter((unit) => unit.type === baseType);

};

export const TRANSACTION_TYPE_LABELS = {
    OPENING_STOCK: "Opening Stock",
    PURCHASE: "Purchase",
    CONSUMPTION: "Consumption",
    WASTAGE: "Wastage",
    ADJUSTMENT_IN: "Adjustment (In)",
    ADJUSTMENT_OUT: "Adjustment (Out)",
    TRANSFER_IN: "Transfer In",
    TRANSFER_OUT: "Transfer Out",
    REVERSAL: "Reversal"
};

export const TRANSACTION_TYPE_COLORS = {
    OPENING_STOCK: "info",
    PURCHASE: "info",
    CONSUMPTION: "default",
    WASTAGE: "error",
    ADJUSTMENT_IN: "success",
    ADJUSTMENT_OUT: "warning",
    TRANSFER_IN: "success",
    TRANSFER_OUT: "warning",
    REVERSAL: "secondary"
};
