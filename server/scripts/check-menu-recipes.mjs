// Read-only: full menu list for Chai Chakana Company (branch 1) plus which
// items already have a recipe attached, via the real HTTP API.
//   ADMIN_TOKEN=eyJ... node scripts/check-menu-recipes.mjs

const BASE = "https://restroos-api.vercel.app/api/v1";
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) {
    console.error("Set ADMIN_TOKEN first.");
    process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}` };

const call = async (path) => {
    const response = await fetch(`${BASE}${path}`, { headers });
    const json = await response.json();
    if (!response.ok || json.success === false) {
        throw new Error(`GET ${path} -> ${response.status}: ${json.message}`);
    }
    return json.data;
};

const run = async () => {

    const branches = await call("/branches");
    const branch = branches.find((b) => b.IsActive) || branches[0];

    const menu = await call(`/menu?branchId=${branch.BranchId}`);
    const categories = await call("/categories");
    const categoryById = new Map(categories.map((c) => [c.CategoryId, c.CategoryName]));

    const rows = [];

    for (const item of menu) {

        const recipe = await call(`/menu-item-recipes/${item.MenuItemId}`);

        rows.push({
            MenuItemId: item.MenuItemId,
            Category: categoryById.get(item.CategoryId) || "-",
            ItemName: item.ItemName,
            Price: item.Price,
            Active: item.IsActive,
            RecipeLines: recipe.length,
            HasRecipe: recipe.length > 0 ? "YES" : ""
        });

    }

    rows.sort((a, b) => (a.Category || "").localeCompare(b.Category || "") || a.ItemName.localeCompare(b.ItemName));

    console.table(rows);
    console.log(`\nTotal menu items: ${rows.length}`);
    console.log(`With a recipe attached: ${rows.filter((r) => r.HasRecipe).length}`);
    console.log(`Without a recipe (no auto-deduction yet): ${rows.filter((r) => !r.HasRecipe).length}`);

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
