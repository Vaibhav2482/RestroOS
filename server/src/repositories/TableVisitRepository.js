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
export const resolveOpenVisitId = async (client, branchId, tableNumber) => {

    const existing = await client.query(
        `SELECT "VisitId" FROM "TableVisits" WHERE "BranchId" = $1 AND "TableNumber" = $2 AND "Status" = 'Open' FOR UPDATE`,
        [branchId, tableNumber]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].VisitId;
    }

    try {

        const created = await client.query(
            `INSERT INTO "TableVisits" ("BranchId", "TableNumber", "Status") VALUES ($1, $2, 'Open') RETURNING "VisitId"`,
            [branchId, tableNumber]
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
        `SELECT "VisitId", "BranchId", "TableNumber", "Status", "OpenedAt"
         FROM "TableVisits"
         WHERE "BranchId" = $1 AND "TableNumber" = $2 AND "Status" = 'Open'`,
        [branchId, tableNumber]
    );

    return result.rows[0] ?? null;

};

// Every billing query below resolves $1 to its merge "group" first - the
// root visit (the one nothing points away from) plus every other visit
// merged into it (see migration 0039_table_visit_merge). Passing in EITHER
// the root's own VisitId or any merged-in child's VisitId returns the same
// group, which is what lets a captain open Settle Bill from whichever
// table's card they clicked and still land on the whole party's combined
// bill. A visit that was never merged is a group of exactly one - itself -
// so every one of these behaves exactly as it always did for that case.
const GROUP_VISITS_CTE = `
    WITH root AS (
        SELECT COALESCE((SELECT "MergedIntoVisitId" FROM "TableVisits" WHERE "VisitId" = $1), $1) AS "RootVisitId"
    ),
    group_visits AS (
        SELECT "VisitId", "TableNumber" FROM "TableVisits", root
        WHERE "VisitId" = root."RootVisitId" OR "MergedIntoVisitId" = root."RootVisitId"
    )
`;

// Visit header + totals summed across every non-cancelled order under the
// WHOLE merge group. Deliberately sums each order's own already-computed
// SubTotal/tax/total rather than re-deriving tax from consolidated items -
// each round already taxed its own items correctly at creation time (see
// OrderRepository.computeOrderTax), so summing what was already validly
// charged per round is both simpler and exactly as correct as recomputing.
// "DiscountAmount"/"TotalAmount" here are the same order-summed, invoiced
// figures they've always been (a coupon discount, tax-correct per round) -
// V."DiscountAmount" is the SEPARATE settlement-time bill discount (see
// migration 0037_table_visit_discount), aliased "BillDiscountAmount" to
// avoid colliding with that name, with "AmountDue" as the actual amount
// collected (TotalAmount minus the bill discount). "MergedVisits" is every
// table in the group (including the root itself) - a single-entry array
// for an ordinary, unmerged visit - so the UI can show "Table A + B" and
// offer to unmerge a specific one without a second round trip.
export const getVisitHeader = async (visitId) => {

    const result = await pool.query(
        `${GROUP_VISITS_CTE}
         SELECT V."VisitId", V."BranchId", V."TableNumber", V."Status", V."OpenedAt", V."ClosedAt", V."PaymentMethod",
                V."DiscountAmount" AS "BillDiscountAmount", V."DiscountReason" AS "BillDiscountReason",
                BA."FullName" AS "BillDiscountByAdminName",
                B."BranchName", B."TenantId",
                (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('VisitId', "VisitId", 'TableNumber', "TableNumber") ORDER BY "TableNumber"), '[]') FROM group_visits) AS "MergedVisits",
                COALESCE(SUM(O."SubTotal"), 0) AS "SubTotal",
                COALESCE(SUM(O."CgstAmount"), 0) AS "CgstAmount",
                COALESCE(SUM(O."SgstAmount"), 0) AS "SgstAmount",
                COALESCE(SUM(O."DiscountAmount"), 0) AS "DiscountAmount",
                COALESCE(SUM(O."TotalAmount"), 0) AS "TotalAmount",
                COALESCE(SUM(O."TotalAmount"), 0) - V."DiscountAmount" AS "AmountDue",
                COUNT(O."OrderId") AS "OrderCount"
         FROM root
         INNER JOIN "TableVisits" V ON V."VisitId" = root."RootVisitId"
         INNER JOIN "Branches" B ON V."BranchId" = B."BranchId"
         LEFT JOIN "Admins" BA ON BA."AdminId" = V."DiscountByAdminId"
         LEFT JOIN "Orders" O ON O."VisitId" IN (SELECT "VisitId" FROM group_visits) AND O."OrderStatus" != 'Cancelled'
         GROUP BY V."VisitId", BA."FullName", B."BranchName", B."TenantId"`,
        [visitId]
    );

    return result.rows[0] ?? null;

};

