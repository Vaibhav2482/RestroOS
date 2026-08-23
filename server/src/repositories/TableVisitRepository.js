import pool from "../config/db.js";

// A table's current dining session, spanning every round (Order/KOT) placed
// while it's occupied. See migration 0024_table_visits for why this exists
// separately from Order: the kitchen needs each round as its own ticket
// (so adding a sweet doesn't re-print the tea and toast), but the guest
// expects one consolidated bill for the whole visit. Order stays the
// kitchen/ticket unit; TableVisit is the billing unit.

// Called from inside OrderRepository.createOrder's own transaction (hence
// the passed-in client, not the pool) - a new Dine In order always attaches
// to the table's current Open visit, creating one if this is the table's
// first round. FOR UPDATE on the SELECT is what serializes two concurrent
// "first round at this table" requests against each other; the partial
// unique index (one Open visit per table) is the backstop if they still
// race past that, handled below by catching the constraint violation and
// re-reading rather than failing the order.
// guestCount is only ever applied on the INSERT branch below - once a
// visit already exists, its guest count was already set on the table's
// first round and later rounds don't get to silently change it (adjusting
// it, if ever needed, is a deliberate action on the visit itself, not a
// side effect of ordering more food).
export const resolveOpenVisitId = async (client, branchId, tableNumber, guestCount = null) => {

    const existing = await client.query(
        `SELECT "VisitId" FROM "TableVisits" WHERE "BranchId" = $1 AND "TableNumber" = $2 AND "Status" = 'Open' FOR UPDATE`,
        [branchId, tableNumber]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].VisitId;
    }

    try {

        const created = await client.query(
            `INSERT INTO "TableVisits" ("BranchId", "TableNumber", "Status", "GuestCount") VALUES ($1, $2, 'Open', $3) RETURNING "VisitId"`,
            [branchId, tableNumber, guestCount]
        );

        return created.rows[0].VisitId;

    } catch (error) {

        // 23505 = unique_violation - another request opened this table's
        // visit a moment ago. Re-read instead of failing the order.
        if (error.code !== "23505") {
            throw error;
        }

        const retry = await client.query(
            `SELECT "VisitId" FROM "TableVisits" WHERE "BranchId" = $1 AND "TableNumber" = $2 AND "Status" = 'Open'`,
            [branchId, tableNumber]
        );

        return retry.rows[0]?.VisitId ?? null;

    }

};

export const getOpenVisitForTable = async (branchId, tableNumber) => {

    const result = await pool.query(
        `SELECT "VisitId", "BranchId", "TableNumber", "Status", "OpenedAt", "GuestCount"
         FROM "TableVisits"
         WHERE "BranchId" = $1 AND "TableNumber" = $2 AND "Status" = 'Open'`,
        [branchId, tableNumber]
    );

    return result.rows[0] ?? null;

};

// Visit header + totals summed across every non-cancelled order under it.
// Deliberately sums each order's own already-computed SubTotal/tax/total
// rather than re-deriving tax from consolidated items - each round already
// taxed its own items correctly at creation time (see
// OrderRepository.computeOrderTax), so summing what was already validly
// charged per round is both simpler and exactly as correct as recomputing.
export const getVisitHeader = async (visitId) => {

    const result = await pool.query(
        `SELECT V."VisitId", V."BranchId", V."TableNumber", V."Status", V."OpenedAt", V."ClosedAt", V."PaymentMethod", V."GuestCount",
                B."BranchName", B."TenantId",
                COALESCE(SUM(O."SubTotal"), 0) AS "SubTotal",
                COALESCE(SUM(O."CgstAmount"), 0) AS "CgstAmount",
                COALESCE(SUM(O."SgstAmount"), 0) AS "SgstAmount",
                COALESCE(SUM(O."DiscountAmount"), 0) AS "DiscountAmount",
                COALESCE(SUM(O."TotalAmount"), 0) AS "TotalAmount",
                COUNT(O."OrderId") AS "OrderCount"
         FROM "TableVisits" V
         INNER JOIN "Branches" B ON V."BranchId" = B."BranchId"
         LEFT JOIN "Orders" O ON O."VisitId" = V."VisitId" AND O."OrderStatus" != 'Cancelled'
         WHERE V."VisitId" = $1
         GROUP BY V."VisitId", B."BranchName", B."TenantId"`,
        [visitId]
    );

    return result.rows[0] ?? null;

};

