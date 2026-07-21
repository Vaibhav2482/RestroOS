import pool from "../config/db.js";

export const getActiveTables = async (branchId) => {

    const result = await pool.query(
        `SELECT "TableId", "BranchId", "TableName", "Capacity"
         FROM "Tables"
         WHERE "BranchId" = $1 AND "IsActive" = TRUE
         ORDER BY regexp_replace("TableName", '\\d+', '', 'g'),
                  NULLIF(regexp_replace("TableName", '\\D', '', 'g'), '')::bigint NULLS FIRST,
                  "TableName"`,
        [branchId]
    );

    return result.rows;

};

export const getAllTables = async (tenantId, branchId) => {

    const result = await pool.query(
        `SELECT T."TableId", T."BranchId", B."BranchName", T."TableName", T."Capacity", T."IsActive", T."CreatedAt", T."UpdatedAt"
         FROM "Tables" T
         INNER JOIN "Branches" B ON T."BranchId" = B."BranchId"
         WHERE B."TenantId" = $1 AND ($2::int IS NULL OR T."BranchId" = $2)
         ORDER BY B."BranchName",
                  regexp_replace(T."TableName", '\\d+', '', 'g'),
                  NULLIF(regexp_replace(T."TableName", '\\D', '', 'g'), '')::bigint NULLS FIRST,
                  T."TableName"`,
        [tenantId, branchId ?? null]
    );

    return result.rows;

};

export const getTableById = async (tableId) => {

    const result = await pool.query(
        `SELECT T."TableId", T."BranchId", B."TenantId", T."TableName", T."Capacity", T."IsActive", T."CreatedAt", T."UpdatedAt"
         FROM "Tables" T
         INNER JOIN "Branches" B ON T."BranchId" = B."BranchId"
         WHERE T."TableId" = $1`,
        [tableId]
    );

    return result.rows[0];

};

export const getTableByName = async (branchId, tableName, excludeTableId = null) => {

    const result = await pool.query(
        `SELECT "TableId", "TableName", "IsActive"
         FROM "Tables"
         WHERE "BranchId" = $1
           AND LOWER(TRIM("TableName")) = LOWER(TRIM($2))
           AND ($3::int IS NULL OR "TableId" <> $3)`,
        [branchId, tableName, excludeTableId]
    );

    return result.rows[0];

};

export const createTable = async (table) => {

    const result = await pool.query(
        `INSERT INTO "Tables" ("BranchId", "TableName", "Capacity", "IsActive", "CreatedAt")
         VALUES ($1, $2, $3, TRUE, NOW())
         RETURNING *`,
        [table.branchId, table.tableName, table.capacity ?? null]
    );

    return result.rows[0];

};

export const updateTable = async (table) => {

    const result = await pool.query(
        `UPDATE "Tables"
         SET "TableName" = $1, "Capacity" = $2, "IsActive" = $3, "UpdatedAt" = NOW()
         WHERE "TableId" = $4
         RETURNING *`,
        [table.tableName, table.capacity ?? null, table.isActive, table.tableId]
    );

    return result.rows[0];

};

export const deactivateTable = async (tableId) => {

    const result = await pool.query(
        `UPDATE "Tables"
         SET "IsActive" = FALSE, "UpdatedAt" = NOW()
         WHERE "TableId" = $1`,
        [tableId]
    );

    return { RowsAffected: result.rowCount };

};
