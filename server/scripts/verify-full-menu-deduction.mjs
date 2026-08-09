// Verifies automatic deduction fires correctly for newly-mapped items across
// every unit type (pc / kg / g / ml), including multi-quantity orders and
// cross-unit conversion (recipe in kg against a g-based balance).
//   ADMIN_TOKEN=eyJ... node scripts/verify-full-menu-deduction.mjs

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

// Chosen to cover distinct unit paths:
//   Sandwich       -> Bread Slice in "pc"
//   Paneer Momo    -> Paneer recipe line in "kg" against a kg base
//   Veg Fried Rice -> Rice in "kg", quantity 2 (multiplier check)
//   Tomato Soup    -> g + ml mix
const CASES = [
    { item: "Sandwich", quantity: 1, table: "V-1", phone: "9999999021" },
    { item: "Paneer Momo", quantity: 1, table: "V-2", phone: "9999999022" },
    { item: "Veg Fried Rice", quantity: 2, table: "V-3", phone: "9999999023" },
    { item: "Tomato Soup", quantity: 1, table: "V-4", phone: "9999999024" }
];

const run = async () => {

    const branches = await call("GET", "/branches");
    const branch = branches.find((b) => b.IsActive) || branches[0];

    const menu = await call("GET", `/menu?branchId=${branch.BranchId}`);
    const byItemName = new Map(menu.map((m) => [m.ItemName.toLowerCase(), m]));

    const snapshot = async () => {
        const rows = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
        return new Map(rows.map((r) => [r.IngredientId, r]));
    };

    const orderIds = [];

    for (const testCase of CASES) {

        const item = byItemName.get(testCase.item.toLowerCase());

        console.log(`\n##### ${testCase.item} x${testCase.quantity} #####`);

        const recipe = await call("GET", `/menu-item-recipes/${item.MenuItemId}`);
        console.log("Recipe per serving:", recipe.map((r) => `${r.Quantity}${r.Unit} ${r.IngredientName}`).join(", "));

        const before = await snapshot();

        const customer = await call("POST", "/customers/walk-in", {
            phone: testCase.phone, fullName: `Verify ${testCase.item}`
        });

        const order = await call("POST", "/orders", {
            customerId: customer.CustomerId,
            items: [{ menuItemId: item.MenuItemId, quantity: testCase.quantity, selectedOptionIds: [] }],
            deliveryType: "Dine In", tableNumber: testCase.table,
            paymentMethod: "Cash", notes: "Full-menu deduction verification"
        });

        await call("PUT", `/orders/${order.OrderId}/status`, { orderStatus: "Preparing" });
        orderIds.push(order.OrderId);

        const after = await snapshot();

        const rows = [];
        for (const [id, row] of after) {
            const priorQuantity = Number(before.get(id)?.CurrentQuantityBase ?? 0);
            const currentQuantity = Number(row.CurrentQuantityBase);
            if (priorQuantity !== currentQuantity) {
                const expectedLine = recipe.find((r) => r.IngredientId === id);
                rows.push({
                    Ingredient: row.Name,
                    Before: priorQuantity,
                    After: currentQuantity,
                    Deducted: (priorQuantity - currentQuantity).toFixed(3),
                    RecipeLine: expectedLine ? `${expectedLine.Quantity}${expectedLine.Unit} x${testCase.quantity}` : "?"
                });
            }
        }

        console.log(`Order #${order.OrderId} -> Preparing`);
        console.table(rows);

    }

    console.log("\n##### Ledger rows for these verification orders #####");
    const txs = await call("GET", `/inventory/transactions?branchId=${branch.BranchId}&transactionType=CONSUMPTION&limit=100`);
    const relevant = txs.transactions.filter((t) => orderIds.includes(Number(t.ReferenceId)));
    console.log(`${relevant.length} CONSUMPTION rows written across orders ${orderIds.join(", ")}`);

    console.log("\n##### Post-run dashboard #####");
    const dashboard = await call("GET", `/inventory/dashboard?branchId=${branch.BranchId}`);
    console.log({
        ActiveIngredients: dashboard.ActiveIngredients,
        OutOfStock: dashboard.OutOfStock,
        LowStock: dashboard.LowStock,
        wastage30Days: dashboard.wastage30Days
    });

    const valuation = await call("GET", `/inventory/valuation?branchId=${branch.BranchId}`);
    console.log(`Total stock value: Rs.${valuation.totalValue.toFixed(2)} across ${valuation.items.length} ingredients (${valuation.ingredientsMissingCost} missing cost)`);

    console.log(`\nVerification orders created: ${orderIds.join(", ")}`);

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
