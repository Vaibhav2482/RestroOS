// Brings negative ingredient balances back to zero by recording a physical
// stock count, which writes an ADJUSTMENT row rather than editing history.
//
// Zero is used deliberately: a negative balance is provably fiction (you
// cannot hold -123,300 ml of milk), and zero is the only value that isn't
// invented. Record real opening stock afterwards from an actual count.
//
//   ADMIN_TOKEN=eyJ... node scripts/reset-negative-stock.mjs          (dry run)
//   ADMIN_TOKEN=eyJ... APPLY=1 node scripts/reset-negative-stock.mjs  (apply)

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

const run = async () => {

    const branch = (await call("GET", "/branches")).find((b) => b.IsActive);
    const stock = await call("GET", `/inventory/branch-stock?branchId=${branch.BranchId}`);
    const negative = stock.filter((r) => Number(r.CurrentQuantityBase) < 0);

    console.log(`Branch: ${branch.BranchName} (#${branch.BranchId})`);
    console.log(`Ingredients with a negative balance: ${negative.length}\n`);

    negative.forEach((r) => console.log(`  ${r.Name.padEnd(22)} ${String(Number(r.CurrentQuantityBase)).padStart(12)} ${r.BaseUnit}`));

    if (negative.length === 0) {
        console.log("\nNothing to correct.");
        return;
    }

    if (!APPLY) {
        console.log("\nDRY RUN - nothing changed. Re-run with APPLY=1 to reset these to zero.");
        return;
    }

    console.log("\n--- recording stock counts ---");

    for (const row of negative) {
        try {
            const tx = await call("POST", "/inventory/adjustment", {
                branchId: branch.BranchId,
                ingredientId: row.IngredientId,
                unit: row.BaseUnit,
                physicalQuantity: 0,
                reason: "Physical stock count",
                notes: "Reset to zero after development test data corrupted the balance"
            });
            console.log(`  ${row.Name.padEnd(22)} ${tx.PriorQuantityBase} -> ${tx.PostQuantityBase} ${row.BaseUnit}`);
        } catch (error) {
            console.log(`  ${row.Name.padEnd(22)} FAILED: ${error.message}`);
        }
    }

    const after = await call("GET", `/inventory/valuation?branchId=${branch.BranchId}`);
    console.log(`\nStock value now      : Rs.${after.totalValue.toFixed(2)}`);
    console.log(`Still negative       : ${after.ingredientsBelowZero}`);
    console.log("\nNext: record real opening stock from a physical count of the shop.");

};

run().catch((error) => {
    console.error("FAILED:", error.message);
    process.exit(1);
});
