import pool from "../config/db.js";

// Append-only - there is no update/delete here by design (see
// 0021_order_adjustments). A correction to a void/refund is a new row, not
// an edit of the old one.
export const recordAdjustment = async ({ tenantId, orderId, adjustmentType, amount, reason, actorAdminId }) => {

    const result = await pool.query(
        `INSERT INTO "OrderAdjustments" ("TenantId", "OrderId", "AdjustmentType", "Amount", "Reason", "ActorAdminId")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tenantId, orderId, adjustmentType, amount ?? null, reason, actorAdminId]
    );

    return result.rows[0];

};

export const getAdjustmentsForOrder = async (orderId) => {

    const result = await pool.query(
        `SELECT OA."AdjustmentId", OA."AdjustmentType", OA."Amount", OA."Reason", OA."CreatedAt",
                OA."ActorAdminId", A."FullName" AS "ActorAdminName"
         FROM "OrderAdjustments" OA
         INNER JOIN "Admins" A ON OA."ActorAdminId" = A."AdminId"
         WHERE OA."OrderId" = $1
         ORDER BY OA."CreatedAt" DESC`,
        [orderId]
    );

    return result.rows;

};

// The running total already refunded on this order - what a new refund
// request has to be checked against so it can't push the total past what
// was actually paid.
export const getTotalRefundedForOrder = async (orderId) => {

    const result = await pool.query(
        `SELECT COALESCE(SUM("Amount"), 0) AS "TotalRefunded"
         FROM "OrderAdjustments"
         WHERE "OrderId" = $1 AND "AdjustmentType" = 'REFUND'`,
        [orderId]
    );

    return Number(result.rows[0].TotalRefunded);

};
