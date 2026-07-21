import pool from "../config/db.js";

export const getAllMenuItems = async (branchId) => {

    const result = await pool.query(
        `SELECT M."MenuItemId", M."BranchId", M."CategoryId", C."CategoryName", M."ItemName", M."Description",
                M."Price", M."ImageUrl", M."IsAvailable", M."IsPopular", M."IsActive", M."CreatedAt", M."UpdatedAt"
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
                M."Price", M."ImageUrl", M."IsAvailable", M."IsPopular", M."IsActive", M."CreatedAt", M."UpdatedAt"
         FROM "MenuItems" M
         INNER JOIN "Categories" C ON M."CategoryId" = C."CategoryId"
         WHERE M."MenuItemId" = $1 AND C."IsActive" = TRUE`,
        [menuItemId]
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
            ("BranchId", "CategoryId", "ItemName", "Description", "Price", "ImageUrl", "IsAvailable", "IsPopular", "IsActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING "MenuItemId"`,
        [
            menuItem.branchId,
            menuItem.categoryId,
            menuItem.itemName,
            menuItem.description,
            menuItem.price,
            menuItem.imageUrl,
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
             "IsAvailable" = $6, "IsPopular" = $7, "IsActive" = $8, "UpdatedAt" = NOW()
         WHERE "MenuItemId" = $9
         RETURNING *`,
        [
            menuItem.categoryId,
            menuItem.itemName,
            menuItem.description,
            menuItem.price,
            menuItem.imageUrl ?? null,
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
