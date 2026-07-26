-- The ledger (InventoryTransactions) is the source of truth per FRS B4 -
-- application code only ever INSERTs into it, never UPDATEs or DELETEs a
-- row. BranchInventory is a derived cache of the current balance, always
-- written in the same transaction as the ledger row that changed it.
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

-- History/filter queries (B15) go by branch+ingredient+time or by reference
-- (idempotency/reversal lookups go by ReferenceType+ReferenceId).
CREATE INDEX "IX_InvTxn_Branch_Ingredient_Date" ON "InventoryTransactions" ("BranchId", "IngredientId", "CreatedAt" DESC);
CREATE INDEX "IX_InvTxn_Reference" ON "InventoryTransactions" ("ReferenceType", "ReferenceId");
