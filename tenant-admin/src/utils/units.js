// Mirrors server/src/config/migrations.js's seeded "Units" table exactly -
// this is fixed reference data (never edited through the app), so it's
// hardcoded here rather than fetched from a dedicated endpoint, the same
// way CouponDialog hardcodes "Percentage"/"Flat" instead of fetching them.
export const UNIT_OPTIONS = [
    { code: "g", label: "Gram (g)", type: "Weight", toBaseFactor: 1 },
    { code: "kg", label: "Kilogram (kg)", type: "Weight", toBaseFactor: 1000 },
    { code: "ml", label: "Millilitre (ml)", type: "Volume", toBaseFactor: 1 },
    { code: "l", label: "Litre (l)", type: "Volume", toBaseFactor: 1000 },
    { code: "pc", label: "Piece (pc)", type: "Count", toBaseFactor: 1 }
];

export const unitLabel = (code) => UNIT_OPTIONS.find((unit) => unit.code === code)?.label || code;

// Only units sharing the same UnitType as the ingredient's own BaseUnit can
// legally be entered for it (structurally prevents a kg-to-litre style
// mix-up) - mirrors InventoryService.convertToIngredientBase on the server.
export const compatibleUnits = (baseUnitCode) => {

    const baseType = UNIT_OPTIONS.find((unit) => unit.code === baseUnitCode)?.type;

    return UNIT_OPTIONS.filter((unit) => unit.type === baseType);

};

// Converts a quantity entered in `unitCode` into the ingredient's own base
// unit - both units convert to the same underlying base within their
// UnitType (e.g. kg and g both convert to g), same conversion table the
// server's InventoryService.convertToIngredientBase uses. Needed anywhere
// a client-side preview compares an entered quantity against a balance
// that's always expressed in the ingredient's base unit (e.g. the
// adjustment delta preview) - subtracting the two raw numbers without this
// silently produces a wrong, sign-flippable result whenever the selected
// unit differs from the ingredient's base unit.
export const convertToBase = (unitCode, quantity, baseUnitCode) => {

    const enteredUnit = UNIT_OPTIONS.find((unit) => unit.code === unitCode);
    const baseUnit = UNIT_OPTIONS.find((unit) => unit.code === baseUnitCode);

    if (!enteredUnit || !baseUnit || enteredUnit.type !== baseUnit.type) {
        return null;
    }

    return (Number(quantity) * enteredUnit.toBaseFactor) / baseUnit.toBaseFactor;

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
