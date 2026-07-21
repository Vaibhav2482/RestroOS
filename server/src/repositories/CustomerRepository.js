import pool from "../config/db.js";

export const getCustomerByTenantAndEmail = async (tenantId, email) => {

    const result = await pool.query(
        `SELECT * FROM "Customers" WHERE "TenantId" = $1 AND "Email" = $2`,
        [tenantId, email]
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
        `SELECT "CustomerId", "TenantId", "FullName", "Email", "Phone", "IsActive", "CreatedAt", "UpdatedAt"
         FROM "Customers"
         WHERE "CustomerId" = $1 AND "IsActive" = TRUE`,
        [customerId]
    );

    return result.rows[0];

};

export const updateCustomer = async (customer) => {

    await pool.query(
        `UPDATE "Customers"
         SET "FullName" = $1, "Email" = $2, "Phone" = $3, "UpdatedAt" = NOW()
         WHERE "CustomerId" = $4 AND "IsActive" = TRUE`,
        [customer.fullName, customer.email, customer.phone, customer.customerId]
    );

    const result = await pool.query(
        `SELECT "CustomerId", "TenantId", "FullName", "Email", "Phone", "IsActive", "CreatedAt", "UpdatedAt"
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
