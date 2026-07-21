import pool from "../config/db.js";
import { resolveMenuItemOptions, selectionsMatch } from "../utils/menuOptionResolver.js";

export const addToCart = async (cart) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const customerCheck = await client.query(
            `SELECT 1 FROM "Customers" WHERE "CustomerId" = $1 AND "IsActive" = TRUE`,
            [cart.customerId]
        );

        if (customerCheck.rows.length === 0) {
            throw new Error("Customer not found.");
        }

        const menuItemCheck = await client.query(
            `SELECT "BranchId", "Price" FROM "MenuItems" WHERE "MenuItemId" = $1 AND "IsAvailable" = TRUE`,
            [cart.menuItemId]
        );

        const newItemBranchId = menuItemCheck.rows[0]?.BranchId;

        if (!newItemBranchId) {
            throw new Error("Menu item not found.");
        }

        const branchMismatch = await client.query(
            `SELECT 1
             FROM "Cart" C
             INNER JOIN "MenuItems" M ON C."MenuItemId" = M."MenuItemId"
             WHERE C."CustomerId" = $1 AND M."BranchId" <> $2`,
            [cart.customerId, newItemBranchId]
        );

        if (branchMismatch.rows.length > 0) {
            throw new Error("Your cart has items from a different branch. Clear your cart before ordering from a new branch.");
        }

        const { priceDelta, selectedOptions } = await resolveMenuItemOptions(client, cart.menuItemId, cart.selectedOptionIds);

        const unitPrice = Number(menuItemCheck.rows[0].Price) + priceDelta;

        const existingLines = await client.query(
            `SELECT "CartId", "SelectedOptions" FROM "Cart" WHERE "CustomerId" = $1 AND "MenuItemId" = $2`,
            [cart.customerId, cart.menuItemId]
        );

        const matchingLine = existingLines.rows.find((line) => selectionsMatch(line.SelectedOptions ?? [], selectedOptions));

        let cartId;

        if (matchingLine) {

            await client.query(
                `UPDATE "Cart" SET "Quantity" = "Quantity" + $1 WHERE "CartId" = $2`,
                [cart.quantity, matchingLine.CartId]
            );

            cartId = matchingLine.CartId;

        } else {

            const inserted = await client.query(
                `INSERT INTO "Cart" ("CustomerId", "MenuItemId", "Quantity", "UnitPrice", "SelectedOptions")
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING "CartId"`,
                [cart.customerId, cart.menuItemId, cart.quantity, unitPrice, JSON.stringify(selectedOptions)]
            );

            cartId = inserted.rows[0].CartId;

        }

        const result = await client.query(
            `SELECT "CartId", "CustomerId", "MenuItemId", "Quantity", "UnitPrice", "SelectedOptions", "CreatedAt"
             FROM "Cart"
             WHERE "CartId" = $1`,
            [cartId]
        );

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

export const getCart = async (customerId) => {

    const result = await pool.query(
        `SELECT C."CartId", C."CustomerId", C."MenuItemId", M."BranchId", M."ItemName", M."ImageUrl",
                C."UnitPrice", C."SelectedOptions",
                C."Quantity", (C."UnitPrice" * C."Quantity") AS "TotalPrice", C."CreatedAt"
         FROM "Cart" C
         INNER JOIN "MenuItems" M ON C."MenuItemId" = M."MenuItemId"
         WHERE C."CustomerId" = $1
         ORDER BY C."CartId"`,
        [customerId]
    );

    return result.rows;

};

export const getCartItemById = async (cartId) => {

    const result = await pool.query(`SELECT * FROM "Cart" WHERE "CartId" = $1`, [cartId]);

    return result.rows[0];

};

export const updateCartQuantity = async (cartId, quantity) => {

    const existing = await pool.query(`SELECT 1 FROM "Cart" WHERE "CartId" = $1`, [cartId]);

    if (existing.rows.length === 0) {
        throw new Error("Cart item not found.");
    }

    await pool.query(`UPDATE "Cart" SET "Quantity" = $1 WHERE "CartId" = $2`, [quantity, cartId]);

    const result = await pool.query(
        `SELECT C."CartId", C."CustomerId", C."MenuItemId", M."ItemName", C."UnitPrice", C."SelectedOptions",
                C."Quantity", (C."UnitPrice" * C."Quantity") AS "TotalPrice"
         FROM "Cart" C
         INNER JOIN "MenuItems" M ON C."MenuItemId" = M."MenuItemId"
         WHERE C."CartId" = $1`,
        [cartId]
    );

    return result.rows[0];

};

export const removeCartItem = async (cartId) => {

    const existing = await pool.query(`SELECT 1 FROM "Cart" WHERE "CartId" = $1`, [cartId]);

    if (existing.rows.length === 0) {
        throw new Error("Cart item not found.");
    }

    await pool.query(`DELETE FROM "Cart" WHERE "CartId" = $1`, [cartId]);

    return { Message: "Cart item removed successfully." };

};

export const clearCart = async (customerId) => {

    await pool.query(`DELETE FROM "Cart" WHERE "CustomerId" = $1`, [customerId]);

    return { Message: "Cart cleared successfully." };

};
