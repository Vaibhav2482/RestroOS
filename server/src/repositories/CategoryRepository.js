import pool from "../config/db.js";

// Public/unauthenticated endpoint (the customer storefront) - the
// storefront's own Home.jsx already filters IsActive client-side before
// rendering, but that's a UI convenience, not a security boundary. This
// query itself was sending every category regardless of IsActive, leaking
// a deactivated (e.g. not-yet-launched, or deliberately hidden) category's
// name to anyone inspecting the raw response, not just the rendered page.
export const getAllCategoriesByTenantSlug = async (tenantSlug) => {

    const result = await pool.query(
        `SELECT C."CategoryId", C."CategoryName", C."Description", C."ImageUrl", C."DisplayOrder", C."IsActive"
         FROM "Categories" C
         INNER JOIN "Tenants" T ON C."TenantId" = T."TenantId"
         WHERE T."Slug" = $1 AND C."IsActive" = TRUE
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

// ILIKE, not "=" - same fix as Menu items/Ingredients: an exact-match check
// let "Beverages" and "beverages" both exist as separate categories for
// the same tenant, defeating the point of a duplicate check. Category
// names have no forced casing convention (unlike coupon codes), so
// nothing on the frontend was masking this one.
export const checkCategoryExists = async (tenantId, categoryName) => {

    const result = await pool.query(
        `SELECT "CategoryId" FROM "Categories" WHERE "TenantId" = $1 AND "CategoryName" ILIKE $2 AND "IsActive" = TRUE`,
        [tenantId, categoryName]
    );

    return result.rows;

};

export const checkCategoryExistsForUpdate = async (tenantId, categoryId, categoryName) => {

    const result = await pool.query(
        `SELECT "CategoryId" FROM "Categories" WHERE "TenantId" = $1 AND "CategoryName" ILIKE $2 AND "CategoryId" <> $3 AND "IsActive" = TRUE`,
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

// tenantId is redundant with the service-layer check that already ran
// before this is called (defense-in-depth per a production-readiness audit:
// a repository write should fail closed on its own WHERE clause, not rely
// solely on every call site remembering to check first).
export const updateCategory = async (category, tenantId) => {

    const result = await pool.query(
        `UPDATE "Categories"
         SET "CategoryName" = $1, "Description" = $2, "ImageUrl" = $3, "DisplayOrder" = $4, "IsActive" = $5, "UpdatedAt" = NOW()
         WHERE "CategoryId" = $6 AND "TenantId" = $7
         RETURNING *`,
        [category.categoryName, category.description, category.imageUrl, category.displayOrder, category.isActive, category.categoryId, tenantId]
    );

    return result.rows[0];

};

export const countMenuItemsByCategory = async (categoryId) => {

    const result = await pool.query(`SELECT COUNT(*)::int AS "Count" FROM "MenuItems" WHERE "CategoryId" = $1`, [categoryId]);

    return result.rows[0].Count;

};

export const deleteCategory = async (categoryId, tenantId) => {

    const result = await pool.query(`DELETE FROM "Categories" WHERE "CategoryId" = $1 AND "TenantId" = $2`, [categoryId, tenantId]);

    return { RowsAffected: result.rowCount };

};
