import pool from "../config/db.js";

export const createPayment = async (payment) => {

    const orderCheck = await pool.query(`SELECT 1 FROM "Orders" WHERE "OrderId" = $1`, [payment.orderId]);

    if (orderCheck.rows.length === 0) {
        throw new Error("Order not found.");
    }

    const result = await pool.query(
        `INSERT INTO "Payments" ("OrderId", "PaymentMethod", "Amount", "PaymentStatus", "TransactionId", "PaymentDate")
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [
            payment.orderId,
            payment.paymentMethod,
            payment.amount,
            payment.paymentStatus ?? "Pending",
            payment.transactionId ?? null
        ]
    );

    return result.rows[0];

};

export const getPaymentByOrderId = async (orderId) => {

    const result = await pool.query(
        `SELECT "PaymentId", "OrderId", "PaymentMethod", "Amount", "PaymentStatus", "TransactionId", "PaymentDate"
         FROM "Payments"
         WHERE "OrderId" = $1`,
        [orderId]
    );

    return result.rows;

};

export const getPaymentsByCustomer = async (customerId) => {

    const result = await pool.query(
        `SELECT P."PaymentId", P."OrderId", P."PaymentMethod", P."Amount", P."PaymentStatus",
                P."TransactionId", P."PaymentDate", B."BranchName"
         FROM "Payments" P
         INNER JOIN "Orders" O ON P."OrderId" = O."OrderId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE O."CustomerId" = $1
         ORDER BY P."PaymentDate" DESC`,
        [customerId]
    );

    return result.rows;

};
