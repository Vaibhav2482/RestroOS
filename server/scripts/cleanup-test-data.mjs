// Identifies and (with APPLY=1) cancels the test orders created during
// development, then reports resulting stock. Cancelling writes REVERSAL rows
// crediting ingredients back - it never edits or deletes history.
//   ADMIN_TOKEN=eyJ... node scripts/cleanup-test-data.mjs          (dry run)
//   ADMIN_TOKEN=eyJ... APPLY=1 node scripts/cleanup-test-data.mjs  (apply)

const BASE = "https://restroos-api.vercel.app/api/v1";
const TOKEN = process.env.ADMIN_TOKEN;
const APPLY = process.env.APPLY === "1";

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

// Deliberately narrow: only customers the dev scripts created by name. A
// bare "Walk-in Guest" is NOT matched - real counter orders use that too,
// and cancelling a genuine sale would be far worse than leaving noise.
const TEST_CUSTOMER = /^(Verify |E2E |Repro |Inventory Demo Customer)/i;

const OPEN = ["Pending", "Accepted", "Preparing", "Ready", "Out For Delivery"];

const run = async () => {

    const branch = (await call("GET", "/branches")).find((b) => b.IsActive);
    const orders = await call("GET", "/orders");

    const suspects = orders.filter((o) => TEST_CUSTOMER.test(o.CustomerName || ""));
    const open = suspects.filter((o) => OPEN.includes(o.OrderStatus));
    const closed = suspects.filter((o) => !OPEN.includes(o.OrderStatus));

    console.log(`Total orders on tenant : ${orders.length}`);
    console.log(`Matched as test data   : ${suspects.length}`);
    console.log(`  still open (cancel)  : ${open.length}`);
    console.log(`  already terminal     : ${closed.length}`);

    console.log("\n--- open test orders ---");
    open.forEach((o) => console.log(`  #${o.OrderId}  ${o.OrderStatus.padEnd(10)} Rs.${Number(o.TotalAmount).toFixed(2).padStart(10)}  ${o.CustomerName}`));

    const openValue = open.reduce((s, o) => s + Number(o.TotalAmount || 0), 0);
    const closedValue = closed.filter((o) => o.OrderStatus !== "Cancelled")
        .reduce((s, o) => s + Number(o.TotalAmount || 0), 0);

    console.log(`\nRevenue currently inflated by open test orders    : Rs.${openValue.toFixed(2)}`);
    console.log(`Already-delivered test orders still counting       : Rs.${closedValue.toFixed(2)}`);

    if (!APPLY) {
        console.log("\nDRY RUN - nothing changed. Re-run with APPLY=1 to cancel the open ones.");
        return;
    }

    console.log("\n--- cancelling ---");
    for (const order of open) {
        try {
            await call("PUT", `/orders/${order.OrderId}/cancel`, {});
            console.log(`  #${order.OrderId} cancelled (stock credited back via REVERSAL)`);
        } catch (error) {
            console.log(`  #${order.OrderId} FAILED: ${error.message}`);
        }
    }

    const stock = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
    const negative = stock.filter((r) => Number(r.CurrentQuantityBase) < 0);

    console.log(`\n--- stock after cancellation ---`);
    console.log(`ingredients still negative: ${negative.length}`);
    negative.forEach((r) => console.log(`  ${r.Name.padEnd(22)} ${Number(r.CurrentQuantityBase).toFixed(2)} ${r.BaseUnit}`));

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
