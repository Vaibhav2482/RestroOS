import pool from "../config/db.js";

export const getAllMenuItems = async (branchId) => {

    const result = await pool.query(
        `SELECT M."MenuItemId", M."BranchId", M."CategoryId", C."CategoryName", M."ItemName", M."Description",
                M."Price", M."TaxRatePercent", M."ImageUrl", M."IsVeg", M."IsAvailable", M."IsPopular", M."IsActive", M."CreatedAt", M."UpdatedAt",
                EXISTS(SELECT 1 FROM "MenuItemOptionGroups" G WHERE G."MenuItemId" = M."MenuItemId") AS "HasOptions"
         FROM "MenuItems" M
         INNER JOIN "Categories" C ON M."CategoryId" = C."CategoryId"
         WHERE C."IsActive" = TRUE AND M."BranchId" = $1
         ORDER BY C."DisplayOrder", M."ItemName"`,
        [branchId]
    );

    return result.rows;

};

export const getMenuItemById = async (menuItemId) => {

    const result = await pool.query(
        `SELECT M."MenuItemId", M."BranchId", M."CategoryId", C."CategoryName", M."ItemName", M."Description",
                M."Price", M."TaxRatePercent", M."ImageUrl", M."IsVeg", M."IsAvailable", M."IsPopular", M."IsActive", M."CreatedAt", M."UpdatedAt",
                EXISTS(SELECT 1 FROM "MenuItemOptionGroups" G WHERE G."MenuItemId" = M."MenuItemId") AS "HasOptions"
         FROM "MenuItems" M
         INNER JOIN "Categories" C ON M."CategoryId" = C."CategoryId"
         WHERE M."MenuItemId" = $1 AND C."IsActive" = TRUE`,
        [menuItemId]
    );

    return result.rows;

};

// Lightweight "pairs well with" cross-sell: other available items from the
// same branch, preferring the same category, then falling back to
// whatever's popular - no recommendation engine, just a simple heuristic.
export const getRecommendations = async (menuItemId, branchId, categoryId, limit = 6) => {

    const result = await pool.query(
        `SELECT M."MenuItemId", M."CategoryId", C."CategoryName", M."ItemName", M."Description",
                M."Price", M."ImageUrl", M."IsVeg", M."IsPopular",
                EXISTS(SELECT 1 FROM "MenuItemOptionGroups" G WHERE G."MenuItemId" = M."MenuItemId") AS "HasOptions"
         FROM "MenuItems" M
         INNER JOIN "Categories" C ON M."CategoryId" = C."CategoryId"
         WHERE M."BranchId" = $1 AND M."MenuItemId" <> $2 AND M."IsAvailable" = TRUE AND M."IsActive" = TRUE
         ORDER BY (M."CategoryId" = $3) DESC, M."IsPopular" DESC, M."ItemName"
         LIMIT $4`,
        [branchId, menuItemId, categoryId, limit]
    );

    return result.rows;

};

// ILIKE, not "=" - an exact-match check let "Ginger Chai" and "ginger
// chai" both get created for the same branch as if they were different
// items, defeating the whole point of a duplicate check. A name is the
// same name to a human regardless of case.
export const checkMenuItemExists = async (itemName, branchId) => {

    const result = await pool.query(
        `SELECT "MenuItemId" FROM "MenuItems" WHERE "ItemName" ILIKE $1 AND "BranchId" = $2`,
        [itemName, branchId]
    );

    return result.rows;

};

export const createMenuItem = async (menuItem) => {

    const result = await pool.query(
        `INSERT INTO "MenuItems"
            ("BranchId", "CategoryId", "ItemName", "Description", "Price", "TaxRatePercent", "ImageUrl", "IsVeg", "IsAvailable", "IsPopular", "IsActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING "MenuItemId"`,
        [
            menuItem.branchId,
            menuItem.categoryId,
            menuItem.itemName,
            menuItem.description,
            menuItem.price,
            menuItem.taxRatePercent,
            menuItem.imageUrl,
            menuItem.isVeg ?? true,
            menuItem.isAvailable,
            menuItem.isPopular,
            menuItem.isActive
        ]
    );

    return result.rows[0];

};

// tenantId redundant with the controller-level check that already ran -
// defense-in-depth so a repository write fails closed on its own WHERE
// clause rather than relying solely on every call site checking first.
// MenuItems has no TenantId column of its own (tenancy is implied through
// BranchId), so this is a subquery rather than a direct column compare.
export const updateMenuItem = async (menuItem, tenantId) => {

    const result = await pool.query(
        `UPDATE "MenuItems"
         SET "CategoryId" = $1, "ItemName" = $2, "Description" = $3, "Price" = $4, "TaxRatePercent" = $5, "ImageUrl" = $6,
             "IsVeg" = $7, "IsAvailable" = $8, "IsPopular" = $9, "IsActive" = $10, "UpdatedAt" = NOW()
         WHERE "MenuItemId" = $11
           AND "BranchId" IN (SELECT "BranchId" FROM "Branches" WHERE "TenantId" = $12)
         RETURNING *`,
        [
            menuItem.categoryId,
            menuItem.itemName,
            menuItem.description,
            menuItem.price,
            menuItem.taxRatePercent,
            menuItem.imageUrl ?? null,
            menuItem.isVeg ?? true,
            menuItem.isAvailable,
            menuItem.isPopular,
            menuItem.isActive,
            menuItem.menuItemId,
            tenantId
        ]
    );

    return result.rows[0];

};

// Same ILIKE reasoning as checkMenuItemExists above - the create-time and
// update-time duplicate checks need to agree on what counts as "the same
// name", or renaming an item to another item's name with different casing
// would sail through here even though creating it fresh would have been
// blocked.
export const getMenuItemByName = async (itemName, branchId) => {

    const result = await pool.query(
        `SELECT * FROM "MenuItems" WHERE "ItemName" ILIKE $1 AND "BranchId" = $2`,
        [itemName, branchId]
    );

    return result.rows[0];

};

export const deleteMenuItem = async (menuItemId, tenantId) => {

    const result = await pool.query(
        `DELETE FROM "MenuItems"
         WHERE "MenuItemId" = $1
           AND "BranchId" IN (SELECT "BranchId" FROM "Branches" WHERE "TenantId" = $2)`,
        [menuItemId, tenantId]
    );

    return { RowsAffected: result.rowCount };

};
