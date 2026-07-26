import pool from "../config/db.js";

export const getAllIngredients = async (tenantId) => {

    const result = await pool.query(
        `SELECT "IngredientId", "TenantId", "Name", "SKU", "Category", "BaseUnit", "LowStockThreshold", "IsActive", "CreatedAt", "UpdatedAt"
         FROM "Ingredients"
         WHERE "TenantId" = $1
         ORDER BY "Name"`,
        [tenantId]
    );

    return result.rows;

};

export const getIngredientById = async (ingredientId) => {

    const result = await pool.query(
        `SELECT "IngredientId", "TenantId", "Name", "SKU", "Category", "BaseUnit", "LowStockThreshold", "IsActive", "CreatedAt", "UpdatedAt"
         FROM "Ingredients"
         WHERE "IngredientId" = $1`,
        [ingredientId]
    );

    return result.rows[0];

};

export const checkIngredientExists = async (tenantId, name) => {

    const result = await pool.query(
        `SELECT "IngredientId" FROM "Ingredients" WHERE "TenantId" = $1 AND "Name" = $2`,
        [tenantId, name]
    );

    return result.rows;

};

export const checkIngredientExistsForUpdate = async (tenantId, ingredientId, name) => {

    const result = await pool.query(
        `SELECT "IngredientId" FROM "Ingredients" WHERE "TenantId" = $1 AND "Name" = $2 AND "IngredientId" <> $3`,
        [tenantId, name, ingredientId]
    );

    return result.rows;

};

export const createIngredient = async (ingredient) => {

    const result = await pool.query(
        `INSERT INTO "Ingredients" ("TenantId", "Name", "SKU", "Category", "BaseUnit", "LowStockThreshold", "IsActive")
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING *`,
        [
            ingredient.tenantId,
            ingredient.name,
            ingredient.sku ?? null,
            ingredient.category ?? null,
            ingredient.baseUnit,
            ingredient.lowStockThreshold ?? null
        ]
    );

    return result.rows[0];

};

export const updateIngredient = async (ingredient) => {

    const result = await pool.query(
        `UPDATE "Ingredients"
         SET "Name" = $1, "SKU" = $2, "Category" = $3, "BaseUnit" = $4, "LowStockThreshold" = $5, "IsActive" = $6, "UpdatedAt" = NOW()
         WHERE "IngredientId" = $7
         RETURNING *`,
        [
            ingredient.name,
            ingredient.sku ?? null,
            ingredient.category ?? null,
            ingredient.baseUnit,
            ingredient.lowStockThreshold ?? null,
            ingredient.isActive,
            ingredient.ingredientId
        ]
    );

    return result.rows[0];

};
