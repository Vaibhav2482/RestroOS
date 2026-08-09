// Full end-to-end exercise of every Inventory Management feature against
// production, through the real HTTP API, for Chai Chakana Company.
// Covers: recipe wiring, automatic consumption, cancellation reversal,
// wastage, manual adjustment, low-stock flagging, valuation, dashboard,
// and transactions pagination/filtering.
//   ADMIN_TOKEN=eyJ... node scripts/inventory-e2e-test.mjs

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

const section = (title) => console.log(`\n\n########## ${title} ##########`);

const run = async () => {

    const branches = await call("GET", "/branches");
    const branch = branches.find((b) => b.IsActive) || branches[0];
    console.log(`Branch: ${branch.BranchName} (#${branch.BranchId})`);

    const ingredients = await call("GET", "/ingredients");
    const byName = new Map(ingredients.map((i) => [i.Name.toLowerCase(), i]));

    // --- Coffee Powder ingredient, for the Coffee recipe below ---
    section("SETUP: Coffee Powder ingredient + opening stock");
    if (!byName.has("coffee powder")) {
        const created = await call("POST", "/ingredients", {
            name: "Coffee Powder", category: "Base", baseUnit: "g", lowStockThreshold: 100, costPerBaseUnit: 1.20
        });
        byName.set("coffee powder", created);
        console.log(`Created Coffee Powder #${created.IngredientId}`);
    }
    await call("POST", "/inventory/opening-stock", {
        branchId: branch.BranchId, ingredientId: byName.get("coffee powder").IngredientId,
        unit: "g", quantity: 1000, notes: "E2E test seed"
    });
    console.log("Opening stock +1000g Coffee Powder recorded.");

    // --- Wire up the rest of the Tea category ---
    section("SETUP: Attach recipes across the Tea category");

    const menu = await call("GET", `/menu?branchId=${branch.BranchId}`);
    const byItemName = new Map(menu.map((m) => [m.ItemName.toLowerCase(), m]));

    const ing = (name) => byName.get(name.toLowerCase()).IngredientId;

    const recipes = {
        "ginger tea": [
            { ingredientId: ing("Tea Leaves"), quantity: 4, unit: "g" },
            { ingredientId: ing("Milk"), quantity: 100, unit: "ml" },
            { ingredientId: ing("Sugar"), quantity: 8, unit: "g" },
            { ingredientId: ing("Ginger"), quantity: 4, unit: "g" },
            { ingredientId: ing("Water"), quantity: 100, unit: "ml" }
        ],
        "irani chai": [
            { ingredientId: ing("Tea Leaves"), quantity: 5, unit: "g" },
            { ingredientId: ing("Milk"), quantity: 150, unit: "ml" },
            { ingredientId: ing("Sugar"), quantity: 10, unit: "g" },
            { ingredientId: ing("Water"), quantity: 80, unit: "ml" }
        ],
        "masala tea": [
            { ingredientId: ing("Tea Leaves"), quantity: 4, unit: "g" },
            { ingredientId: ing("Milk"), quantity: 100, unit: "ml" },
            { ingredientId: ing("Sugar"), quantity: 8, unit: "g" },
            { ingredientId: ing("Ginger"), quantity: 2, unit: "g" },
            { ingredientId: ing("Cardamom"), quantity: 0.5, unit: "g" },
            { ingredientId: ing("Water"), quantity: 100, unit: "ml" }
        ],
        "special tea": [
            { ingredientId: ing("Tea Leaves"), quantity: 6, unit: "g" },
            { ingredientId: ing("Milk"), quantity: 150, unit: "ml" },
            { ingredientId: ing("Sugar"), quantity: 10, unit: "g" },
            { ingredientId: ing("Ginger"), quantity: 3, unit: "g" },
            { ingredientId: ing("Cardamom"), quantity: 0.5, unit: "g" },
            { ingredientId: ing("Water"), quantity: 80, unit: "ml" }
        ],
        "coffee": [
            { ingredientId: ing("Coffee Powder"), quantity: 8, unit: "g" },
            { ingredientId: ing("Milk"), quantity: 150, unit: "ml" },
            { ingredientId: ing("Sugar"), quantity: 8, unit: "g" },
            { ingredientId: ing("Water"), quantity: 50, unit: "ml" }
        ]
    };

    for (const [itemName, lines] of Object.entries(recipes)) {
        const item = byItemName.get(itemName);
        if (!item) { console.log(`- SKIP ${itemName}: not found on menu`); continue; }
        await call("PUT", `/menu-item-recipes/${item.MenuItemId}`, { lines });
        console.log(`- ${item.ItemName} (#${item.MenuItemId}): recipe saved, ${lines.length} lines`);
    }

    const balanceSnapshot = async () => {
        const rows = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
        return new Map(rows.map((r) => [r.IngredientId, r]));
    };

    const walkIn = async (phone, fullName) => call("POST", "/customers/walk-in", { phone, fullName });

    const placeAndPrepare = async (itemName, tableNumber, customerPhone) => {
        const item = byItemName.get(itemName.toLowerCase());
        const customer = await walkIn(customerPhone, `E2E ${itemName}`);
        const order = await call("POST", "/orders", {
            customerId: customer.CustomerId,
            items: [{ menuItemId: item.MenuItemId, quantity: 1, selectedOptionIds: [] }],
            deliveryType: "Dine In", tableNumber, paymentMethod: "Cash", notes: "E2E inventory test"
        });
        const updated = await call("PUT", `/orders/${order.OrderId}/status`, { orderStatus: "Preparing" });
        return updated;
    };

    // --- TEST 1: automatic consumption ---
    section("TEST 1: Automatic consumption (Order -> Preparing)");
    const before1 = await balanceSnapshot();
    const order1 = await placeAndPrepare("Ginger Tea", "E2E-1", "9999999011");
    const after1 = await balanceSnapshot();
    console.log(`Order #${order1.OrderId} (Ginger Tea) -> ${order1.OrderStatus}`);
    for (const [id, row] of after1) {
        const b = before1.get(id)?.CurrentQuantityBase ?? 0;
        if (Number(row.CurrentQuantityBase) !== Number(b)) {
            console.log(`  ${row.Name}: ${b} -> ${row.CurrentQuantityBase} (${(row.CurrentQuantityBase - b).toFixed(3)})`);
        }
    }

    // --- TEST 2: cancellation reversal ---
    section("TEST 2: Cancellation reverses consumption");
    const before2 = await balanceSnapshot();
    const order2 = await placeAndPrepare("Masala Tea", "E2E-2", "9999999012");
    const afterPrepare2 = await balanceSnapshot();
    console.log(`Order #${order2.OrderId} (Masala Tea) -> ${order2.OrderStatus}`);
    for (const [id, row] of afterPrepare2) {
        const b = before2.get(id)?.CurrentQuantityBase ?? 0;
        if (Number(row.CurrentQuantityBase) !== Number(b)) {
            console.log(`  after Preparing: ${row.Name}: ${b} -> ${row.CurrentQuantityBase}`);
        }
    }
    const cancelled = await call("PUT", `/orders/${order2.OrderId}/cancel`, {});
    console.log(`Order #${order2.OrderId} -> ${cancelled.OrderStatus}`);
    const afterCancel2 = await balanceSnapshot();
    for (const [id, row] of afterCancel2) {
        const b = before2.get(id)?.CurrentQuantityBase ?? 0;
        const match = Number(row.CurrentQuantityBase) === Number(b) ? "restored to original" : `DIFF: now ${row.CurrentQuantityBase}, was ${b}`;
        if (afterPrepare2.get(id) && Number(afterPrepare2.get(id).CurrentQuantityBase) !== Number(b)) {
            console.log(`  after cancel: ${row.Name}: ${match}`);
        }
    }

    // --- TEST 3: wastage ---
    section("TEST 3: Wastage recording");
    const teaLeaves = byName.get("tea leaves");
    const wastageTx = await call("POST", "/inventory/wastage", {
        branchId: branch.BranchId, ingredientId: teaLeaves.IngredientId,
        unit: "g", quantity: 50, reason: "Spilled during prep", notes: "E2E test"
    });
    console.log(`Wastage: Tea Leaves ${wastageTx.PriorQuantityBase} -> ${wastageTx.PostQuantityBase}g`);

    // --- TEST 4: manual adjustment (stock count) ---
    section("TEST 4: Manual adjustment (physical stock count)");
    const milk = byName.get("milk");
    const milkBalanceBefore = (await balanceSnapshot()).get(milk.IngredientId).CurrentQuantityBase;
    const physicalCount = Number(milkBalanceBefore) - 200; // staff found 200ml less than system expects
    const adjustTx = await call("POST", "/inventory/adjustment", {
        branchId: branch.BranchId, ingredientId: milk.IngredientId,
        unit: "ml", physicalQuantity: physicalCount, reason: "Physical stock count", notes: "E2E test"
    });
    console.log(`Adjustment: Milk ${adjustTx.PriorQuantityBase} -> ${adjustTx.PostQuantityBase}ml (physical count ${physicalCount}ml)`);

    // --- TEST 5: low stock threshold ---
    section("TEST 5: Low stock threshold flagging");
    const cardamom = byName.get("cardamom");
    const cardamomBalance = (await balanceSnapshot()).get(cardamom.IngredientId).CurrentQuantityBase;
    const wasteAmount = Number(cardamomBalance) - 15; // push below its 20g threshold, down to 15g
    await call("POST", "/inventory/wastage", {
        branchId: branch.BranchId, ingredientId: cardamom.IngredientId,
        unit: "g", quantity: wasteAmount, reason: "E2E: force low-stock state", notes: "E2E test"
    });
    const stockAfter = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
    const cardamomRow = stockAfter.find((r) => r.IngredientId === cardamom.IngredientId);
    const isLow = cardamomRow.LowStockThreshold !== null && Number(cardamomRow.CurrentQuantityBase) <= Number(cardamomRow.LowStockThreshold);
    console.log(`Cardamom: balance ${cardamomRow.CurrentQuantityBase}g, threshold ${cardamomRow.LowStockThreshold}g -> Low Stock: ${isLow}`);

    // --- TEST 6: valuation report ---
    section("TEST 6: Valuation report");
    const valuation = await call("GET", `/inventory/valuation?branchId=${branch.BranchId}`);
    console.table(valuation.items.map((i) => ({ Name: i.Name, Balance: i.CurrentQuantityBase, Cost: i.CostPerBaseUnit, StockValue: i.StockValue })));
    console.log(`Total stock value: Rs.${valuation.totalValue.toFixed(2)} (${valuation.ingredientsMissingCost} ingredients missing cost)`);

    // --- TEST 7: dashboard summary ---
    section("TEST 7: Dashboard summary");
    const dashboard = await call("GET", `/inventory/dashboard?branchId=${branch.BranchId}`);
    console.log(dashboard);

    // --- TEST 8: transactions pagination + filtering ---
    section("TEST 8: Transactions pagination + filtering");
    const page0 = await call("GET", `/inventory/transactions?branchId=${branch.BranchId}&page=0&limit=5`);
    console.log(`Page 0 (limit 5): ${page0.transactions.length} rows, totalCount=${page0.totalCount}`);
    const page1 = await call("GET", `/inventory/transactions?branchId=${branch.BranchId}&page=1&limit=5`);
    console.log(`Page 1 (limit 5): ${page1.transactions.length} rows, first row id=${page1.transactions[0]?.TransactionId}`);
    const wastageOnly = await call("GET", `/inventory/transactions?branchId=${branch.BranchId}&transactionType=WASTAGE&limit=20`);
    console.log(`Filtered WASTAGE only: ${wastageOnly.totalCount} total rows`);
    const reversalOnly = await call("GET", `/inventory/transactions?branchId=${branch.BranchId}&transactionType=REVERSAL&limit=20`);
    console.log(`Filtered REVERSAL only: ${reversalOnly.totalCount} total rows`);

    console.log("\n\nAll 8 inventory feature tests completed against production.");

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
