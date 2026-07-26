-- Tenant-level, per FRS B1 - shared across a tenant's branches, same
-- convention as Categories (branch-level stock lives in BranchInventory).
CREATE TABLE "Ingredients" (
    "IngredientId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "TenantId" INT NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "SKU" VARCHAR(50) NULL,
    "Category" VARCHAR(100) NULL,
    "BaseUnit" VARCHAR(10) NOT NULL,
    "LowStockThreshold" NUMERIC(14, 3) NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("IngredientId"),
    CONSTRAINT "UQ_Ingredients_Tenant_Name" UNIQUE ("TenantId", "Name")
);

ALTER TABLE "Ingredients" ADD CONSTRAINT "FK_Ingredients_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
ALTER TABLE "Ingredients" ADD CONSTRAINT "FK_Ingredients_Units" FOREIGN KEY ("BaseUnit") REFERENCES "Units"("UnitCode");
