import pool from "../config/db.js";

export const getRecipeForMenuItem = async (menuItemId) => {

    const result = await pool.query(
        `SELECT R."RecipeItemId", R."MenuItemId", R."IngredientId", I."Name" AS "IngredientName", R."Quantity", R."Unit"
         FROM "MenuItemRecipes" R
         INNER JOIN "Ingredients" I ON I."IngredientId" = R."IngredientId"
         WHERE R."MenuItemId" = $1
         ORDER BY I."Name"`,
        [menuItemId]
    );

    return result.rows;

};

// Same "replace the whole set" shape as MenuItemOptionGroups editing
// elsewhere in this codebase - simpler than diffing individual rows for a
// list this small, and a recipe realistically gets edited as a whole.
export const replaceRecipe = async (menuItemId, lines) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        await client.query(`DELETE FROM "MenuItemRecipes" WHERE "MenuItemId" = $1`, [menuItemId]);

        for (const line of lines) {

            await client.query(
                `INSERT INTO "MenuItemRecipes" ("MenuItemId", "IngredientId", "Quantity", "Unit")
                 VALUES ($1, $2, $3, $4)`,
                [menuItemId, line.ingredientId, line.quantity, line.unit]
            );

        }

        await client.query("COMMIT");

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

    return getRecipeForMenuItem(menuItemId);

};
