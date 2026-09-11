import pool from "../config/db.js";

// Customers."LoyaltyPoints" is always a derived running total - every
// change goes through addPoints below, which writes the ledger row and
// updates the balance in the same statement/transaction, so the two can
// never drift apart the way a "just increment a column" approach could
// under a lost update.

// FOR UPDATE so two concurrent redemptions (or an award landing at the
// exact same moment) serialize on this customer's balance instead of both
// reading it stale.
export const getBalanceForUpdate = async (client, customerId) => {

    const result = await client.query(
        `SELECT "LoyaltyPoints" FROM "Customers" WHERE "CustomerId" = $1 FOR UPDATE`,
        [customerId]
    );

    return result.rows[0]?.LoyaltyPoints ?? null;

};

export const getBalance = async (customerId) => {

    const result = await pool.query(
        `SELECT "LoyaltyPoints" FROM "Customers" WHERE "CustomerId" = $1`,
        [customerId]
    );

    return result.rows[0]?.LoyaltyPoints ?? null;

};

// points is signed - positive for an Earned award, negative for a
// Redeemed spend - so the balance update is always just "add points,"
// never a type-dependent branch here. Runs on whatever client/pool the
// caller passes, since this is always called from inside a larger
// transaction (order creation for a redemption, the status-update
// transaction for an award).
export const addPoints = async (queryable, customerId, points, orderId, type) => {

    await queryable.query(
        `INSERT INTO "LoyaltyTransactions" ("CustomerId", "OrderId", "Points", "Type") VALUES ($1, $2, $3, $4)`,
        [customerId, orderId ?? null, points, type]
    );

    await queryable.query(
        `UPDATE "Customers" SET "LoyaltyPoints" = "LoyaltyPoints" + $2 WHERE "CustomerId" = $1`,
        [customerId, points]
    );

};

export const getTransactions = async (customerId) => {

    const result = await pool.query(
        `SELECT "LoyaltyTransactionId", "OrderId", "Points", "Type", "CreatedAt"
         FROM "LoyaltyTransactions"
         WHERE "CustomerId" = $1
         ORDER BY "CreatedAt" DESC`,
        [customerId]
    );

    return result.rows;

};

// Idempotency guard for awardPointsForOrder - an order can only ever reach
// one terminal status once (OrderRepository.updateOrderStatus's own
// forward-only guard prevents re-triggering the same transition), but this
// is cheap insurance against ever double-crediting the same order.
export const hasEarnedTransactionForOrder = async (client, orderId) => {

    const result = await client.query(
        `SELECT 1 FROM "LoyaltyTransactions" WHERE "OrderId" = $1 AND "Type" = 'Earned'`,
        [orderId]
    );

    return result.rows.length > 0;

};
