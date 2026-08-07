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

// "What is the ingredient stock on hand currently worth" - an ingredient
// with no CostPerBaseUnit set shows a null StockValue (not 0), and rolls
// up into "IngredientsMissingCost" so the total is honestly reported as
// incomplete rather than understated.
export const getValuation = async (branchId) => {

    const result = await pool.query(
        `SELECT I."IngredientId", I."Name", I."BaseUnit", I."CostPerBaseUnit",
                COALESCE(BI."CurrentQuantityBase", 0) AS "CurrentQuantityBase",
                COALESCE(BI."CurrentQuantityBase", 0) * I."CostPerBaseUnit" AS "StockValue"
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

    const whereClause = conditions.join(" AND ");

    // Counted against the same filtered WHERE clause, before LIMIT/OFFSET
    // are appended to params below - a busy branch writes a CONSUMPTION row
    // on every single order, so a flat LIMIT 200 with no total (the
    // previous shape) silently made any date range wider than "the last
    // few hours" untrustworthy, with nothing telling the caller there was
    // more to see.
    const countResult = await pool.query(
        `SELECT COUNT(*) AS "TotalCount" FROM "InventoryTransactions" T WHERE ${whereClause}`,
        params
    );

    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const page = Math.max(Number(filters.page) || 0, 0);

    params.push(limit, page * limit);

    const result = await pool.query(
        `SELECT T.*, I."Name" AS "IngredientName", I."BaseUnit", A."FullName" AS "ActorName"
         FROM "InventoryTransactions" T
         INNER JOIN "Ingredients" I ON I."IngredientId" = T."IngredientId"
         LEFT JOIN "Admins" A ON A."AdminId" = T."ActorAdminId"
         WHERE ${whereClause}
         ORDER BY T."CreatedAt" DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    return { rows: result.rows, totalCount: Number(countResult.rows[0].TotalCount) };

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

    // "35g of paneer + 500ml of milk" isn't a meaningful sum (mixing weight
    // and volume across different ingredients' base units), so the raw
    // quantity total was never actually useful - what an owner wants from
    // this card is "what did wastage cost us", which needs a join out to
    // each ingredient's CostPerBaseUnit. Same honesty convention as the
    // Valuation report: an ingredient with no cost set is excluded from the
    // total and counted separately, not silently treated as free.
    const wastage = await pool.query(
        `SELECT
            COUNT(*) AS "WastageCount",
            COALESCE(SUM(ABS(T."QuantityBase") * I."CostPerBaseUnit") FILTER (WHERE I."CostPerBaseUnit" IS NOT NULL), 0) AS "TotalWastageValue",
            COUNT(*) FILTER (WHERE I."CostPerBaseUnit" IS NULL) AS "WastageMissingCost"
         FROM "InventoryTransactions" T
         INNER JOIN "Ingredients" I ON I."IngredientId" = T."IngredientId"
         WHERE T."BranchId" = $1 AND T."TransactionType" = 'WASTAGE' AND T."CreatedAt" >= NOW() - INTERVAL '30 days'`,
        [branchId]
    );

    return {
        ...counts.rows[0],
        recentTransactions: recent.rows,
        wastage30Days: wastage.rows[0]
    };

};
