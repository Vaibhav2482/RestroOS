// One-time live setup + demo for Chai Chakana Company (TenantId 1) against
// production (restroos-api.vercel.app), run through the real HTTP API
// (never raw SQL) so every write passes the same validation/business logic
// as a real staff member using the UI.
//
// Run with the tenant's own admin JWT in ADMIN_TOKEN (never hardcode it here):
//   ADMIN_TOKEN=eyJ... node scripts/production-inventory-setup.mjs

const BASE = "https://restroos-api.vercel.app/api/v1";
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) {
    console.error("Set ADMIN_TOKEN first.");
    process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const call = async (method, path, body) => {

    const response = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const json = await response.json();

    if (!response.ok || json.success === false) {
        throw new Error(`${method} ${path} -> ${response.status}: ${json.message}`);
    }

    return json.data;

};

const INGREDIENTS = [
    { name: "Tea Leaves", baseUnit: "g", costPerBaseUnit: 0.80, lowStockThreshold: 200, category: "Base", openingQty: 2000 },
    { name: "Milk", baseUnit: "ml", costPerBaseUnit: 0.06, lowStockThreshold: 2000, category: "Dairy", openingQty: 10000 },
    { name: "Sugar", baseUnit: "g", costPerBaseUnit: 0.05, lowStockThreshold: 500, category: "Base", openingQty: 3000 },
    { name: "Ginger", baseUnit: "g", costPerBaseUnit: 0.15, lowStockThreshold: 100, category: "Spices", openingQty: 500 },
    { name: "Cardamom", baseUnit: "g", costPerBaseUnit: 2.00, lowStockThreshold: 20, category: "Spices", openingQty: 100 },
    { name: "Water", baseUnit: "ml", costPerBaseUnit: 0, lowStockThreshold: null, category: "Base", openingQty: 20000 }
];

const RECIPE_PER_SERVING = [
    { name: "Tea Leaves", quantity: 4, unit: "g" },
    { name: "Milk", quantity: 120, unit: "ml" },
    { name: "Sugar", quantity: 8, unit: "g" },
    { name: "Ginger", quantity: 2, unit: "g" },
    { name: "Cardamom", quantity: 0.3, unit: "g" },
    { name: "Water", quantity: 100, unit: "ml" }
];

const run = async () => {

    console.log("=== Branches ===");
    const branches = await call("GET", "/branches");
    console.table(branches.map((b) => ({ BranchId: b.BranchId, BranchName: b.BranchName, IsActive: b.IsActive })));

    const branch = branches.find((b) => b.IsActive) || branches[0];
    if (!branch) throw new Error("No branch found for this tenant.");
    console.log(`Using branch: ${branch.BranchName} (#${branch.BranchId})`);

    console.log("\n=== Existing ingredients ===");
    const existingIngredients = await call("GET", "/ingredients");
    console.table(existingIngredients.map((i) => ({ IngredientId: i.IngredientId, Name: i.Name, BaseUnit: i.BaseUnit })));

    const byName = new Map(existingIngredients.map((i) => [i.Name.toLowerCase(), i]));

    console.log("\n=== Creating missing ingredients ===");
    for (const def of INGREDIENTS) {

        const key = def.name.toLowerCase();

        if (byName.has(key)) {
            console.log(`- ${def.name}: already exists (#${byName.get(key).IngredientId}), skipping create.`);
            continue;
        }

        const created = await call("POST", "/ingredients", {
            name: def.name,
            category: def.category,
            baseUnit: def.baseUnit,
            lowStockThreshold: def.lowStockThreshold,
            costPerBaseUnit: def.costPerBaseUnit
        });

        console.log(`- ${def.name}: created #${created.IngredientId}`);
        byName.set(key, created);

    }

    console.log("\n=== Recording opening stock ===");
    for (const def of INGREDIENTS) {

        const ingredient = byName.get(def.name.toLowerCase());

        const tx = await call("POST", "/inventory/opening-stock", {
            branchId: branch.BranchId,
            ingredientId: ingredient.IngredientId,
            unit: def.baseUnit,
            quantity: def.openingQty,
            notes: "Initial production seed - live inventory demo"
        });

        console.log(`- ${def.name}: +${def.openingQty}${def.baseUnit} -> balance ${tx.PostQuantityBase}${def.baseUnit}`);

    }

    console.log("\n=== Menu items ===");
    const menu = await call("GET", `/menu?branchId=${branch.BranchId}`);
    console.table(menu.map((m) => ({ MenuItemId: m.MenuItemId, ItemName: m.ItemName, Price: m.Price })));

    const chaiItem = menu.find((m) => /chai|tea/i.test(m.ItemName)) || menu[0];
    if (!chaiItem) throw new Error("No menu item found on this branch to attach a recipe to.");
    console.log(`Attaching recipe to: ${chaiItem.ItemName} (#${chaiItem.MenuItemId})`);

    const lines = RECIPE_PER_SERVING.map((line) => ({
        ingredientId: byName.get(line.name.toLowerCase()).IngredientId,
        quantity: line.quantity,
        unit: line.unit
    }));

    await call("PUT", `/menu-item-recipes/${chaiItem.MenuItemId}`, { lines });
    console.log("Recipe saved:", lines.map((l) => `${l.quantity}${l.unit} of #${l.ingredientId}`).join(", "));

    console.log("\n=== Balances BEFORE order ===");
    const before = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
    const beforeByIngredient = new Map(before.map((r) => [r.IngredientId, r.CurrentQuantityBase]));
    console.table(before.filter((r) => byName.has(r.Name?.toLowerCase())).map((r) => ({ Name: r.Name, Balance: r.CurrentQuantityBase })));

    console.log("\n=== Placing a live test order ===");
    const customer = await call("POST", "/customers/walk-in", {
        phone: "9999999001",
        fullName: "Inventory Demo Customer"
    });
    console.log(`Customer: ${customer.FullName} (#${customer.CustomerId})`);

    const order = await call("POST", "/orders", {
        customerId: customer.CustomerId,
        items: [{ menuItemId: chaiItem.MenuItemId, quantity: 1, selectedOptionIds: [] }],
        deliveryType: "Dine In",
        tableNumber: "DEMO-1",
        paymentMethod: "Cash",
        notes: "Live inventory deduction demo"
    });
    console.log(`Order placed: #${order.OrderId}, status ${order.OrderStatus}, total Rs.${order.TotalAmount}`);

    console.log("\n=== Moving order to Preparing (triggers automatic consumption) ===");
    const updated = await call("PUT", `/orders/${order.OrderId}/status`, { orderStatus: "Preparing" });
    console.log(`Order #${updated.OrderId} status is now: ${updated.OrderStatus}`);

    console.log("\n=== Balances AFTER order ===");
    const after = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
    console.table(after.filter((r) => byName.has(r.Name?.toLowerCase())).map((r) => ({
        Name: r.Name,
        Before: beforeByIngredient.get(r.IngredientId),
        After: r.CurrentQuantityBase,
        Delta: (r.CurrentQuantityBase - beforeByIngredient.get(r.IngredientId)).toFixed(3)
    })));

    console.log("\n=== Ledger rows for this order ===");
    const txs = await call("GET", `/inventory/transactions?branchId=${branch.BranchId}&limit=20`);
    const orderRows = txs.transactions.filter((t) => t.ReferenceType === "ORDER" && String(t.ReferenceId) === String(order.OrderId));
    console.table(orderRows.map((t) => ({
        Ingredient: t.IngredientName,
        Type: t.TransactionType,
        Qty: `${t.EnteredQuantity}${t.EnteredUnit}`,
        Prior: t.PriorQuantityBase,
        Post: t.PostQuantityBase
    })));

    console.log(`\nDone. View it live: https://tenant-admin-gules.vercel.app/inventory (Transactions tab, filter Order #${order.OrderId})`);

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
