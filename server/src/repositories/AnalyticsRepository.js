import pool from "../config/db.js";

// Reused across every query here - tenantId is always enforced (an owner
// with no branchId restriction querying "all branches" must still only
// ever see their OWN tenant's data), branchId is optional (NULL = every
// branch), and the date range is always end-exclusive ([from, to)).
const SCOPE_CLAUSE = `B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2) AND O."OrderDate" >= $3 AND O."OrderDate" < $4 AND O."OrderStatus" <> 'Cancelled'`;

export const getSummary = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT COALESCE(SUM(O."TotalAmount"), 0) AS "Revenue",
                COUNT(*) AS "OrderCount",
                COALESCE(AVG(O."TotalAmount"), 0) AS "AvgOrderValue"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${SCOPE_CLAUSE}`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows[0];

};

export const getRevenueTrend = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT DATE(O."OrderDate") AS "Date",
                COALESCE(SUM(O."TotalAmount"), 0) AS "Revenue",
                COUNT(*) AS "OrderCount"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${SCOPE_CLAUSE}
         GROUP BY DATE(O."OrderDate")
         ORDER BY DATE(O."OrderDate")`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows;

};

export const getTopItems = async (tenantId, branchId, from, to, limit) => {

    const result = await pool.query(
        `SELECT OI."ItemName",
                SUM(OI."Quantity") AS "QuantitySold",
                SUM(OI."TotalPrice") AS "Revenue"
         FROM "OrderItems" OI
         INNER JOIN "Orders" O ON OI."OrderId" = O."OrderId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${SCOPE_CLAUSE}
         GROUP BY OI."ItemName"
         ORDER BY "QuantitySold" DESC
         LIMIT $5`,
        [tenantId, branchId ?? null, from, to, limit]
    );

    return result.rows;

};

export const getPeakHours = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT EXTRACT(HOUR FROM O."OrderDate")::int AS "Hour",
                COUNT(*) AS "OrderCount"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${SCOPE_CLAUSE}
         GROUP BY EXTRACT(HOUR FROM O."OrderDate")
         ORDER BY "Hour"`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows;

};

// COGS is derived from the CONSUMPTION ledger (real ingredient usage tied
// to real orders that reached "Preparing"), not a theoretical recipe-cost
// x units-sold calculation - it naturally accounts for items with no
// recipe yet (contributing nothing) and never double counts a reversal.
// Wastage value is the same idea against WASTAGE rows. Deliberately
// scoped to just these two transaction types for a first pass, not
// ADJUSTMENT_IN/OUT (a physical-count correction isn't unambiguously an
// economic gain/loss the way a recorded sale or a thrown-out batch is).
//
// An ingredient with no CostPerBaseUnit set should make the whole
// aggregate NULL rather than silently undercounting as if that ingredient
// were free. SUM() does NOT do this on its own - Postgres aggregates
// (unlike scalar arithmetic) skip NULL inputs instead of propagating them,
// so SUM(qty * cost) quietly treats a NULL-cost row as contributing 0 to
// the total. Confirmed this the hard way: a two-line recipe with one
// costed and one uncosted ingredient reported the costed line's value
// alone as "the" cost, with IngredientsMissingCost correctly flagging a
// problem but CogsValue silently wrong instead of null. The
// BOOL_OR(...)/CASE below forces an explicit null when any contributing
// row lacks a cost, and the outer COALESCE(..., 0) keeps "zero
// transactions in range" reading as a real 0 rather than the same null
// used for "some transactions exist but we can't cost them."
const COGS_SCOPE_CLAUSE = `I."TenantId" = $1 AND ($2::int IS NULL OR T."BranchId" = $2) AND T."CreatedAt" >= $3 AND T."CreatedAt" < $4`;

export const getCogsSummary = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT
            CASE WHEN COALESCE(BOOL_OR(I."CostPerBaseUnit" IS NULL) FILTER (WHERE T."TransactionType" = 'CONSUMPTION'), FALSE)
                 THEN NULL
                 ELSE COALESCE(SUM(ABS(T."QuantityBase") * I."CostPerBaseUnit") FILTER (WHERE T."TransactionType" = 'CONSUMPTION'), 0)
            END AS "CogsValue",
            CASE WHEN COALESCE(BOOL_OR(I."CostPerBaseUnit" IS NULL) FILTER (WHERE T."TransactionType" = 'WASTAGE'), FALSE)
                 THEN NULL
                 ELSE COALESCE(SUM(ABS(T."QuantityBase") * I."CostPerBaseUnit") FILTER (WHERE T."TransactionType" = 'WASTAGE'), 0)
            END AS "WastageValue",
            COUNT(DISTINCT I."IngredientId") FILTER (WHERE T."TransactionType" IN ('CONSUMPTION', 'WASTAGE') AND I."CostPerBaseUnit" IS NULL) AS "IngredientsMissingCost"
         FROM "InventoryTransactions" T
         INNER JOIN "Ingredients" I ON I."IngredientId" = T."IngredientId"
         WHERE ${COGS_SCOPE_CLAUSE} AND T."TransactionType" IN ('CONSUMPTION', 'WASTAGE')`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows[0];

};

