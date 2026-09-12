import pool from "../config/db.js";

// Case-insensitive for the same reason as CustomerRepository.
// getCustomerByTenantAndEmail - an exact match would lock the platform
// admin out with a misleading "invalid credentials" if they type their
// email with different capitalization than they registered it.
export const getByEmail = async (email) => {

    const result = await pool.query(
        `SELECT * FROM "PlatformAdmins" WHERE LOWER("Email") = LOWER($1) AND "IsActive" = TRUE`,
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
