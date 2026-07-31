// Migration SQL lives here as plain JS strings, not as separate .sql files
// read at runtime - a previous version read database/migrations/*.sql via
// fs.readdirSync(), which Vercel's serverless bundler doesn't trace (it
// only bundles files reachable through static imports), so the directory
// never made it into the deployed function and every request 500'd with
// ENOENT. Keeping the SQL as an ordinary imported module sidesteps that
// entirely - it's just code, bundled the same way every other file here is.
export const MIGRATIONS = [
    {
        id: "0001_inventory_units",
        sql: `
            CREATE TABLE "Units" (
                "UnitCode" VARCHAR(10) NOT NULL,
                "UnitName" VARCHAR(30) NOT NULL,
                "UnitType" VARCHAR(20) NOT NULL,
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
        `
    },
    {
        id: "0002_inventory_ingredients",
        sql: `
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
        `
    },
    {
        id: "0003_inventory_ledger",
        sql: `
            CREATE TABLE "BranchInventory" (
                "BranchInventoryId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "BranchId" INT NOT NULL,
                "IngredientId" INT NOT NULL,
                "CurrentQuantityBase" NUMERIC(14, 3) NOT NULL DEFAULT 0,
                "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("BranchInventoryId"),
                CONSTRAINT "UQ_BranchInventory_Branch_Ingredient" UNIQUE ("BranchId", "IngredientId")
            );

            ALTER TABLE "BranchInventory" ADD CONSTRAINT "FK_BranchInventory_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");
            ALTER TABLE "BranchInventory" ADD CONSTRAINT "FK_BranchInventory_Ingredients" FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("IngredientId");

            CREATE TABLE "InventoryTransactions" (
                "TransactionId" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "TenantId" INT NOT NULL,
                "BranchId" INT NOT NULL,
                "IngredientId" INT NOT NULL,
                "TransactionType" VARCHAR(20) NOT NULL,
                "QuantityBase" NUMERIC(14, 3) NOT NULL,
                "EnteredUnit" VARCHAR(10) NOT NULL,
                "EnteredQuantity" NUMERIC(14, 3) NOT NULL,
                "ReferenceType" VARCHAR(30) NULL,
                "ReferenceId" INT NULL,
                "ReversalOfTransactionId" BIGINT NULL,
                "PriorQuantityBase" NUMERIC(14, 3) NULL,
                "PostQuantityBase" NUMERIC(14, 3) NULL,
                "ActorType" VARCHAR(10) NOT NULL,
                "ActorAdminId" INT NULL,
                "Reason" VARCHAR(300) NULL,
                "Notes" VARCHAR(500) NULL,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("TransactionId"),
                CONSTRAINT "CHK_InventoryTransactions_Type" CHECK ("TransactionType" IN (
                    'OPENING_STOCK', 'PURCHASE', 'CONSUMPTION', 'WASTAGE',
                    'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'REVERSAL'
                )),
                CONSTRAINT "CHK_InventoryTransactions_Actor" CHECK ("ActorType" IN ('User', 'System'))
            );

            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Ingredients" FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("IngredientId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Reversal" FOREIGN KEY ("ReversalOfTransactionId") REFERENCES "InventoryTransactions"("TransactionId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Admin" FOREIGN KEY ("ActorAdminId") REFERENCES "Admins"("AdminId");

            CREATE INDEX "IX_InvTxn_Branch_Ingredient_Date" ON "InventoryTransactions" ("BranchId", "IngredientId", "CreatedAt" DESC);
            CREATE INDEX "IX_InvTxn_Reference" ON "InventoryTransactions" ("ReferenceType", "ReferenceId");
        `
    },
    {
        id: "0004_inventory_recipes",
        sql: `
            CREATE TABLE "MenuItemRecipes" (
                "RecipeItemId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "MenuItemId" INT NOT NULL,
                "IngredientId" INT NOT NULL,
                "Quantity" NUMERIC(12, 3) NOT NULL,
                "Unit" VARCHAR(10) NOT NULL,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "UpdatedAt" TIMESTAMP NULL,
                PRIMARY KEY ("RecipeItemId"),
                CONSTRAINT "UQ_Recipe_MenuItem_Ingredient" UNIQUE ("MenuItemId", "IngredientId")
            );

            ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_MenuItems" FOREIGN KEY ("MenuItemId") REFERENCES "MenuItems"("MenuItemId") ON DELETE CASCADE;
            ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_Ingredients" FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("IngredientId");
            ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_Units" FOREIGN KEY ("Unit") REFERENCES "Units"("UnitCode");
        `
    },
    {
        id: "0005_payment_idempotency",
        sql: `
            CREATE UNIQUE INDEX "UQ_Payments_TransactionId" ON "Payments" ("TransactionId") WHERE "TransactionId" IS NOT NULL;
        `
    },
    {
        id: "0006_audit_log",
        sql: `
            CREATE TABLE "AuditLogs" (
                "AuditLogId" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "TenantId" INT NOT NULL,
                "ActorAdminId" INT NULL,
                "ActorType" VARCHAR(10) NOT NULL DEFAULT 'User',
                "Action" VARCHAR(50) NOT NULL,
                "EntityType" VARCHAR(30) NOT NULL,
                "EntityId" INT NULL,
                "Summary" VARCHAR(500) NOT NULL,
                "Metadata" JSONB NULL,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("AuditLogId"),
                CONSTRAINT "CHK_AuditLogs_ActorType" CHECK ("ActorType" IN ('User', 'System'))
            );

            ALTER TABLE "AuditLogs" ADD CONSTRAINT "FK_AuditLogs_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
            ALTER TABLE "AuditLogs" ADD CONSTRAINT "FK_AuditLogs_Admins" FOREIGN KEY ("ActorAdminId") REFERENCES "Admins"("AdminId");

            CREATE INDEX "IX_AuditLogs_Tenant_Date" ON "AuditLogs" ("TenantId", "CreatedAt" DESC);
            CREATE INDEX "IX_AuditLogs_Entity" ON "AuditLogs" ("EntityType", "EntityId");
        `
    }
];
