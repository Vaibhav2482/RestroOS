import pool from "../config/db.js";

// Public (customer storefront) - scoped by tenant slug since there's no
// admin auth token to derive a tenant from at this call site.
export const getActiveBranchesByTenantSlug = async (tenantSlug) => {

    const result = await pool.query(
        `SELECT B."BranchId", B."BranchName", B."Address", B."City", B."State", B."Pincode", B."Phone",
                B."Latitude", B."Longitude", B."DeliveryRadiusKm"
         FROM "Branches" B
         INNER JOIN "Tenants" T ON B."TenantId" = T."TenantId"
         WHERE T."Slug" = $1 AND T."IsActive" = TRUE AND B."IsActive" = TRUE
         ORDER BY B."BranchName"`,
        [tenantSlug]
    );

    return result.rows;

};

// branchId is optional (NULL = every branch, for a tenant Owner) - a
// Branch Admin's token always supplies their own branchId here
// (branchScope.js's resolveBranchId), so this query itself is what keeps
// them from listing branches other than their own, not just the UI
// choosing not to show a selector for them.
export const getAllBranches = async (tenantId, branchId) => {

    const result = await pool.query(
        `SELECT "BranchId", "BranchName", "Address", "City", "State", "Pincode", "Phone",
                "Latitude", "Longitude", "DeliveryRadiusKm", "DeliveryStaffingMode", "IsActive", "CreatedAt", "UpdatedAt"
         FROM "Branches"
         WHERE "TenantId" = $1 AND ($2::int IS NULL OR "BranchId" = $2)
         ORDER BY "BranchName"`,
        [tenantId, branchId ?? null]
    );

    return result.rows;

};

export const getBranchById = async (branchId) => {

    const result = await pool.query(
        `SELECT "BranchId", "TenantId", "BranchName", "Address", "City", "State", "Pincode", "Phone",
                "Latitude", "Longitude", "DeliveryRadiusKm", "DeliveryStaffingMode", "IsActive", "CreatedAt", "UpdatedAt"
         FROM "Branches"
         WHERE "BranchId" = $1`,
        [branchId]
    );

    return result.rows[0];

};

export const createBranch = async (branch) => {

    const result = await pool.query(
        `INSERT INTO "Branches"
            ("TenantId", "BranchName", "Address", "City", "State", "Pincode", "Phone", "Latitude", "Longitude", "DeliveryRadiusKm", "DeliveryStaffingMode", "IsActive", "CreatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, NOW())
         RETURNING *`,
        [
            branch.tenantId,
            branch.branchName,
            branch.address ?? null,
            branch.city ?? null,
            branch.state ?? null,
            branch.pincode ?? null,
            branch.phone ?? null,
            branch.latitude ?? null,
            branch.longitude ?? null,
            branch.deliveryRadiusKm ?? null,
            branch.deliveryStaffingMode ?? null
        ]
    );

    return result.rows[0];

};

export const updateBranch = async (branch) => {

    const result = await pool.query(
        `UPDATE "Branches"
         SET "BranchName" = $1, "Address" = $2, "City" = $3, "State" = $4, "Pincode" = $5, "Phone" = $6, "IsActive" = $7,
             "Latitude" = $8, "Longitude" = $9, "DeliveryRadiusKm" = $10, "DeliveryStaffingMode" = $11, "UpdatedAt" = NOW()
         WHERE "BranchId" = $12
         RETURNING *`,
        [
            branch.branchName,
            branch.address ?? null,
            branch.city ?? null,
            branch.state ?? null,
            branch.pincode ?? null,
            branch.phone ?? null,
            branch.isActive ?? true,
            branch.latitude ?? null,
            branch.longitude ?? null,
            branch.deliveryRadiusKm ?? null,
            branch.deliveryStaffingMode ?? null,
            branch.branchId
        ]
    );

    return result.rows[0];

};

export const deactivateBranch = async (branchId) => {

    const result = await pool.query(
        `UPDATE "Branches"
         SET "IsActive" = FALSE, "UpdatedAt" = NOW()
         WHERE "BranchId" = $1`,
        [branchId]
    );

    return { RowsAffected: result.rowCount };

};
