import pool from "../config/db.js";

export const getByTenantAndEmail = async (tenantId, email) => {

    const result = await pool.query(
        `SELECT * FROM "Admins" WHERE "TenantId" = $1 AND "Email" = $2 AND "IsActive" = TRUE`,
        [tenantId, email]
    );

    return result.rows[0];

};

export const create = async (admin) => {

    const result = await pool.query(
        `INSERT INTO "Admins" ("TenantId", "FullName", "Email", "Password", "BranchId")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING "AdminId", "TenantId", "FullName", "Email", "BranchId", "IsActive", "CreatedAt"`,
        [admin.tenantId, admin.fullName, admin.email, admin.password, admin.branchId ?? null]
    );

    return result.rows[0];

};

export const getAllByTenant = async (tenantId) => {

    const result = await pool.query(
        `SELECT A."AdminId", A."FullName", A."Email", A."BranchId", B."BranchName", A."IsActive", A."CreatedAt"
         FROM "Admins" A
         LEFT JOIN "Branches" B ON A."BranchId" = B."BranchId"
         WHERE A."TenantId" = $1
         ORDER BY A."CreatedAt" DESC`,
        [tenantId]
    );

    return result.rows;

};
