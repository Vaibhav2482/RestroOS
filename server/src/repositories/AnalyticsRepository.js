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
