import pool from "../config/db.js";

export const getAllMenuItems = async (branchId) => {

    const result = await pool.query(
        `SELECT M."MenuItemId", M."BranchId", M."CategoryId", C."CategoryName", M."ItemName", M."Description",
                M."Price", M."ImageUrl", M."IsVeg", M."IsAvailable", M."IsPopular", M."IsActive", M."CreatedAt", M."UpdatedAt",
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
                M."Price", M."ImageUrl", M."IsVeg", M."IsAvailable", M."IsPopular", M."IsActive", M."CreatedAt", M."UpdatedAt",
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

export const checkMenuItemExists = async (itemName, branchId) => {

    const result = await pool.query(
        `SELECT "MenuItemId" FROM "MenuItems" WHERE "ItemName" = $1 AND "BranchId" = $2`,
        [itemName, branchId]
    );

    return result.rows;

};

export const createMenuItem = async (menuItem) => {

    const result = await pool.query(
        `INSERT INTO "MenuItems"
            ("BranchId", "CategoryId", "ItemName", "Description", "Price", "ImageUrl", "IsVeg", "IsAvailable", "IsPopular", "IsActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING "MenuItemId"`,
        [
            menuItem.branchId,
            menuItem.categoryId,
            menuItem.itemName,
            menuItem.description,
            menuItem.price,
            menuItem.imageUrl,
            menuItem.isVeg ?? true,
            menuItem.isAvailable,
            menuItem.isPopular,
            menuItem.isActive
        ]
    );

    return result.rows[0];

};

export const updateMenuItem = async (menuItem) => {

    const result = await pool.query(
        `UPDATE "MenuItems"
         SET "CategoryId" = $1, "ItemName" = $2, "Description" = $3, "Price" = $4, "ImageUrl" = $5,
             "IsVeg" = $6, "IsAvailable" = $7, "IsPopular" = $8, "IsActive" = $9, "UpdatedAt" = NOW()
         WHERE "MenuItemId" = $10
         RETURNING *`,
        [
            menuItem.categoryId,
            menuItem.itemName,
            menuItem.description,
            menuItem.price,
            menuItem.imageUrl ?? null,
            menuItem.isVeg ?? true,
            menuItem.isAvailable,
            menuItem.isPopular,
            menuItem.isActive,
            menuItem.menuItemId
        ]
    );

    return result.rows[0];

};

export const getMenuItemByName = async (itemName, branchId) => {

    const result = await pool.query(
        `SELECT * FROM "MenuItems" WHERE "ItemName" = $1 AND "BranchId" = $2`,
        [itemName, branchId]
    );

    return result.rows[0];

};

export const deleteMenuItem = async (menuItemId) => {

    const result = await pool.query(`DELETE FROM "MenuItems" WHERE "MenuItemId" = $1`, [menuItemId]);

    return { RowsAffected: result.rowCount };

};
