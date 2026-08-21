import pool from "../config/db.js";

export const getByTenantAndEmail = async (tenantId, email) => {

    const result = await pool.query(
        `SELECT * FROM "Admins" WHERE "TenantId" = $1 AND "Email" = $2 AND "IsActive" = TRUE`,
        [tenantId, email]
    );

    return result.rows[0];

};

// LockedUntil is only set once FailedLoginAttempts crosses the threshold
// (checked in AdminAuthService) - below that, this just keeps counting.
export const recordFailedLogin = async (adminId, lockedUntil) => {

    await pool.query(
        `UPDATE "Admins"
         SET "FailedLoginAttempts" = "FailedLoginAttempts" + 1, "LockedUntil" = COALESCE($2, "LockedUntil")
         WHERE "AdminId" = $1`,
        [adminId, lockedUntil ?? null]
    );

};

export const resetFailedLogins = async (adminId) => {

    await pool.query(
        `UPDATE "Admins" SET "FailedLoginAttempts" = 0, "LockedUntil" = NULL WHERE "AdminId" = $1`,
        [adminId]
    );

};

export const create = async (admin) => {

    const result = await pool.query(
        `INSERT INTO "Admins" ("TenantId", "FullName", "Email", "Password", "BranchId", "Permissions")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING "AdminId", "TenantId", "FullName", "Email", "BranchId", "Permissions", "IsActive", "CreatedAt"`,
        [admin.tenantId, admin.fullName, admin.email, admin.password, admin.branchId ?? null, admin.permissions ?? []]
    );

    return result.rows[0];

};

// branchId is only ever passed for a Branch Admin request (see resolveBranchId) -
// a Tenant Owner's requests leave it undefined and see every admin tenant-wide,
// matching how every other branch-scoped list endpoint in this codebase behaves.
export const getAllByTenant = async (tenantId, branchId) => {

    const result = await pool.query(
        `SELECT A."AdminId", A."FullName", A."Email", A."BranchId", B."BranchName", A."Permissions", A."IsActive", A."CreatedAt"
         FROM "Admins" A
         LEFT JOIN "Branches" B ON A."BranchId" = B."BranchId"
         WHERE A."TenantId" = $1 AND ($2::int IS NULL OR A."BranchId" = $2)
         ORDER BY A."CreatedAt" DESC`,
        [tenantId, branchId ?? null]
    );

    return result.rows;

};

export const getById = async (adminId) => {

    const result = await pool.query(
        `SELECT A."AdminId", A."TenantId", A."FullName", A."Email", A."BranchId", B."BranchName", A."Permissions", A."AvatarUrl", A."IsActive", A."CreatedAt"
         FROM "Admins" A
         LEFT JOIN "Branches" B ON A."BranchId" = B."BranchId"
         WHERE A."AdminId" = $1`,
        [adminId]
    );

    return result.rows[0];

};

// Only ever used internally to verify a password on a self-service change -
// the hash itself must never appear in an API response, which is exactly
// why every other read here (getById, getAllByTenant) leaves it out.
export const getPasswordHash = async (adminId) => {

    const result = await pool.query(`SELECT "Password" FROM "Admins" WHERE "AdminId" = $1`, [adminId]);

    return result.rows[0]?.Password;

};

// tenantId redundant with the controller-level check that already ran -
// defense-in-depth so a repository write fails closed on its own WHERE
// clause rather than relying solely on every call site checking first.
export const update = async (admin, tenantId) => {

    const result = await pool.query(
        `UPDATE "Admins"
         SET "FullName" = $1, "BranchId" = $2, "IsActive" = $3, "Permissions" = $4, "UpdatedAt" = NOW()
         WHERE "AdminId" = $5 AND "TenantId" = $6
         RETURNING "AdminId", "TenantId", "FullName", "Email", "BranchId", "Permissions", "IsActive", "CreatedAt", "UpdatedAt"`,
        [admin.fullName, admin.branchId ?? null, admin.isActive, admin.permissions ?? [], admin.adminId, tenantId]
    );

    return result.rows[0];

};

// Self-service - deliberately only FullName/AvatarUrl, none of the fields
// `update` above touches (BranchId, IsActive), which stay owner-controlled
// via the existing staff-management flow. An admin editing their own
// profile can't grant themselves a different branch or reactivate
// themselves this way.
export const updateOwnProfile = async (adminId, profile) => {

    const result = await pool.query(
        `UPDATE "Admins"
         SET "FullName" = $1, "AvatarUrl" = $2, "UpdatedAt" = NOW()
         WHERE "AdminId" = $3
         RETURNING "AdminId", "TenantId", "FullName", "Email", "BranchId", "AvatarUrl", "IsActive", "CreatedAt"`,
        [profile.fullName, profile.avatarUrl ?? null, adminId]
    );

    return result.rows[0];

};

// Distinct from resetPassword (used by a platform admin resetting a locked
// -out owner) - that one also reactivates the account as a side effect,
// which has no place in a self-service change made by an already-active,
// already-logged-in admin.
export const updatePassword = async (adminId, hashedPassword) => {

    await pool.query(
        `UPDATE "Admins" SET "Password" = $1, "UpdatedAt" = NOW() WHERE "AdminId" = $2`,
        [hashedPassword, adminId]
    );

};

// Invalidates every token already issued for this admin - see
// 0018_admin_token_version and middleware/Auth.js.
export const bumpTokenVersion = async (adminId) => {

    await pool.query(
        `UPDATE "Admins" SET "TokenVersion" = "TokenVersion" + 1 WHERE "AdminId" = $1`,
        [adminId]
    );

};

export const deactivate = async (adminId, tenantId) => {

    await pool.query(`UPDATE "Admins" SET "IsActive" = FALSE, "UpdatedAt" = NOW() WHERE "AdminId" = $1 AND "TenantId" = $2`, [adminId, tenantId]);

};

// Unlike getByTenantAndEmail, this doesn't filter on IsActive - a platform
// admin resetting a password needs to find a deactivated account too (and
// resetPassword below reactivates it), whereas login deliberately treats
// "deactivated" and "doesn't exist" the same way.
export const getByTenantAndEmailAny = async (tenantId, email) => {

    const result = await pool.query(
        `SELECT * FROM "Admins" WHERE "TenantId" = $1 AND "Email" = $2`,
        [tenantId, email]
    );

    return result.rows[0];

};

export const resetPassword = async (adminId, hashedPassword) => {

    // Also clears any lockout - a platform admin resetting a locked-out
    // owner's password so they can log in again would otherwise still
    // find themselves locked out despite the new password being correct.
    const result = await pool.query(
        `UPDATE "Admins"
         SET "Password" = $1, "IsActive" = TRUE, "FailedLoginAttempts" = 0, "LockedUntil" = NULL, "UpdatedAt" = NOW()
         WHERE "AdminId" = $2
         RETURNING "AdminId", "Email"`,
        [hashedPassword, adminId]
    );

    return result.rows[0];

};
