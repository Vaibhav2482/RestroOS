# Inventory Management

How ingredient stock is tracked, deducted, and audited in RestroOS.

## The core idea: an append-only ledger

Nothing in this system overwrites a stock number. Every event — a delivery, wastage, a physical count, an order hitting the kitchen — is written as its own row in `InventoryTransactions`, and the running balance in `BranchInventory` is always just the sum of that history, kept in sync in the same database write. Nothing is ever edited or deleted; a cancelled order that already consumed stock gets an offsetting `REVERSAL` row, not an erased deduction.

## Data model

Schema lives in `server/src/config/migrations.js` (migrations `0001`–`0004`, `0007`), not in a `.sql` file — a prior version read `database/migrations/*.sql` at runtime, which Vercel's serverless bundler doesn't trace, so migrations are plain JS template strings now.

- **`Units`** — fixed reference data, seeded once: `g`(1)/`kg`(1000) Weight, `ml`(1)/`l`(1000) Volume, `pc`(1) Count. `ToBaseFactor` converts within a `UnitType`.
- **`Ingredients`** — tenant-wide (`TenantId`, `Name`, `SKU`, `Category`, `BaseUnit`, `LowStockThreshold`, `CostPerBaseUnit`, `IsActive`). `UQ_Ingredients_Tenant_Name` unique constraint. `BaseUnit` is immutable after creation — changing it would corrupt every historical `QuantityBase` already in the ledger, enforced in `IngredientService.updateIngredient` and mirrored by a disabled dropdown in `IngredientDialog.jsx`.
- **`BranchInventory`** — the running balance, one row per `(BranchId, IngredientId)`, `CurrentQuantityBase` in the ingredient's base unit. Never written directly.
- **`InventoryTransactions`** — the ledger. `TransactionType` is one of `OPENING_STOCK, PURCHASE, CONSUMPTION, WASTAGE, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT, REVERSAL` (checked via a `CHECK` constraint; `PURCHASE`/`TRANSFER_IN`/`TRANSFER_OUT` are defined but no code path currently writes them). Carries `QuantityBase` (signed), `EnteredUnit`/`EnteredQuantity` (what staff actually typed), `PriorQuantityBase`/`PostQuantityBase`, `ActorType` (`User`/`System`) + `ActorAdminId`, `ReferenceType`/`ReferenceId` (e.g. `"ORDER"`/224), and `ReversalOfTransactionId` (self-FK).
- **`MenuItemRecipes`** — `(MenuItemId, IngredientId)` unique, `Quantity` + `Unit` per serving. `ON DELETE CASCADE` from `MenuItems`.

## Units & conversion

`InventoryService.convertToIngredientBase` (server) and `utils/units.js convertToBase`/`compatibleUnits` (client, mirrored exactly) only permit converting within the same `UnitType` as the ingredient's `BaseUnit` — a Volume quantity can never be entered against a Weight-tracked ingredient. The unit dropdown doesn't even offer an incompatible unit; the API rejects it outright as a second line of defense.

## Recording stock (manual actions)

All three below share one shape in `InventoryService.js`: validate branch/ingredient belong to the tenant → convert entered unit+quantity to the ingredient's base unit → open a DB transaction → read prior balance → `InventoryRepository.recordTransaction` (the single ledger-write function, used by every transaction type in the system) → commit.

- **`recordOpeningStock`** — requires `quantity > 0`. Posts `OPENING_STOCK`, positive `quantityBase`.
- **`recordWastage`** — requires `quantity > 0` **and** a non-empty `reason`. Posts `WASTAGE`, `quantityBase = -Math.abs(...)`.
- **`recordAdjustment`** — staff enters the **physical count taken**, not a delta. Requires `physicalQuantity >= 0` and `reason`. Server computes `delta = physicalBase - priorBalance`; `delta === 0` is rejected ("Physical quantity matches system stock — no adjustment needed"). Posts `ADJUSTMENT_IN` or `ADJUSTMENT_OUT` with `quantityBase = delta`. The client (`StockActionDialog.jsx`) live-previews this delta before submit via `convertToBase`.

`InventoryRepository.recordTransaction` is the one write path for every ledger entry in the system — it always runs inside a caller-supplied, already-open transaction `client` (never the shared `pool` directly), and does two things atomically: `INSERT` into `InventoryTransactions`, then upsert `BranchInventory` via `ON CONFLICT (BranchId, IngredientId) DO UPDATE SET CurrentQuantityBase = CurrentQuantityBase + $delta`.

