// Reproduction: moving an order straight to "Ready" (a legal forward jump)
// skips the consumption hook, which only fires on exactly "Preparing".
//   ADMIN_TOKEN=eyJ... node scripts/repro-ready-skips-consumption.mjs

const BASE = "https://restroos-api.vercel.app/api/v1";
const TOKEN = process.env.ADMIN_TOKEN;

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

const run = async () => {

    const branch = (await call("GET", "/branches")).find((b) => b.IsActive);
    const menu = await call("GET", `/menu?branchId=${branch.BranchId}`);
    const item = menu.find((m) => m.ItemName === "Garam Tea");

    const recipe = await call("GET", `/menu-item-recipes/${item.MenuItemId}`);
    const tracked = recipe.map((r) => r.IngredientId);

    const balances = async () => {
        const rows = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
        return new Map(rows.filter((r) => tracked.includes(r.IngredientId))
            .map((r) => [r.Name, Number(r.CurrentQuantityBase)]));
    };

    const customer = await call("POST", "/customers/walk-in", {
        phone: "9999999031", fullName: "Repro Ready Skip"
    });

    for (const path of [["Preparing"], ["Ready"]]) {

        const label = path.join(" -> ");
        const before = await balances();

        const order = await call("POST", "/orders", {
            customerId: customer.CustomerId,
            items: [{ menuItemId: item.MenuItemId, quantity: 1, selectedOptionIds: [] }],
            deliveryType: "Dine In", tableNumber: "REPRO", paymentMethod: "Cash",
            notes: `Repro: jump straight to ${label}`
        });

        for (const status of path) {
            await call("PUT", `/orders/${order.OrderId}/status`, { orderStatus: status });
        }

        const after = await balances();

        const moved = [...after.entries()].filter(([name, qty]) => qty !== before.get(name));

        console.log(`\nOrder #${order.OrderId} — Pending -> ${label}`);
        console.log(`  ingredients that changed: ${moved.length} of ${tracked.length}`);
        moved.forEach(([name, qty]) => console.log(`    ${name}: ${before.get(name)} -> ${qty}`));

        const txs = await call("GET", `/inventory/transactions?branchId=${branch.BranchId}&limit=50`);
        const rows = txs.transactions.filter((t) => String(t.ReferenceId) === String(order.OrderId));
        console.log(`  ledger rows written: ${rows.length}`);
        console.log(moved.length === 0 ? "  >>> STOCK DID NOT DEDUCT" : "  stock deducted correctly");

    }

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