// Every round's items across the whole merge group, merged into one list
// for the bill (two separate "Tea x1" rounds - even from two different
// tables - read as one "Tea x2" line). Display convenience only, the
// financial totals above are summed per-order, not re-derived from this.
export const getVisitConsolidatedItems = async (visitId) => {

    const result = await pool.query(
        `${GROUP_VISITS_CTE}
         SELECT OI."MenuItemId", OI."ItemName", OI."Price", COALESCE(OI."SelectedOptions", '[]'::jsonb) AS "SelectedOptions",
                SUM(OI."Quantity")::int AS "Quantity", SUM(OI."TotalPrice") AS "TotalPrice",
                MIN(OI."OrderItemId") AS "FirstOrderItemId"
         FROM "OrderItems" OI
         INNER JOIN "Orders" O ON OI."OrderId" = O."OrderId"
         WHERE O."VisitId" IN (SELECT "VisitId" FROM group_visits) AND O."OrderStatus" != 'Cancelled'
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

// One row per share of a split bill (see settleVisit below) - an unsplit
// settle still writes exactly one row here for the full amount due, so
// this is always the complete record of how a visit was actually paid,
// never a sometimes-empty side table only split bills populate. Payments
// are always written against the group's root (see settleVisit), so this
// resolves straight to the root rather than pulling in the full CTE.
export const getVisitPayments = async (visitId) => {

    const result = await pool.query(
        `SELECT "TableVisitPaymentId", "PaymentMethod", "Amount", "CreatedAt"
         FROM "TableVisitPayments"
         WHERE "VisitId" = COALESCE((SELECT "MergedIntoVisitId" FROM "TableVisits" WHERE "VisitId" = $1), $1)
         ORDER BY "TableVisitPaymentId" ASC`,
        [visitId]
    );

    return result.rows;

};

// The individual rounds themselves across the whole group (each still its
// own Order/KOT) - shown alongside the consolidated bill so staff can see
// what was ordered when (and at which physical table, once merged),
// reachable for a KOT reprint if needed.
export const getVisitOrders = async (visitId) => {

    const result = await pool.query(
        `${GROUP_VISITS_CTE}
         SELECT O."OrderId", O."TableNumber", O."OrderStatus", O."OrderDate", O."SubTotal", O."TotalAmount", A."FullName" AS "CreatedByAdminName"
         FROM "Orders" O
         LEFT JOIN "Admins" A ON O."CreatedByAdminId" = A."AdminId"
         WHERE O."VisitId" IN (SELECT "VisitId" FROM group_visits) AND O."OrderStatus" != 'Cancelled'
         ORDER BY O."OrderDate" ASC`,
        [visitId]
    );

    return result.rows;

};

// Combines two occupied tables' open visits into one bill for a large
// party seated across both - both tables stay Open and occupied on the
// floor grid (nobody's actually vacated anything), only the billing above
// starts rolling the source's orders into the target's combined view.
// Deliberately kept to exactly two levels: a target that's already a root
// (standalone, or already has other tables merged into it) can always
// gain another; a source that's itself already a child, or already a root
// WITH children of its own, is rejected - dragging a whole existing group
// into another would need real tree restructuring this doesn't attempt.
export const mergeVisits = async (branchId, sourceTableNumber, targetTableNumber) => {

    if (sourceTableNumber === targetTableNumber) {
        throw new Error("Choose two different tables to merge.");
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const visitsResult = await client.query(
            `SELECT V."VisitId", V."TableNumber", V."MergedIntoVisitId",
                    EXISTS(SELECT 1 FROM "TableVisits" C WHERE C."MergedIntoVisitId" = V."VisitId") AS "HasChildren"
             FROM "TableVisits" V
             WHERE V."BranchId" = $1 AND V."TableNumber" IN ($2, $3) AND V."Status" = 'Open'
             FOR UPDATE`,
            [branchId, sourceTableNumber, targetTableNumber]
        );

        const source = visitsResult.rows.find((row) => row.TableNumber === sourceTableNumber);
        const target = visitsResult.rows.find((row) => row.TableNumber === targetTableNumber);

        if (!source) {
            throw new Error(`Table ${sourceTableNumber} has no open bill to merge.`);
        }

        if (!target) {
            throw new Error(`Table ${targetTableNumber} has no open bill to merge into.`);
        }

        if (source.MergedIntoVisitId) {
            throw new Error(`Table ${sourceTableNumber} is already merged with another table - unmerge it first.`);
        }

        if (source.HasChildren) {
            throw new Error(`Table ${sourceTableNumber} already has other tables merged into it - merge those into Table ${targetTableNumber} one at a time instead.`);
        }

        if (target.MergedIntoVisitId) {
            throw new Error(`Table ${targetTableNumber} is itself merged into another table - merge into that table's bill instead.`);
        }

        await client.query(`UPDATE "TableVisits" SET "MergedIntoVisitId" = $2 WHERE "VisitId" = $1`, [source.VisitId, target.VisitId]);

        await client.query("COMMIT");

        return target.VisitId;

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

// Detaches one table from whatever it's merged into, going back to its own
// separate bill - the reverse of mergeVisits. Only ever needs to touch the
// one row (the child); the root and any of its other children are
// unaffected.
export const unmergeVisit = async (branchId, tableNumber) => {

    const result = await pool.query(
        `UPDATE "TableVisits" SET "MergedIntoVisitId" = NULL
         WHERE "BranchId" = $1 AND "TableNumber" = $2 AND "Status" = 'Open' AND "MergedIntoVisitId" IS NOT NULL
         RETURNING "VisitId"`,
        [branchId, tableNumber]
    );

    if (result.rows.length === 0) {
        throw new Error(`Table ${tableNumber} isn't merged with another table.`);
    }

    return result.rows[0].VisitId;

};

// Closes every visit in the group (freeing every table it spans on the
// floor grid - a merged table's other half must never be left dangling
// Open once the combined bill it belongs to has been paid) and records
// whatever paid it off as one or more rows in TableVisitPayments, always
// against the group's root - a plain settle is exactly one row for the
// full amount due; a split bill (splits non-empty) is one row per share,
// each with its own method. Locks every visit in the group together (not
// just whichever table's card was clicked) so two captains settling
// either half of a merged bill at the same moment can't both succeed - the
// second sees Status already 'Closed' and is rejected instead of double-
// settling.
export const settleVisit = async (visitId, { paymentMethod, adminId, discountAmount, discountReason, splits }) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const groupResult = await client.query(
            `${GROUP_VISITS_CTE}
             SELECT TV."VisitId", TV."Status", TV."MergedIntoVisitId" FROM "TableVisits" TV
             WHERE TV."VisitId" IN (SELECT "VisitId" FROM group_visits)
             FOR UPDATE`,
            [visitId]
        );

        if (groupResult.rows.length === 0) {
            throw new Error("Table visit not found.");
        }

        if (groupResult.rows.some((row) => row.Status !== "Open")) {
            throw new Error("This table's bill has already been settled.");
        }

        const groupVisitIds = groupResult.rows.map((row) => row.VisitId);
        // A row's own MergedIntoVisitId being null/absent is what marks it
        // as the root - loose equality also matches a mocked test row that
        // simply omits the field, which every pre-merge test still does.
        const rootVisitId = (groupResult.rows.find((row) => row.MergedIntoVisitId == null) ?? groupResult.rows[0]).VisitId;

        const totalResult = await client.query(
            `SELECT COUNT(*)::int AS "OrderCount", COALESCE(SUM("TotalAmount"), 0) AS "TotalAmount"
             FROM "Orders" WHERE "VisitId" = ANY($1::int[]) AND "OrderStatus" != 'Cancelled'`,
            [groupVisitIds]
        );

        if (totalResult.rows[0].OrderCount === 0) {
            throw new Error("This table has no orders to settle.");
        }

        const discount = Number(discountAmount) || 0;
        const billTotal = Number(totalResult.rows[0].TotalAmount);

        // Read fresh, inside the same locked transaction as the total it's
        // validated against - a discount checked against a total fetched
        // before this transaction opened could pass against a bill that's
        // since grown (another round fired off) or shrunk (an order got
        // cancelled), letting it exceed the real, current total.
        if (discount > billTotal) {
            throw new Error("Discount cannot exceed the bill total.");
        }

        const amountDue = billTotal - discount;
        const isSplit = Array.isArray(splits) && splits.length > 0;

        if (isSplit) {

            // Same reasoning as the discount check above - the amount this
            // has to add up to is only known for certain inside this same
            // locked transaction, not whatever the dialog last displayed.
            const splitSum = splits.reduce((sum, split) => sum + Number(split.amount), 0);

            if (Math.round((splitSum - amountDue) * 100) !== 0) {
                throw new Error("Split amounts must add up to the amount due.");
            }

            for (const split of splits) {

                await client.query(
                    `INSERT INTO "TableVisitPayments" ("VisitId", "PaymentMethod", "Amount") VALUES ($1, $2, $3)`,
                    [rootVisitId, split.paymentMethod, split.amount]
                );

            }

        } else {

            await client.query(
                `INSERT INTO "TableVisitPayments" ("VisitId", "PaymentMethod", "Amount") VALUES ($1, $2, $3)`,
                [rootVisitId, paymentMethod, amountDue]
            );

        }

        // A quick-glance summary field, not a replacement for the payments
        // above - the floor grid's "Already settled via X" chip and every
        // pre-existing report still read this as one value, so a split
        // across more than one distinct method collapses to "Split" rather
        // than silently keeping just the first one.
        const distinctMethods = isSplit ? [...new Set(splits.map((split) => split.paymentMethod))] : [paymentMethod];
        const summaryMethod = distinctMethods.length === 1 ? distinctMethods[0] : "Split";

        await client.query(
            `UPDATE "TableVisits" SET "Status" = 'Closed', "ClosedAt" = NOW(), "PaymentMethod" = $2, "ClosedByAdminId" = $3
             WHERE "VisitId" = ANY($1::int[])`,
            [groupVisitIds, summaryMethod, adminId ?? null]
        );

        // The bill discount only ever lives on the root - a merged child
        // has nothing of its own to discount once its orders are already
        // rolled into the root's combined total.
        await client.query(
            `UPDATE "TableVisits" SET "DiscountAmount" = $2, "DiscountReason" = $3, "DiscountByAdminId" = $4
             WHERE "VisitId" = $1`,
            [rootVisitId, discount, discount > 0 ? discountReason : null, discount > 0 ? (adminId ?? null) : null]
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
