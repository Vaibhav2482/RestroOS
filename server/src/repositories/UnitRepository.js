import pool from "../config/db.js";

let cache = null;

// The Units table is fixed reference data (seeded once by the migration,
// never edited through the app) - caching it for the life of a warm
// instance avoids a round trip on every single quantity conversion.
export const getAllUnits = async () => {

    if (cache) {
        return cache;
    }

    const result = await pool.query(`SELECT "UnitCode", "UnitName", "UnitType", "BaseUnitCode", "ToBaseFactor" FROM "Units"`);

    cache = result.rows;

    return cache;

};

export const getUnit = async (unitCode) => {

    const units = await getAllUnits();

    return units.find((unit) => unit.UnitCode === unitCode);

};
