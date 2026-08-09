// Wires up recipes for every remaining menu item (the whole multi-cuisine
// menu, not just Tea) against production, through the real HTTP API.
//   ADMIN_TOKEN=eyJ... node scripts/map-full-menu.mjs

const BASE = "https://restroos-api.vercel.app/api/v1";
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) {
    console.error("Set ADMIN_TOKEN first.");
    process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const call = async (method, path, body) => {
    const response = await fetch(`${BASE}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined
    });
    const json = await response.json();
    if (!response.ok || json.success === false) {
        throw new Error(`${method} ${path} -> ${response.status}: ${json.message}`);
    }
    return json.data;
};

const NEW_INGREDIENTS = [
    { name: "Refined Flour (Maida)", baseUnit: "g", cost: 0.06, threshold: 500, openingQty: 5000, category: "Base" },
    { name: "Wheat Flour (Atta)", baseUnit: "g", cost: 0.05, threshold: 500, openingQty: 5000, category: "Base" },
    { name: "Potato", baseUnit: "g", cost: 0.03, threshold: 1000, openingQty: 10000, category: "Vegetables" },
    { name: "Onion", baseUnit: "g", cost: 0.04, threshold: 1000, openingQty: 8000, category: "Vegetables" },
    { name: "Tomato", baseUnit: "g", cost: 0.05, threshold: 1000, openingQty: 8000, category: "Vegetables" },
    { name: "Butter", baseUnit: "g", cost: 0.45, threshold: 200, openingQty: 2000, category: "Dairy" },
    { name: "Ghee", baseUnit: "ml", cost: 0.60, threshold: 200, openingQty: 2000, category: "Dairy" },
    { name: "Cheese", baseUnit: "g", cost: 0.70, threshold: 200, openingQty: 1500, category: "Dairy" },
    { name: "Mushroom", baseUnit: "g", cost: 0.30, threshold: 200, openingQty: 1500, category: "Vegetables" },
    { name: "Mixed Vegetables", baseUnit: "g", cost: 0.12, threshold: 500, openingQty: 5000, category: "Vegetables" },
    { name: "Bread Slice", baseUnit: "pc", cost: 4, threshold: 20, openingQty: 200, category: "Base" },
    { name: "Burger Bun", baseUnit: "pc", cost: 12, threshold: 10, openingQty: 100, category: "Base" },
    { name: "Sweet Corn", baseUnit: "g", cost: 0.15, threshold: 300, openingQty: 3000, category: "Vegetables" },
    { name: "Cornflour", baseUnit: "g", cost: 0.08, threshold: 200, openingQty: 2000, category: "Base" },
    { name: "Fish", baseUnit: "g", cost: 0.60, threshold: 500, openingQty: 3000, category: "Non-Veg" },
    { name: "Lemon", baseUnit: "pc", cost: 5, threshold: 10, openingQty: 100, category: "Vegetables" },
    { name: "Coriander", baseUnit: "g", cost: 0.10, threshold: 100, openingQty: 1000, category: "Vegetables" },
    { name: "Soy Sauce", baseUnit: "ml", cost: 0.25, threshold: 200, openingQty: 2000, category: "Condiments" },
    { name: "Vinegar", baseUnit: "ml", cost: 0.15, threshold: 200, openingQty: 2000, category: "Condiments" },
    { name: "Chaat Masala", baseUnit: "g", cost: 0.50, threshold: 100, openingQty: 1000, category: "Spices" },
    { name: "Tamarind Chutney", baseUnit: "ml", cost: 0.20, threshold: 300, openingQty: 3000, category: "Condiments" },
    { name: "Curd (Dahi)", baseUnit: "g", cost: 0.08, threshold: 500, openingQty: 5000, category: "Dairy" },
    { name: "Sev", baseUnit: "g", cost: 0.30, threshold: 200, openingQty: 2000, category: "Base" },
    { name: "Puri", baseUnit: "pc", cost: 1, threshold: 50, openingQty: 500, category: "Base" },
    { name: "Chickpeas (Chole)", baseUnit: "g", cost: 0.12, threshold: 500, openingQty: 5000, category: "Base" },
    { name: "Cucumber", baseUnit: "g", cost: 0.03, threshold: 300, openingQty: 3000, category: "Vegetables" },
    { name: "Mixed Fruits", baseUnit: "g", cost: 0.20, threshold: 500, openingQty: 4000, category: "Fruits" },
    { name: "Custard Powder", baseUnit: "g", cost: 0.15, threshold: 100, openingQty: 1000, category: "Base" },
    { name: "Apple", baseUnit: "g", cost: 0.15, threshold: 300, openingQty: 2000, category: "Fruits" },
    { name: "Cherry", baseUnit: "g", cost: 1.50, threshold: 50, openingQty: 500, category: "Fruits" },
    { name: "Vanilla Ice Cream", baseUnit: "g", cost: 0.50, threshold: 300, openingQty: 3000, category: "Dairy" },
    { name: "Chocolate Syrup", baseUnit: "ml", cost: 0.40, threshold: 200, openingQty: 1500, category: "Condiments" },
    { name: "Saffron (Kesar)", baseUnit: "g", cost: 40, threshold: 2, openingQty: 10, category: "Spices" },
    { name: "Thandai Masala", baseUnit: "g", cost: 3, threshold: 50, openingQty: 300, category: "Spices" },
    { name: "Lime", baseUnit: "pc", cost: 3, threshold: 10, openingQty: 100, category: "Vegetables" },
    { name: "Rooh Afza Syrup", baseUnit: "ml", cost: 0.50, threshold: 200, openingQty: 1500, category: "Condiments" }
];

// name -> [{ ingredient, quantity, unit }], quantities are per single serving.
const RECIPES = {
    "cold coffee": [["Coffee Powder", 10, "g"], ["Milk", 150, "ml"], ["Sugar", 10, "g"], ["Vanilla Ice Cream", 30, "g"]],
    "hot coffee": [["Coffee Powder", 8, "g"], ["Milk", 150, "ml"], ["Sugar", 8, "g"], ["Water", 50, "ml"]],
    "special coffee": [["Coffee Powder", 10, "g"], ["Milk", 150, "ml"], ["Sugar", 10, "g"], ["Chocolate Syrup", 15, "ml"]],

    "kesar thandai": [["Milk", 200, "ml"], ["Sugar", 15, "g"], ["Thandai Masala", 10, "g"], ["Saffron (Kesar)", 0.05, "g"]],
    "lime juice": [["Lime", 2, "pc"], ["Sugar", 15, "g"], ["Salt", 0.001, "kg"], ["Water", 150, "ml"]],
    "rooh afza": [["Rooh Afza Syrup", 30, "ml"], ["Water", 150, "ml"], ["Milk", 50, "ml"]],

    "bhel puri": [["Puri", 15, "pc"], ["Onion", 20, "g"], ["Tomato", 20, "g"], ["Sev", 15, "g"], ["Tamarind Chutney", 20, "ml"], ["Chaat Masala", 3, "g"]],
    "dahi puri": [["Puri", 10, "pc"], ["Curd (Dahi)", 80, "g"], ["Sev", 10, "g"], ["Tamarind Chutney", 15, "ml"], ["Chaat Masala", 2, "g"], ["Potato", 20, "g"]],
    "pani puri": [["Puri", 6, "pc"], ["Potato", 30, "g"], ["Chickpeas (Chole)", 20, "g"], ["Tamarind Chutney", 20, "ml"], ["Chaat Masala", 2, "g"]],
    "samosa ragada chaat": [["Potato", 60, "g"], ["Chickpeas (Chole)", 50, "g"], ["Curd (Dahi)", 40, "g"], ["Sev", 15, "g"], ["Tamarind Chutney", 20, "ml"], ["Chaat Masala", 3, "g"], ["Refined Flour (Maida)", 20, "g"], ["Refinded Oil", 0.01, "kg"]],

    "dilli chole bhature": [["Chickpeas (Chole)", 150, "g"], ["Refined Flour (Maida)", 100, "g"], ["Onion", 30, "g"], ["Tomato", 40, "g"], ["Refinded Oil", 0.03, "kg"], ["Ghee", 10, "ml"]],

    "mushroom cheese momo": [["Refined Flour (Maida)", 80, "g"], ["Mushroom", 60, "g"], ["Cheese", 30, "g"], ["Onion", 15, "g"], ["Soy Sauce", 5, "ml"]],
    "paneer momo": [["Refined Flour (Maida)", 80, "g"], ["Paneer", 0.06, "kg"], ["Onion", 15, "g"], ["Soy Sauce", 5, "ml"]],
    "veg momo": [["Refined Flour (Maida)", 80, "g"], ["Mixed Vegetables", 70, "g"], ["Onion", 15, "g"], ["Soy Sauce", 5, "ml"]],

    "aloo paratha": [["Wheat Flour (Atta)", 100, "g"], ["Potato", 80, "g"], ["Butter", 15, "g"], ["Onion", 10, "g"]],
    "paneer paratha": [["Wheat Flour (Atta)", 100, "g"], ["Paneer", 0.08, "kg"], ["Butter", 15, "g"], ["Onion", 10, "g"]],
    "sweet paratha": [["Wheat Flour (Atta)", 100, "g"], ["Sugar", 30, "g"], ["Ghee", 20, "ml"]],

    "kachori - aloo curry": [["Refined Flour (Maida)", 60, "g"], ["Potato", 120, "g"], ["Refinded Oil", 0.04, "kg"], ["Onion", 20, "g"], ["Tomato", 20, "g"]],
    "poori - aloo curry": [["Wheat Flour (Atta)", 60, "g"], ["Potato", 120, "g"], ["Refinded Oil", 0.04, "kg"], ["Onion", 20, "g"], ["Tomato", 20, "g"]],

    "fish biryani": [["Rice", 0.2, "kg"], ["Fish", 150, "g"], ["Onion", 40, "g"], ["Tomato", 30, "g"], ["Refinded Oil", 0.03, "kg"], ["Ginger", 5, "g"]],
    "lemon coriander rice": [["Rice", 0.2, "kg"], ["Lemon", 1, "pc"], ["Coriander", 10, "g"], ["Refinded Oil", 0.015, "kg"]],
    "tawa paneer pulao": [["Rice", 0.2, "kg"], ["Paneer", 0.08, "kg"], ["Onion", 30, "g"], ["Tomato", 20, "g"], ["Refinded Oil", 0.02, "kg"]],
    "veg fried rice": [["Rice", 0.2, "kg"], ["Mixed Vegetables", 80, "g"], ["Soy Sauce", 10, "ml"], ["Refinded Oil", 0.015, "kg"]],

    "mix fruit bowl": [["Mixed Fruits", 200, "g"]],
    "mix fruit custard bowl": [["Mixed Fruits", 150, "g"], ["Custard Powder", 20, "g"], ["Milk", 100, "ml"], ["Sugar", 15, "g"]],
    "salad bowl": [["Cucumber", 60, "g"], ["Tomato", 60, "g"], ["Onion", 40, "g"]],

    "burger": [["Burger Bun", 1, "pc"], ["Potato", 100, "g"], ["Refinded Oil", 0.02, "kg"], ["Onion", 15, "g"]],
    "kachori": [["Refined Flour (Maida)", 30, "g"], ["Potato", 40, "g"], ["Refinded Oil", 0.015, "kg"]],
    "samosa": [["Refined Flour (Maida)", 30, "g"], ["Potato", 50, "g"], ["Refinded Oil", 0.015, "kg"]],
    "sandwich": [["Bread Slice", 2, "pc"], ["Potato", 40, "g"], ["Butter", 10, "g"], ["Onion", 10, "g"], ["Tomato", 15, "g"]],
    "vadapav": [["Burger Bun", 1, "pc"], ["Potato", 80, "g"], ["Refinded Oil", 0.02, "kg"]],

    "hot & sour soup": [["Mixed Vegetables", 60, "g"], ["Cornflour", 10, "g"], ["Soy Sauce", 10, "ml"], ["Vinegar", 5, "ml"], ["Water", 200, "ml"]],
    "sweet corn soup": [["Sweet Corn", 80, "g"], ["Cornflour", 10, "g"], ["Water", 200, "ml"], ["Butter", 5, "g"]],
    "tomato soup": [["Tomato", 150, "g"], ["Butter", 10, "g"], ["Cornflour", 8, "g"], ["Water", 150, "ml"]],

    "apple pie": [["Apple", 150, "g"], ["Refined Flour (Maida)", 60, "g"], ["Sugar", 30, "g"], ["Butter", 30, "g"]],
    "cake": [["Refined Flour (Maida)", 60, "g"], ["Sugar", 40, "g"], ["Butter", 30, "g"], ["Milk", 30, "ml"]],
    "chhery pia": [["Refined Flour (Maida)", 60, "g"], ["Sugar", 30, "g"], ["Butter", 25, "g"], ["Cherry", 20, "g"]],
    "ice cream": [["Vanilla Ice Cream", 100, "g"]]
};

const run = async () => {

    const branches = await call("GET", "/branches");
    const branch = branches.find((b) => b.IsActive) || branches[0];
    console.log(`Branch: ${branch.BranchName} (#${branch.BranchId})`);

    const existingIngredients = await call("GET", "/ingredients");
    const byName = new Map(existingIngredients.map((i) => [i.Name.toLowerCase(), i]));

    console.log(`\n=== Creating ${NEW_INGREDIENTS.length} new ingredients ===`);
    for (const def of NEW_INGREDIENTS) {

        const key = def.name.toLowerCase();

        if (byName.has(key)) {
            console.log(`- ${def.name}: already exists, skipping.`);
            continue;
        }

        const created = await call("POST", "/ingredients", {
            name: def.name, category: def.category, baseUnit: def.baseUnit,
            lowStockThreshold: def.threshold, costPerBaseUnit: def.cost
        });

        byName.set(key, created);

        await call("POST", "/inventory/opening-stock", {
            branchId: branch.BranchId, ingredientId: created.IngredientId,
            unit: def.baseUnit, quantity: def.openingQty, notes: "Full-menu mapping seed"
        });

        console.log(`- ${def.name}: created #${created.IngredientId}, opening stock ${def.openingQty}${def.baseUnit}`);

    }

    const menu = await call("GET", `/menu?branchId=${branch.BranchId}`);
    const byItemName = new Map(menu.map((m) => [m.ItemName.toLowerCase(), m]));

    console.log(`\n=== Attaching recipes for ${Object.keys(RECIPES).length} menu items ===`);
    let attached = 0, skipped = 0;

    for (const [itemName, lineDefs] of Object.entries(RECIPES)) {

        const item = byItemName.get(itemName);

        if (!item) {
            console.log(`- SKIP "${itemName}": not found on menu.`);
            skipped++;
            continue;
        }

        const missing = lineDefs
            .map(([ingName]) => ingName)
            .filter((ingName) => !byName.has(ingName.toLowerCase()));

        // Report and move on rather than aborting the whole run - one
        // unresolvable ingredient name shouldn't cost the other 37 items
        // their recipes.
        if (missing.length > 0) {
            console.log(`- SKIP "${itemName}": missing ingredient(s) ${missing.join(", ")}`);
            skipped++;
            continue;
        }

        const lines = lineDefs.map(([ingName, quantity, unit]) => ({
            ingredientId: byName.get(ingName.toLowerCase()).IngredientId,
            quantity,
            unit
        }));

        await call("PUT", `/menu-item-recipes/${item.MenuItemId}`, { lines });
        console.log(`- ${item.ItemName} (#${item.MenuItemId}): ${lines.length} lines`);
        attached++;

    }

    console.log(`\nAttached ${attached} recipes, skipped ${skipped}.`);

    console.log("\n=== Final coverage check ===");
    let withRecipe = 0;
    for (const item of menu) {
        const recipe = await call("GET", `/menu-item-recipes/${item.MenuItemId}`);
        if (recipe.length > 0) withRecipe++;
    }
    console.log(`${withRecipe} / ${menu.length} menu items now have a recipe attached.`);

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
