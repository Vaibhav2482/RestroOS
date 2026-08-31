import pool from "../config/db.js";

export const getCustomerByTenantAndEmail = async (tenantId, email) => {

    const result = await pool.query(
        `SELECT * FROM "Customers" WHERE "TenantId" = $1 AND "Email" = $2`,
        [tenantId, email]
    );

    return result.rows[0];

};

export const getCustomerByTenantAndPhone = async (tenantId, phone) => {

    const result = await pool.query(
        `SELECT * FROM "Customers" WHERE "TenantId" = $1 AND "Phone" = $2`,
        [tenantId, phone]
    );

    return result.rows[0];

};

export const createCustomer = async (customer) => {

    const result = await pool.query(
        `INSERT INTO "Customers" ("TenantId", "FullName", "Email", "Phone", "Password", "IsActive", "CreatedAt")
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
         RETURNING *`,
        [customer.tenantId, customer.fullName, customer.email, customer.phone, customer.password]
    );

    return result.rows[0];

};

export const customerLogin = async (tenantId, email) => {

    const result = await pool.query(
        `SELECT "CustomerId", "TenantId", "FullName", "Email", "Phone", "Password", "IsActive"
         FROM "Customers"
         WHERE "TenantId" = $1 AND "Email" = $2 AND "IsActive" = TRUE`,
        [tenantId, email]
    );

    return result.rows[0];

};

export const getCustomerById = async (customerId) => {

    const result = await pool.query(
        `SELECT "CustomerId", "TenantId", "FullName", "Email", "Phone", "AvatarUrl", "IsActive", "CreatedAt", "UpdatedAt"
         FROM "Customers"
         WHERE "CustomerId" = $1 AND "IsActive" = TRUE`,
        [customerId]
    );

    return result.rows[0];

};

// Only ever used internally to verify a password on a self-service change -
// the hash itself must never appear in an API response, which is exactly
// why every other read here (getCustomerById, customerLogin's caller) leaves it out.
export const getPasswordHash = async (customerId) => {

    const result = await pool.query(`SELECT "Password" FROM "Customers" WHERE "CustomerId" = $1`, [customerId]);
    return result.rows[0]?.Password;

};

export const updatePassword = async (customerId, hashedPassword) => {

    await pool.query(
        `UPDATE "Customers" SET "Password" = $1, "UpdatedAt" = NOW() WHERE "CustomerId" = $2`,
        [hashedPassword, customerId]
    );

};

export const updateCustomer = async (customer) => {

    await pool.query(
        `UPDATE "Customers"
         SET "FullName" = $1, "Email" = $2, "Phone" = $3, "AvatarUrl" = $4, "UpdatedAt" = NOW()
         WHERE "CustomerId" = $5 AND "IsActive" = TRUE`,
        [customer.fullName, customer.email, customer.phone, customer.avatarUrl ?? null, customer.customerId]
    );

    const result = await pool.query(
        `SELECT "CustomerId", "TenantId", "FullName", "Email", "Phone", "AvatarUrl", "IsActive", "CreatedAt", "UpdatedAt"
         FROM "Customers"
         WHERE "CustomerId" = $1`,
        [customer.customerId]
    );

    return result.rows[0];

};

// Left-joined (not INNER) so a customer with zero orders still appears,
// with OrderCount/TotalSpent as 0 rather than being dropped entirely.
// Cancelled orders are excluded from BOTH OrderCount and TotalSpent - a
// cancelled order was never actually paid out, so counting it in either
// figure would overstate a customer's real activity/spend. Both use the
// same FILTER for exactly that reason - counting it in OrderCount but not
// TotalSpent used to show a customer as having placed orders while somehow
// spending nothing, which just reads as a broken number, not "they
// cancelled everything."
export const getAllCustomersByTenant = async (tenantId) => {

    const result = await pool.query(
        `SELECT C."CustomerId", C."FullName", C."Email", C."Phone", C."CreatedAt", C."UpdatedAt",
                COUNT(O."OrderId") FILTER (WHERE O."OrderStatus" <> 'Cancelled') AS "OrderCount",
                COALESCE(SUM(O."TotalAmount") FILTER (WHERE O."OrderStatus" <> 'Cancelled'), 0) AS "TotalSpent"
         FROM "Customers" C
         LEFT JOIN "Orders" O ON O."CustomerId" = C."CustomerId"
         WHERE C."TenantId" = $1
         GROUP BY C."CustomerId"
         ORDER BY C."CustomerId" DESC`,
        [tenantId]
    );

    return result.rows;

};