// Every round's items merged into one list for the bill (two separate
// "Tea x1" rounds read as one "Tea x2" line) - this is a display
// convenience only, the financial totals above are summed per-order, not
// re-derived from this consolidated view.
export const getVisitConsolidatedItems = async (visitId) => {

    const result = await pool.query(
        `SELECT OI."MenuItemId", OI."ItemName", OI."Price", COALESCE(OI."SelectedOptions", '[]'::jsonb) AS "SelectedOptions",
                SUM(OI."Quantity")::int AS "Quantity", SUM(OI."TotalPrice") AS "TotalPrice",
                MIN(OI."OrderItemId") AS "FirstOrderItemId"
         FROM "OrderItems" OI
         INNER JOIN "Orders" O ON OI."OrderId" = O."OrderId"
         WHERE O."VisitId" = $1 AND O."OrderStatus" != 'Cancelled'
         -- NULL and '[]' both mean "no options selected" (older rows stored
         -- NULL, newer ones store '[]') - grouping raw SelectedOptions treats
         -- those as two different items, splitting "Tea x2" back into two
         -- separate "Tea x1" lines depending on which round wrote which
         -- representation. Coalescing before grouping is what actually
         -- consolidates them.
         GROUP BY OI."MenuItemId", OI."ItemName", OI."Price", COALESCE(OI."SelectedOptions", '[]'::jsonb)
         ORDER BY "FirstOrderItemId" ASC`,
        [visitId]
    );

    return result.rows;

};

// The individual rounds themselves (each still its own Order/KOT) - shown
// alongside the consolidated bill so staff can see what was ordered when,
// and reachable for a KOT reprint if needed.
export const getVisitOrders = async (visitId) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."OrderStatus", O."OrderDate", O."SubTotal", O."TotalAmount", A."FullName" AS "CreatedByAdminName"
         FROM "Orders" O
         LEFT JOIN "Admins" A ON O."CreatedByAdminId" = A."AdminId"
         WHERE O."VisitId" = $1 AND O."OrderStatus" != 'Cancelled'
         ORDER BY O."OrderDate" ASC`,
        [visitId]
    );

    return result.rows;

};

// Lets staff set/correct the guest count on an already-open visit (e.g. it
// was skipped when the table was first seated, or two more guests joined
// mid-meal) - deliberately its own explicit action rather than something
// that happens implicitly off a later round's order.
export const updateGuestCount = async (visitId, guestCount) => {

    const result = await pool.query(
        `UPDATE "TableVisits" SET "GuestCount" = $2 WHERE "VisitId" = $1 AND "Status" = 'Open' RETURNING "VisitId"`,
        [visitId, guestCount]
    );

    return result.rows[0] ?? null;

};

// Closes the visit (freeing the table on the floor grid) and stamps the
// single payment that settles everything ordered across every round. Locks
// the visit row first so two captains tapping "Settle Bill" at the same
// moment can't both succeed - the second sees Status already 'Closed' and
// is rejected instead of double-settling.
export const settleVisit = async (visitId, { paymentMethod, adminId }) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const visitResult = await client.query(
            `SELECT "VisitId", "Status" FROM "TableVisits" WHERE "VisitId" = $1 FOR UPDATE`,
            [visitId]
        );

        if (visitResult.rows.length === 0) {
            throw new Error("Table visit not found.");
        }

        if (visitResult.rows[0].Status !== "Open") {
            throw new Error("This table's bill has already been settled.");
        }

        const orderCountResult = await client.query(
            `SELECT COUNT(*)::int AS "count" FROM "Orders" WHERE "VisitId" = $1 AND "OrderStatus" != 'Cancelled'`,
            [visitId]
        );

        if (orderCountResult.rows[0].count === 0) {
            throw new Error("This table has no orders to settle.");
        }

        await client.query(
            `UPDATE "TableVisits" SET "Status" = 'Closed', "ClosedAt" = NOW(), "PaymentMethod" = $2, "ClosedByAdminId" = $3 WHERE "VisitId" = $1`,
            [visitId, paymentMethod, adminId ?? null]
        );

        await client.query("COMMIT");

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

    return getVisitHeader(visitId);

};
