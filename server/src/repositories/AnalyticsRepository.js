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

// Unlike SCOPE_CLAUSE, deliberately does NOT exclude cancelled orders -
// this report needs both completed and cancelled counts side by side, so
// filtering cancelled out at the WHERE level would make that impossible.
const SUMMARY_SCOPE_CLAUSE = `B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2) AND O."OrderDate" >= $3 AND O."OrderDate" < $4`;

// The single most standard "day-end" report a POS has - daily order
// volume and completed-vs-cancelled split, distinct from Tax Summary
// (which is about the money collected, not order counts/AOV).
export const getSalesSummary = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT DATE(O."OrderDate") AS "Date",
                COUNT(*) AS "TotalOrders",
                COUNT(*) FILTER (WHERE O."OrderStatus" = 'Cancelled') AS "CancelledOrders",
                COALESCE(SUM(O."TotalAmount") FILTER (WHERE O."OrderStatus" <> 'Cancelled'), 0) AS "GrossSales",
                COALESCE(AVG(O."TotalAmount") FILTER (WHERE O."OrderStatus" <> 'Cancelled'), 0) AS "AvgOrderValue"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${SUMMARY_SCOPE_CLAUSE}
         GROUP BY DATE(O."OrderDate")
         ORDER BY DATE(O."OrderDate")`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows;

};

// Revenue by menu category, not just per-item (getTopItems) - uses each
// item's CURRENT category assignment (OrderItems has no historical
// CategoryId of its own), so an item moved to a different category after
// the order shipped attributes its past sales to its new category. Same
// simplification getMenuItemProfitability already makes for recipes.
export const getCategorySales = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT C."CategoryId", C."CategoryName",
                SUM(OI."Quantity") AS "QuantitySold",
                COALESCE(SUM(OI."TotalPrice"), 0) AS "Revenue"
         FROM "OrderItems" OI
         INNER JOIN "Orders" O ON OI."OrderId" = O."OrderId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         INNER JOIN "MenuItems" MI ON MI."MenuItemId" = OI."MenuItemId"
         INNER JOIN "Categories" C ON C."CategoryId" = MI."CategoryId"
         WHERE ${SCOPE_CLAUSE}
         GROUP BY C."CategoryId", C."CategoryName"
         ORDER BY "Revenue" DESC`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows;

};

// Per-coupon redemption count and discount given, scoped like every other
// revenue report (a cancelled order's coupon "use" isn't a real
// redemption - SCOPE_CLAUSE already excludes it).
export const getCouponUsage = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT CP."CouponId", CP."Code",
                COUNT(O."OrderId") AS "TimesUsed",
                COALESCE(SUM(O."DiscountAmount"), 0) AS "TotalDiscount",
                COALESCE(SUM(O."TotalAmount"), 0) AS "RevenueFromOrders"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         INNER JOIN "Coupons" CP ON CP."CouponId" = O."CouponId"
         WHERE ${SCOPE_CLAUSE}
         GROUP BY CP."CouponId", CP."Code"
         ORDER BY "TotalDiscount" DESC`,
        [tenantId, branchId ?? null, from, to]
    );

    return result.rows;

};

// A void/cancellation report - one row per cancelled order rather than a
// daily rollup, since knowing WHICH orders were cancelled (and their
// value) is the point, the same way PetPooja's void report lists
// individual voided transactions rather than just a daily count.
const CANCELLED_SCOPE_CLAUSE = `B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2) AND O."OrderDate" >= $3 AND O."OrderDate" < $4 AND O."OrderStatus" = 'Cancelled'`;

export const getCancelledOrders = async (tenantId, branchId, from, to) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."OrderDate", O."TotalAmount", O."PaymentMethod", O."DeliveryType"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE ${CANCELLED_SCOPE_CLAUSE}
         ORDER BY O."OrderDate" DESC`,
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
