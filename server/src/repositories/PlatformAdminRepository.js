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
