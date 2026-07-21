import pool from "../config/db.js";

export const getAll = async () => {

    const result = await pool.query(
        `SELECT "TenantId", "TenantName", "Slug", "OwnerEmail", "OwnerPhone", "PlanType", "IsActive", "CreatedAt"
         FROM "Tenants"
         ORDER BY "CreatedAt" DESC`
    );

    return result.rows;

};

export const getBySlug = async (slug) => {

    const result = await pool.query(
        `SELECT * FROM "Tenants" WHERE "Slug" = $1`,
        [slug]
    );

    return result.rows[0];

};

export const create = async (tenant) => {

    const result = await pool.query(
        `INSERT INTO "Tenants" ("TenantName", "Slug", "OwnerEmail", "OwnerPhone", "PlanType")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING "TenantId", "TenantName", "Slug", "OwnerEmail", "OwnerPhone", "PlanType", "IsActive", "CreatedAt"`,
        [tenant.tenantName, tenant.slug, tenant.ownerEmail, tenant.ownerPhone ?? null, tenant.planType ?? "trial"]
    );

    return result.rows[0];

};
