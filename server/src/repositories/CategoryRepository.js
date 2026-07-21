import pool from "../config/db.js";

export const getAllCategoriesByTenantSlug = async (tenantSlug) => {

    const result = await pool.query(
        `SELECT C."CategoryId", C."CategoryName", C."Description", C."ImageUrl", C."DisplayOrder", C."IsActive"
         FROM "Categories" C
         INNER JOIN "Tenants" T ON C."TenantId" = T."TenantId"
         WHERE T."Slug" = $1
         ORDER BY C."DisplayOrder"`,
        [tenantSlug]
    );

    return result.rows;

};

export const getAllCategories = async (tenantId) => {

    const result = await pool.query(
        `SELECT "CategoryId", "CategoryName", "Description", "ImageUrl", "DisplayOrder", "IsActive"
         FROM "Categories"
         WHERE "TenantId" = $1
         ORDER BY "DisplayOrder"`,
        [tenantId]
    );

    return result.rows;

};

export const getCategoryById = async (categoryId) => {

    const result = await pool.query(
        `SELECT "CategoryId", "TenantId", "CategoryName", "Description", "ImageUrl", "DisplayOrder", "IsActive"
         FROM "Categories"
         WHERE "CategoryId" = $1`,
        [categoryId]
    );

    return result.rows[0];

};

export const checkCategoryExists = async (tenantId, categoryName) => {

    const result = await pool.query(
        `SELECT "CategoryId" FROM "Categories" WHERE "TenantId" = $1 AND "CategoryName" = $2 AND "IsActive" = TRUE`,
        [tenantId, categoryName]
    );

    return result.rows;

};

export const checkCategoryExistsForUpdate = async (tenantId, categoryId, categoryName) => {

    const result = await pool.query(
        `SELECT "CategoryId" FROM "Categories" WHERE "TenantId" = $1 AND "CategoryName" = $2 AND "CategoryId" <> $3 AND "IsActive" = TRUE`,
        [tenantId, categoryName, categoryId]
    );

    return result.rows;

};

export const createCategory = async (category) => {

    const result = await pool.query(
        `INSERT INTO "Categories" ("TenantId", "CategoryName", "Description", "ImageUrl", "DisplayOrder", "IsActive", "CreatedAt", "UpdatedAt")
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
         RETURNING *`,
        [category.tenantId, category.categoryName, category.description, category.imageUrl, category.displayOrder]
    );

    return result.rows[0];

};

export const updateCategory = async (category) => {

    const result = await pool.query(
        `UPDATE "Categories"
         SET "CategoryName" = $1, "Description" = $2, "ImageUrl" = $3, "DisplayOrder" = $4, "IsActive" = $5, "UpdatedAt" = NOW()
         WHERE "CategoryId" = $6
         RETURNING *`,
        [category.categoryName, category.description, category.imageUrl, category.displayOrder, category.isActive, category.categoryId]
    );

    return result.rows[0];

};

export const deleteCategory = async (categoryId) => {

    const result = await pool.query(`DELETE FROM "Categories" WHERE "CategoryId" = $1`, [categoryId]);

    return { RowsAffected: result.rowCount };

};