## Automatic consumption

Wired from `OrderService.updateOrderStatus`, inside the *same* DB transaction and row lock as the `OrderStatus` write:

```js
const updatedOrder = await OrderRepository.updateOrderStatus(id, orderStatus, async (client, order) => {
    if (order.OrderStatus === "Preparing") {
        await InventoryService.consumeForOrder(client, order.OrderId, order.BranchId);
    }
});
```

`InventoryService.consumeForOrder(client, orderId, branchId)`:
1. Idempotency guard first — `hasTransactionForReference(client, "ORDER", orderId, "CONSUMPTION")` runs `SELECT ... FOR UPDATE` under the same lock, so a duplicated/retried status update can't double-consume.
2. Joins `OrderItems` → `MenuItemRecipes` → `Ingredients` for the order. Items with no recipe row simply don't join — they consume nothing and don't block the sale.
3. Converts each line's `RecipeQuantity × OrderQuantity` to the ingredient's base unit, aggregated by ingredient across the whole order.
4. Writes one `CONSUMPTION` row per ingredient (negative `quantityBase`).
5. **Negative stock is allowed by design** — no floor check. It's exactly what the dashboard's `OutOfStock` count surfaces; nothing here blocks the sale.

Reversal (`InventoryService.reverseConsumptionForOrder`), wired the same way from `OrderService.cancelOrder`, no-ops if nothing was consumed, otherwise credits back every matching `CONSUMPTION` row as a new `REVERSAL` row referencing it via `ReversalOfTransactionId` — the original is never touched. Staff can cancel through `Preparing` (`STAFF_CANCELLABLE_STATUSES`); customers only through `Pending`/`Accepted`.

## Screens

| Screen | Shows | Scope |
|---|---|---|
| Dashboard (`Inventory.jsx` tab 0) | Active ingredients, out-of-stock/low-stock counts, 30-day wastage, last 10 movements | Per branch |
| Ingredients (tab 1) | Full catalog + cost; add/edit | Tenant-wide |
| Branch Stock (tab 2) | Current balance + status chip; row menu opens the 3 recording actions | Per branch |
| Transactions (tab 3) | Full ledger, filterable by ingredient/type/date (server caps at 200 rows; pagination is client-side over that) | Per branch |
| Inventory Valuation (`Reports.jsx` tab 6, not the Inventory page) | Stock-on-hand value at cost; flags ingredients missing a cost instead of treating them as free | Per branch |

## Permissions

| Permission | Covers | Default for new Branch Admins |
|---|---|---|
| `manage_inventory` | Branch Stock actions, Transactions, Dashboard | Granted (core) |
| `manage_ingredients` | Create/edit ingredients, edit recipes | Owner must grant |
| `view_reports` | Inventory Valuation tab | Owner must grant |

Owner always has every permission implicitly. `resolveBranchId` forces a Branch Admin to their own branch regardless of what's in the request; an Owner picks via `branchId`.

## API reference

```
GET  /ingredients                    PUT  /ingredients/:id
POST /ingredients
GET  /inventory/dashboard            GET  /inventory/branch-stock
GET  /inventory/transactions         GET  /inventory/valuation
POST /inventory/opening-stock        POST /inventory/wastage
POST /inventory/adjustment
GET  /menu-item-recipes/:menuItemId  PUT  /menu-item-recipes/:menuItemId
```

## Verification

- **Backend logic**: `npx vitest run src/services/InventoryService.test.js src/services/IngredientService.test.js src/services/MenuItemRecipeService.test.js` — 27/27 passing, mocked repositories, no database. Covers unit conversion, opening stock, wastage, adjustment-delta math, consumption idempotency, reversal idempotency.
- **UI**: live Playwright walkthrough against a mocked network (no production data touched) — dashboard stats, branch-stock status chips, wastage form's client-side reason validation (confirmed zero network requests fire without one), the adjustment delta preview (12,000 ml balance, 10 ml counted → −11,990 ml shown pre-submit, correct unit conversion), and balance updates reflecting immediately in the row after each action.

A rendered version of this document (with diagrams) was also published as a Claude artifact.
