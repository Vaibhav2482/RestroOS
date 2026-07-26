-- Fixed reference set, not a general conversion engine - conversion logic
-- only ever operates within one UnitType, so a kg-to-litre conversion is
-- structurally impossible rather than merely discouraged.
CREATE TABLE "Units" (
    "UnitCode" VARCHAR(10) NOT NULL,
    "UnitName" VARCHAR(30) NOT NULL,
    "UnitType" VARCHAR(20) NOT NULL, -- 'Weight' | 'Volume' | 'Count'
    "BaseUnitCode" VARCHAR(10) NOT NULL,
    "ToBaseFactor" NUMERIC(12, 6) NOT NULL,
    PRIMARY KEY ("UnitCode")
);

INSERT INTO "Units" ("UnitCode", "UnitName", "UnitType", "BaseUnitCode", "ToBaseFactor") VALUES
    ('g', 'Gram', 'Weight', 'g', 1),
    ('kg', 'Kilogram', 'Weight', 'g', 1000),
    ('ml', 'Millilitre', 'Volume', 'ml', 1),
    ('l', 'Litre', 'Volume', 'ml', 1000),
    ('pc', 'Piece', 'Count', 'pc', 1);
