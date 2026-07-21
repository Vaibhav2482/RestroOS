import pool from "../config/db.js";

// Used by the tenant-boundary check in the service layer - resolves a
// group or option back to the MenuItem (and, via it, the Branch) it
// belongs to, the same way every other write path in this codebase proves
// a resource belongs to the caller's own tenant before touching it.
export const getMenuItemTenantId = async (menuItemId) => {

    const result = await pool.query(
        `SELECT B."TenantId"
         FROM "MenuItems" M
         INNER JOIN "Branches" B ON M."BranchId" = B."BranchId"
         WHERE M."MenuItemId" = $1`,
        [menuItemId]
    );

    return result.rows[0]?.TenantId;

};

export const getGroupWithTenant = async (groupId) => {

    const result = await pool.query(
        `SELECT G."GroupId", G."MenuItemId", B."TenantId"
         FROM "MenuItemOptionGroups" G
         INNER JOIN "MenuItems" M ON G."MenuItemId" = M."MenuItemId"
         INNER JOIN "Branches" B ON M."BranchId" = B."BranchId"
         WHERE G."GroupId" = $1`,
        [groupId]
    );

    return result.rows[0];

};

export const getOptionWithTenant = async (optionId) => {

    const result = await pool.query(
        `SELECT O."OptionId", O."GroupId", B."TenantId"
         FROM "MenuItemOptions" O
         INNER JOIN "MenuItemOptionGroups" G ON O."GroupId" = G."GroupId"
         INNER JOIN "MenuItems" M ON G."MenuItemId" = M."MenuItemId"
         INNER JOIN "Branches" B ON M."BranchId" = B."BranchId"
         WHERE O."OptionId" = $1`,
        [optionId]
    );

    return result.rows[0];

};

export const getGroupsForMenuItem = async (menuItemId) => {

    const groups = await pool.query(
        `SELECT "GroupId", "MenuItemId", "GroupName", "IsRequired", "MinSelect", "MaxSelect", "DisplayOrder"
         FROM "MenuItemOptionGroups"
         WHERE "MenuItemId" = $1
         ORDER BY "DisplayOrder"`,
        [menuItemId]
    );

    const options = await pool.query(
        `SELECT O."OptionId", O."GroupId", O."OptionName", O."PriceDelta", O."IsDefault", O."DisplayOrder", O."IsActive"
         FROM "MenuItemOptions" O
         INNER JOIN "MenuItemOptionGroups" G ON O."GroupId" = G."GroupId"
         WHERE G."MenuItemId" = $1 AND O."IsActive" = TRUE
         ORDER BY O."DisplayOrder"`,
        [menuItemId]
    );

    return groups.rows.map((group) => ({
        ...group,
        Options: options.rows.filter((option) => option.GroupId === group.GroupId)
    }));

};

export const createGroup = async (group) => {

    const result = await pool.query(
        `INSERT INTO "MenuItemOptionGroups" ("MenuItemId", "GroupName", "IsRequired", "MinSelect", "MaxSelect", "DisplayOrder")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [group.menuItemId, group.groupName, group.isRequired ?? false, group.minSelect ?? 0, group.maxSelect ?? 1, group.displayOrder ?? 1]
    );

    return result.rows[0];

};

export const updateGroup = async (group) => {

    const result = await pool.query(
        `UPDATE "MenuItemOptionGroups"
         SET "GroupName" = $1, "IsRequired" = $2, "MinSelect" = $3, "MaxSelect" = $4, "DisplayOrder" = $5, "UpdatedAt" = NOW()
         WHERE "GroupId" = $6
         RETURNING *`,
        [group.groupName, group.isRequired ?? false, group.minSelect ?? 0, group.maxSelect ?? 1, group.displayOrder ?? 1, group.groupId]
    );

    return result.rows[0];

};

export const deleteGroup = async (groupId) => {
    await pool.query(`DELETE FROM "MenuItemOptionGroups" WHERE "GroupId" = $1`, [groupId]);
};

export const createOption = async (option) => {

    const result = await pool.query(
        `INSERT INTO "MenuItemOptions" ("GroupId", "OptionName", "PriceDelta", "IsDefault", "DisplayOrder")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [option.groupId, option.optionName, option.priceDelta ?? 0, option.isDefault ?? false, option.displayOrder ?? 1]
    );

    return result.rows[0];

};

export const updateOption = async (option) => {

    const result = await pool.query(
        `UPDATE "MenuItemOptions"
         SET "OptionName" = $1, "PriceDelta" = $2, "IsDefault" = $3, "DisplayOrder" = $4, "IsActive" = $5
         WHERE "OptionId" = $6
         RETURNING *`,
        [option.optionName, option.priceDelta ?? 0, option.isDefault ?? false, option.displayOrder ?? 1, option.isActive ?? true, option.optionId]
    );

    return result.rows[0];

};

export const deleteOption = async (optionId) => {
    await pool.query(`DELETE FROM "MenuItemOptions" WHERE "OptionId" = $1`, [optionId]);
};
