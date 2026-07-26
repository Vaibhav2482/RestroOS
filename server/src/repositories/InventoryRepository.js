import pool from "../config/db.js";

export const getBranchInventory = async (branchId) => {

    const result = await pool.query(
        `SELECT I."IngredientId", I."Name", I."SKU", I."Category", I."BaseUnit", I."LowStockThreshold",
                COALESCE(BI."CurrentQuantityBase", 0) AS "CurrentQuantityBase",
                BI."UpdatedAt"
         FROM "Ingredients" I
         LEFT JOIN "BranchInventory" BI ON BI."IngredientId" = I."IngredientId" AND BI."BranchId" = $1
         WHERE I."TenantId" = (SELECT "TenantId" FROM "Branches" WHERE "BranchId" = $1) AND I."IsActive" = TRUE
         ORDER BY I."Name"`,
        [branchId]
    );

    return result.rows;

};

export const getIngredientBalance = async (client, branchId, ingredientId) => {

    const result = await client.query(
        `SELECT "CurrentQuantityBase" FROM "BranchInventory" WHERE "BranchId" = $1 AND "IngredientId" = $2`,
        [branchId, ingredientId]
    );

    return result.rows[0] ? Number(result.rows[0].CurrentQuantityBase) : 0;

};

// The one write path onto the ledger - every wastage, adjustment, opening
// balance, consumption, and reversal in the system goes through this
// function, always given an already-open transaction client so the ledger
// INSERT and the BranchInventory balance UPDATE either both land or
// neither does (FRS B4 - "stock updates and ledger creation must occur
// atomically"). Never called with the shared pool directly.
export const recordTransaction = async (client, transaction) => {

    const insertResult = await client.query(
        `INSERT INTO "InventoryTransactions"
            ("TenantId", "BranchId", "IngredientId", "TransactionType", "QuantityBase", "EnteredUnit", "EnteredQuantity",
             "ReferenceType", "ReferenceId", "ReversalOfTransactionId", "PriorQuantityBase", "PostQuantityBase",
             "ActorType", "ActorAdminId", "Reason", "Notes")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
            transaction.tenantId,
            transaction.branchId,
            transaction.ingredientId,
            transaction.transactionType,
            transaction.quantityBase,
            transaction.enteredUnit,
            transaction.enteredQuantity,
            transaction.referenceType ?? null,
            transaction.referenceId ?? null,
            transaction.reversalOfTransactionId ?? null,
            transaction.priorQuantityBase ?? null,
            transaction.postQuantityBase ?? null,
            transaction.actorType,
            transaction.actorAdminId ?? null,
            transaction.reason ?? null,
            transaction.notes ?? null
        ]
    );

    await client.query(
        `INSERT INTO "BranchInventory" ("BranchId", "IngredientId", "CurrentQuantityBase", "UpdatedAt")
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT ("BranchId", "IngredientId")
         DO UPDATE SET "CurrentQuantityBase" = "BranchInventory"."CurrentQuantityBase" + $3, "UpdatedAt" = NOW()`,
        [transaction.branchId, transaction.ingredientId, transaction.quantityBase]
    );

    return insertResult.rows[0];

};

// Idempotency guard (FRS B7/A5) - checked inside the same transaction as
// the write it's guarding, using a row lock so two concurrent callers for
// the same reference can't both pass the check before either commits.
export const hasTransactionForReference = async (client, referenceType, referenceId, transactionType) => {

    const result = await client.query(
        `SELECT "TransactionId" FROM "InventoryTransactions"
         WHERE "ReferenceType" = $1 AND "ReferenceId" = $2 AND "TransactionType" = $3
         FOR UPDATE`,
        [referenceType, referenceId, transactionType]
    );

    return result.rows;

};

export const getTransactions = async (branchId, filters = {}) => {

    // Every column here is qualified with T. - Admins also has a BranchId
    // column and Ingredients also has an IngredientId column, so left
    // unqualified these are ambiguous once both are joined in below.
    const conditions = [`T."BranchId" = $1`];
    const params = [branchId];

    if (filters.ingredientId) {
        params.push(filters.ingredientId);
        conditions.push(`T."IngredientId" = $${params.length}`);
    }

    if (filters.transactionType) {
        params.push(filters.transactionType);
        conditions.push(`T."TransactionType" = $${params.length}`);
    }

    if (filters.from) {
        params.push(filters.from);
        conditions.push(`T."CreatedAt" >= $${params.length}`);
    }

    if (filters.to) {
        params.push(filters.to);
        conditions.push(`T."CreatedAt" < $${params.length}`);
    }

    const result = await pool.query(
        `SELECT T.*, I."Name" AS "IngredientName", I."BaseUnit", A."FullName" AS "ActorName"
         FROM "InventoryTransactions" T
         INNER JOIN "Ingredients" I ON I."IngredientId" = T."IngredientId"
         LEFT JOIN "Admins" A ON A."AdminId" = T."ActorAdminId"
         WHERE ${conditions.join(" AND ")}
         ORDER BY T."CreatedAt" DESC
         LIMIT 200`,
        params
    );

    return result.rows;

};

export const getDashboardSummary = async (branchId) => {

    const counts = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE I."IsActive" = TRUE) AS "ActiveIngredients",
            COUNT(*) FILTER (WHERE I."IsActive" = TRUE AND COALESCE(BI."CurrentQuantityBase", 0) <= 0) AS "OutOfStock",
            COUNT(*) FILTER (WHERE I."IsActive" = TRUE AND I."LowStockThreshold" IS NOT NULL AND COALESCE(BI."CurrentQuantityBase", 0) > 0 AND COALESCE(BI."CurrentQuantityBase", 0) <= I."LowStockThreshold") AS "LowStock"
         FROM "Ingredients" I
         LEFT JOIN "BranchInventory" BI ON BI."IngredientId" = I."IngredientId" AND BI."BranchId" = $1
         WHERE I."TenantId" = (SELECT "TenantId" FROM "Branches" WHERE "BranchId" = $1)`,
        [branchId]
    );

    const recent = await pool.query(
        `SELECT T.*, I."Name" AS "IngredientName", I."BaseUnit"
         FROM "InventoryTransactions" T
         INNER JOIN "Ingredients" I ON I."IngredientId" = T."IngredientId"
         WHERE T."BranchId" = $1
         ORDER BY T."CreatedAt" DESC
         LIMIT 10`,
        [branchId]
    );

    const wastage = await pool.query(
        `SELECT COALESCE(SUM(ABS("QuantityBase")), 0) AS "TotalWastageBase", COUNT(*) AS "WastageCount"
         FROM "InventoryTransactions"
         WHERE "BranchId" = $1 AND "TransactionType" = 'WASTAGE' AND "CreatedAt" >= NOW() - INTERVAL '30 days'`,
        [branchId]
    );

    return {
        ...counts.rows[0],
        recentTransactions: recent.rows,
        wastage30Days: wastage.rows[0]
    };

};
