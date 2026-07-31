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
        `SELECT "CustomerId", "TenantId", "FullName", "Email", "Phone", "Password", "IsActive",
                "FailedLoginAttempts", "LockedUntil"
         FROM "Customers"
         WHERE "TenantId" = $1 AND "Email" = $2 AND "IsActive" = TRUE`,
        [tenantId, email]
    );

    return result.rows[0];

};

// LockedUntil is only set once FailedLoginAttempts crosses the threshold
// (checked in CustomerAuthService) - below that, this just keeps counting.
export const recordFailedLogin = async (customerId, lockedUntil) => {

    await pool.query(
        `UPDATE "Customers"
         SET "FailedLoginAttempts" = "FailedLoginAttempts" + 1, "LockedUntil" = COALESCE($2, "LockedUntil")
         WHERE "CustomerId" = $1`,
        [customerId, lockedUntil ?? null]
    );

};

export const resetFailedLogins = async (customerId) => {

    await pool.query(
        `UPDATE "Customers" SET "FailedLoginAttempts" = 0, "LockedUntil" = NULL WHERE "CustomerId" = $1`,
        [customerId]
    );

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

export const getAllCustomersByTenant = async (tenantId) => {

    const result = await pool.query(
        `SELECT "CustomerId", "FullName", "Email", "Phone", "CreatedAt", "UpdatedAt"
         FROM "Customers"
         WHERE "TenantId" = $1
         ORDER BY "CustomerId" DESC`,
        [tenantId]
    );

    return result.rows;

};
