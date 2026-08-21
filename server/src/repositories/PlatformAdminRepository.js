import pool from "../config/db.js";

export const getByEmail = async (email) => {

    const result = await pool.query(
        `SELECT * FROM "PlatformAdmins" WHERE "Email" = $1 AND "IsActive" = TRUE`,
        [email]
    );

    return result.rows[0];

};

export const create = async (admin) => {

    const result = await pool.query(
        `INSERT INTO "PlatformAdmins" ("FullName", "Email", "Password")
         VALUES ($1, $2, $3)
         RETURNING "PlatformAdminId", "FullName", "Email", "IsActive", "CreatedAt"`,
        [admin.fullName, admin.email, admin.password]
    );

    return result.rows[0];

};

export const count = async () => {

    const result = await pool.query(`SELECT COUNT(*)::int AS "Count" FROM "PlatformAdmins"`);

    return result.rows[0].Count;

};

// LockedUntil is only set once FailedLoginAttempts crosses the threshold
// (checked in PlatformAdminService) - below that, this just keeps counting.
export const recordFailedLogin = async (platformAdminId, lockedUntil) => {

    await pool.query(
        `UPDATE "PlatformAdmins"
         SET "FailedLoginAttempts" = "FailedLoginAttempts" + 1, "LockedUntil" = COALESCE($2, "LockedUntil")
         WHERE "PlatformAdminId" = $1`,
        [platformAdminId, lockedUntil ?? null]
    );

};

export const resetFailedLogins = async (platformAdminId) => {

    await pool.query(
        `UPDATE "PlatformAdmins" SET "FailedLoginAttempts" = 0, "LockedUntil" = NULL WHERE "PlatformAdminId" = $1`,
        [platformAdminId]
    );

};

// Only ever used internally to verify a password on a self-service change -
// the hash itself must never appear in an API response.
export const getPasswordHash = async (platformAdminId) => {

    const result = await pool.query(
        `SELECT "Password" FROM "PlatformAdmins" WHERE "PlatformAdminId" = $1`,
        [platformAdminId]
    );

    return result.rows[0]?.Password;

};

export const updatePassword = async (platformAdminId, hashedPassword) => {

    await pool.query(
        `UPDATE "PlatformAdmins" SET "Password" = $1 WHERE "PlatformAdminId" = $2`,
        [hashedPassword, platformAdminId]
    );

};
