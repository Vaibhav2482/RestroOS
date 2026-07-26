import pool from "../config/db.js";

// This codebase has no migration runner (database/*.sql are the schema of
// record, applied by hand) - rather than requiring a manual ALTER TABLE
// against production before this code can go live, the columns add
// themselves the first time they're needed. IF NOT EXISTS makes repeat
// calls (every cold start, potentially) harmless no-ops; the module-level
// flag just avoids re-running the statement on every request within the
// same warm instance.
let brandingColumnsEnsured = false;

const ensureBrandingColumns = async () => {

    if (brandingColumnsEnsured) {
        return;
    }

    await pool.query(`
        ALTER TABLE "Tenants"
        ADD COLUMN IF NOT EXISTS "LogoUrl" VARCHAR(500),
        ADD COLUMN IF NOT EXISTS "PrimaryColor" VARCHAR(7) DEFAULT '#4F46E5'
    `);

    brandingColumnsEnsured = true;

};

export const getAll = async () => {

    const result = await pool.query(
        `SELECT "TenantId", "TenantName", "Slug", "OwnerEmail", "OwnerPhone", "PlanType", "IsActive", "CreatedAt"
         FROM "Tenants"
         ORDER BY "CreatedAt" DESC`
    );

    return result.rows;

};

// Public storefront lookup - only ever expose these columns here.
// OwnerEmail/OwnerPhone/PlanType are internal and must never reach an
// unauthenticated caller.
export const getPublicBySlug = async (slug) => {

    await ensureBrandingColumns();

    const result = await pool.query(
        `SELECT "TenantId", "TenantName", "Slug", "LogoUrl", "PrimaryColor"
         FROM "Tenants" WHERE "Slug" = $1 AND "IsActive" = TRUE`,
        [slug]
    );

    return result.rows[0];

};

export const updateBranding = async (tenantId, { logoUrl, primaryColor }) => {

    await ensureBrandingColumns();

    const result = await pool.query(
        `UPDATE "Tenants"
         SET "LogoUrl" = $1, "PrimaryColor" = $2, "UpdatedAt" = NOW()
         WHERE "TenantId" = $3
         RETURNING "TenantId", "TenantName", "Slug", "LogoUrl", "PrimaryColor"`,
        [logoUrl || null, primaryColor || null, tenantId]
    );

    return result.rows[0];

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