// Per-branch (menu items are branch-scoped, so "all branches" would mean
// silently picking one arbitrary price/recipe per item name across
// branches that might genuinely differ - the caller must pick one).
// Only items with at least one recipe line are returned; an item with no
// recipe yet simply doesn't appear rather than showing a misleading ₹0
// cost. The unit conversion (recipe.Unit -> ingredient.BaseUnit) mirrors
// InventoryService.convertToIngredientBase exactly: both sides convert
// through their shared UnitType's base (Units.ToBaseFactor), which is
// safe here because a recipe line's Unit is only ever saved when it's
// already the same UnitType as its ingredient's BaseUnit (enforced in
// MenuItemRecipeService when the recipe is written).
export const getMenuItemProfitability = async (branchId) => {

    // Same fix as getCogsSummary above: SUM() skips NULL rows rather than
    // propagating them, so without the BOOL_OR/CASE guard a recipe with
    // one uncosted ingredient among several would silently report only
    // the costed lines' total as if it were the item's whole cost.
    const result = await pool.query(
        `SELECT MI."MenuItemId", MI."ItemName", MI."Price",
                CASE WHEN BOOL_OR(I."CostPerBaseUnit" IS NULL)
                     THEN NULL
                     ELSE SUM(R."Quantity" * RU."ToBaseFactor" / IU."ToBaseFactor" * I."CostPerBaseUnit")
                END AS "IngredientCost"
         FROM "MenuItems" MI
         INNER JOIN "MenuItemRecipes" R ON R."MenuItemId" = MI."MenuItemId"
         INNER JOIN "Ingredients" I ON I."IngredientId" = R."IngredientId"
         INNER JOIN "Units" RU ON RU."UnitCode" = R."Unit"
         INNER JOIN "Units" IU ON IU."UnitCode" = I."BaseUnit"
         WHERE MI."BranchId" = $1 AND MI."IsActive" = TRUE
         GROUP BY MI."MenuItemId", MI."ItemName", MI."Price"
         ORDER BY MI."ItemName"`,
        [branchId]
    );

    return result.rows;

};

// Day-by-day CGST/SGST collected - the figures a restaurant needs to
// reconcile against its GST returns. Cancelled orders are excluded via
// the shared SCOPE_CLAUSE, same as every other revenue-bearing report
// here (a cancelled order never actually collected tax).
export const getTaxSummary = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT DATE(O."OrderDate") AS "Date",
                COALESCE(SUM(O."SubTotal"), 0) AS "SubTotal",
                COALESCE(SUM(O."DiscountAmount"), 0) AS "DiscountAmount",
                COALESCE(SUM(O."CgstAmount"), 0) AS "CgstAmount",
                COALESCE(SUM(O."SgstAmount"), 0) AS "SgstAmount",
                COALESCE(SUM(O."TotalAmount"), 0) AS "TotalAmount",
                COUNT(*) AS "OrderCount"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${SCOPE_CLAUSE}
         GROUP BY DATE(O."OrderDate")
         ORDER BY DATE(O."OrderDate")`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows;

};

// Daily cash-up reconciliation - "how much of today's revenue came in as
// Cash vs Card vs UPI."
export const getPaymentBreakdown = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT O."PaymentMethod",
                COUNT(*) AS "OrderCount",
                COALESCE(SUM(O."TotalAmount"), 0) AS "Revenue"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${SCOPE_CLAUSE}
         GROUP BY O."PaymentMethod"
         ORDER BY "Revenue" DESC`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows;

};

// Owner-only (cross-branch view) - every one of a tenant's branches is
// listed even with zero orders in range, via the LEFT JOIN, so a new
// branch shows up as a real 0 rather than being silently missing.
export const getBranchComparison = async (tenantId, from, to) => {

    const result = await pool.query(
        `SELECT B."BranchId", B."BranchName",
                COALESCE(SUM(O."TotalAmount"), 0) AS "Revenue",
                COUNT(O."OrderId") AS "OrderCount"
         FROM "Branches" B
         LEFT JOIN "Orders" O
             ON O."BranchId" = B."BranchId"
             AND O."OrderStatus" <> 'Cancelled'
             AND O."OrderDate" >= $2 AND O."OrderDate" < $3
         WHERE B."TenantId" = $1
         GROUP BY B."BranchId", B."BranchName"
         ORDER BY "Revenue" DESC`,
        [tenantId, from, to]
    );

    return result.rows;

};
