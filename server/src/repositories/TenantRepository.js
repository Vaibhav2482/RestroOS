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

export const getById = async (tenantId) => {

    const result = await pool.query(
        `SELECT * FROM "Tenants" WHERE "TenantId" = $1`,
        [tenantId]
    );

    return result.rows[0];

};

// Creates the Tenant row and its owner Admin account (BranchId NULL = owner,
// unrestricted across all of that tenant's branches, same convention as
// ChaiChakhna's single-tenant Admins table) in one transaction - a tenant
// with no admin able to log into it would be a dead, unreachable account.
export const createWithOwnerAdmin = async (tenant, hashedPassword) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const tenantResult = await client.query(
            `INSERT INTO "Tenants" ("TenantName", "Slug", "OwnerEmail", "OwnerPhone", "PlanType")
             VALUES ($1, $2, $3, $4, $5)
             RETURNING "TenantId", "TenantName", "Slug", "OwnerEmail", "OwnerPhone", "PlanType", "IsActive", "CreatedAt"`,
            [tenant.tenantName, tenant.slug, tenant.ownerEmail, tenant.ownerPhone ?? null, tenant.planType ?? "trial"]
        );

        const createdTenant = tenantResult.rows[0];

        const adminResult = await client.query(
            `INSERT INTO "Admins" ("TenantId", "FullName", "Email", "Password", "BranchId")
             VALUES ($1, $2, $3, $4, NULL)
             RETURNING "AdminId", "FullName", "Email"`,
            [createdTenant.TenantId, tenant.tenantName, tenant.ownerEmail, hashedPassword]
        );

        await client.query("COMMIT");

        return { tenant: createdTenant, admin: adminResult.rows[0] };

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};
