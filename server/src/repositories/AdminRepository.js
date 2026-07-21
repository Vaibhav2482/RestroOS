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

export const getById = async (adminId) => {

    const result = await pool.query(
        `SELECT A."AdminId", A."TenantId", A."FullName", A."Email", A."BranchId", B."BranchName", A."IsActive", A."CreatedAt"
         FROM "Admins" A
         LEFT JOIN "Branches" B ON A."BranchId" = B."BranchId"
         WHERE A."AdminId" = $1`,
        [adminId]
    );

    return result.rows[0];

};

export const update = async (admin) => {

    const result = await pool.query(
        `UPDATE "Admins"
         SET "FullName" = $1, "BranchId" = $2, "IsActive" = $3, "UpdatedAt" = NOW()
         WHERE "AdminId" = $4
         RETURNING "AdminId", "TenantId", "FullName", "Email", "BranchId", "IsActive", "CreatedAt", "UpdatedAt"`,
        [admin.fullName, admin.branchId ?? null, admin.isActive, admin.adminId]
    );

    return result.rows[0];

};

export const deactivate = async (adminId) => {

    await pool.query(`UPDATE "Admins" SET "IsActive" = FALSE, "UpdatedAt" = NOW() WHERE "AdminId" = $1`, [adminId]);

};
