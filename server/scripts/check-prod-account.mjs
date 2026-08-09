// Read-only lookup. Run from the server/ directory with your PRODUCTION
// DATABASE_URL, e.g.:
//   set DATABASE_URL=postgresql://... (or export on mac/linux)
//   node scripts/check-prod-account.mjs
//
// Or pull it fresh from Vercel first (writes a local file - delete it after):
//   npx vercel env pull --environment=production .env.prod.local
//   node -r dotenv/config scripts/check-prod-account.mjs dotenv_config_path=.env.prod.local

import pg from "pg";

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false }
});

const run = async () => {

    const admin = await pool.query(
        `SELECT A."AdminId", A."FullName", A."Email", A."TenantId", T."TenantName", T."Slug",
                A."BranchId", A."IsActive"
         FROM "Admins" A
         INNER JOIN "Tenants" T ON A."TenantId" = T."TenantId"
         WHERE A."Email" ILIKE $1`,
        ["%vaibhavnawale002%"]
    );
    console.log("=== Admin account ===");
    console.table(admin.rows);

    if (admin.rows.length === 0) {
        await pool.end();
        return;
    }

    const tenantId = admin.rows[0].TenantId;

    const branches = await pool.query(`SELECT "BranchId", "BranchName", "IsActive" FROM "Branches" WHERE "TenantId" = $1`, [tenantId]);
    console.log("=== Branches ===");
    console.table(branches.rows);

    const branchIds = branches.rows.map((row) => row.BranchId);

    const menuItems = await pool.query(
        `SELECT M."MenuItemId", M."ItemName", M."BranchId", C."CategoryName", M."IsActive"
         FROM "MenuItems" M
         LEFT JOIN "Categories" C ON M."CategoryId" = C."CategoryId"
         WHERE M."BranchId" = ANY($1::int[])
         ORDER BY M."BranchId", C."CategoryName", M."ItemName"`,
        [branchIds]
    );
    console.log("=== Menu items ===");
    console.table(menuItems.rows);

    const ingredients = await pool.query(
        `SELECT "IngredientId", "Name", "BranchId", "BaseUnit", "CostPerBaseUnit", "IsActive"
         FROM "Ingredients" WHERE "BranchId" = ANY($1::int[])`,
        [branchIds]
    );
    console.log("=== Existing ingredients ===");
    console.table(ingredients.rows);

    const recipes = await pool.query(
        `SELECT R."MenuItemId", M."ItemName", R."IngredientId", I."Name" AS "IngredientName", R."Quantity", R."Unit"
         FROM "MenuItemRecipes" R
         INNER JOIN "MenuItems" M ON R."MenuItemId" = M."MenuItemId"
         INNER JOIN "Ingredients" I ON R."IngredientId" = I."IngredientId"
         WHERE M."BranchId" = ANY($1::int[])`,
        [branchIds]
    );
    console.log("=== Existing recipes ===");
    console.table(recipes.rows);

    await pool.end();

};

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
