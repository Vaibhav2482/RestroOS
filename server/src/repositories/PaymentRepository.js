import pool from "../config/db.js";

export const createPayment = async (payment) => {

    const orderCheck = await pool.query(`SELECT 1 FROM "Orders" WHERE "OrderId" = $1`, [payment.orderId]);

    if (orderCheck.rows.length === 0) {
        throw new Error("Order not found.");
    }

    const result = await pool.query(
        `INSERT INTO "Payments" ("OrderId", "PaymentMethod", "Amount", "PaymentStatus", "TransactionId", "RazorpayOrderId", "PaymentDate")
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [
            payment.orderId,
            payment.paymentMethod,
            payment.amount,
            payment.paymentStatus ?? "Pending",
            payment.transactionId ?? null,
            payment.razorpayOrderId ?? null
        ]
    );

    return result.rows[0];

};

// client defaults to the pool but accepts a transactional client - OrderService's
// payment gate needs to read this under the same row lock it uses for the
// status transition/stock consumption it's guarding.
export const getPaymentByOrderId = async (orderId, client = pool) => {

    const result = await client.query(
        `SELECT "PaymentId", "OrderId", "PaymentMethod", "Amount", "PaymentStatus", "TransactionId", "RazorpayOrderId", "PaymentDate"
         FROM "Payments"
         WHERE "OrderId" = $1`,
        [orderId]
    );

    return result.rows;

};

export const getPaymentByRazorpayOrderId = async (razorpayOrderId) => {

    const result = await pool.query(
        `SELECT "PaymentId", "OrderId", "PaymentMethod", "Amount", "PaymentStatus", "TransactionId", "RazorpayOrderId", "PaymentDate"
         FROM "Payments"
         WHERE "RazorpayOrderId" = $1`,
        [razorpayOrderId]
    );

    return result.rows[0];

};

// Unconditional - a real "Paid" always wins, whether it arrives via the
// client-side verify call or the order.paid webhook (both call this; an
// UPDATE is naturally idempotent if both fire for the same payment, unlike
// the old insert-and-catch-unique-violation dance this replaces).
export const updatePaymentByRazorpayOrderId = async (razorpayOrderId, { paymentStatus, transactionId }) => {

    const result = await pool.query(
        `UPDATE "Payments" SET "PaymentStatus" = $1, "TransactionId" = COALESCE($2, "TransactionId")
         WHERE "RazorpayOrderId" = $3
         RETURNING *`,
        [paymentStatus, transactionId ?? null, razorpayOrderId]
    );

    return result.rows[0];

};

// Conditional, unlike the function above - only moves a row OUT of Pending,
// so a payment.failed webhook that arrives late (after a retry already
// succeeded and moved this row to Paid) can never downgrade it. Razorpay
// itself documents payment.failed followed by payment.captured on the same
// transaction as a normal sequence for UPI retries.
export const markPaymentFailedIfPending = async (razorpayOrderId) => {

    const result = await pool.query(
        `UPDATE "Payments" SET "PaymentStatus" = 'Failed'
         WHERE "RazorpayOrderId" = $1 AND "PaymentStatus" = 'Pending'
         RETURNING *`,
        [razorpayOrderId]
    );

    return result.rows[0];

};

export const updatePaymentStatus = async (paymentId, paymentStatus) => {

    const result = await pool.query(
        `UPDATE "Payments" SET "PaymentStatus" = $1 WHERE "PaymentId" = $2 RETURNING *`,
        [paymentStatus, paymentId]
    );

    return result.rows[0];

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
