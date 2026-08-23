import pool from "../config/db.js";
import { resolveMenuItemOptions } from "../utils/menuOptionResolver.js";
import { resolveCoupon } from "../utils/couponResolver.js";
import * as CouponRepository from "./CouponRepository.js";
import { resolveOpenVisitId } from "./TableVisitRepository.js";

const DELIVERY_SEQUENCE = ["Pending", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered"];
const OTHER_SEQUENCE = ["Pending", "Accepted", "Preparing", "Ready", "Delivered"];

const round2 = (amount) => Math.round(amount * 100) / 100;

// Tax computed per line at that line's own item's rate, not one flat rate
// over the whole order - real F&B has multiple GST slabs, which a single
// order-level rate can't represent. A coupon discount is apportioned
// pro-rata across lines by each line's share of the pre-discount subtotal,
// since taxing a line at its full pre-discount amount after a discount was
// actually applied would overcharge it relative to what was promised.
//
// CGST/SGST are split from ONE rounded total per line, not rounded
// independently - two independently-rounded halves can land a paisa short
// or over a line's true combined rate (e.g. 5% split as 2.5%+2.5%, each
// rounded on its own, doesn't always sum back to the line's real 5%).
// Splitting one rounded total in half - and giving SGST whatever's left over
// - guarantees the two always sum to exactly that line's tax.
export const computeOrderTax = (pricedItems, subTotal, discountAmount) => {

    let cgstAmount = 0;
    let sgstAmount = 0;

    for (const item of pricedItems) {

        const lineAmount = item.unitPrice * item.quantity;
        const lineShare = subTotal > 0 ? lineAmount / subTotal : 0;
        const lineDiscount = discountAmount * lineShare;
        const taxableAmount = Math.max(0, lineAmount - lineDiscount);

        const ratePercent = Number(item.menuItem.TaxRatePercent ?? 0);
        const lineTax = round2(taxableAmount * (ratePercent / 100));
        const lineCgst = round2(lineTax / 2);

        cgstAmount += lineCgst;
        sgstAmount += round2(lineTax - lineCgst);

    }

    cgstAmount = round2(cgstAmount);
    sgstAmount = round2(sgstAmount);

    const discountedSubTotal = Math.max(0, subTotal - discountAmount);
    const totalAmount = round2(discountedSubTotal + cgstAmount + sgstAmount);

    return { cgstAmount, sgstAmount, totalAmount };

};

// Status may legally jump several steps at once (Pending straight to Ready
// is a valid forward move), so "has the kitchen started" can't be answered
// by equality against "Preparing" alone - an order that skipped it has
// still started. "Cancelled" isn't in either sequence, so it lands at -1
// and correctly reports false.
export const hasStartedPreparing = (status, deliveryType) => {

    const sequence = deliveryType === "Delivery" ? DELIVERY_SEQUENCE : OTHER_SEQUENCE;
    const index = sequence.indexOf(status);

    return index !== -1 && index >= sequence.indexOf("Preparing");

};

export const createOrder = async (order) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const customerCheck = await client.query(
            `SELECT "TenantId" FROM "Customers" WHERE "CustomerId" = $1 AND "IsActive" = TRUE`,
            [order.customerId]
        );

        if (customerCheck.rows.length === 0) {
            throw new Error("Customer not found.");
        }

        const customerTenantId = customerCheck.rows[0].TenantId;

        const deliveryType = order.deliveryType ?? "Delivery";

        if (deliveryType === "Delivery") {

            if (!order.addressId) {
                throw new Error("Address is required for delivery orders.");
            }

            const addressCheck = await client.query(
                `SELECT 1 FROM "CustomerAddresses" WHERE "AddressId" = $1 AND "CustomerId" = $2`,
                [order.addressId, order.customerId]
            );

            if (addressCheck.rows.length === 0) {
                throw new Error("Customer address not found.");
            }

        }

        const menuItemIds = order.items.map((item) => item.menuItemId);

        // TenantId pulled in via the Branch join so we can reject items that
        // don't belong to this customer's own tenant below - without this, a
        // customer at Tenant A who somehow knew a Tenant B menuItemId could
        // place an order against Tenant B's branch/kitchen.
        const menuItemsResult = await client.query(
            `SELECT M."MenuItemId", M."BranchId", M."ItemName", M."Price", M."TaxRatePercent", B."TenantId"
             FROM "MenuItems" M
             INNER JOIN "Branches" B ON M."BranchId" = B."BranchId"
             WHERE M."MenuItemId" = ANY($1::int[])`,
            [menuItemIds]
        );

        const menuItemsById = new Map(menuItemsResult.rows.map((row) => [row.MenuItemId, row]));

        const resolvedItems = order.items
            .filter((item) => menuItemsById.has(item.menuItemId) && menuItemsById.get(item.menuItemId).TenantId === customerTenantId)
            .map((item) => ({ ...item, menuItem: menuItemsById.get(item.menuItemId) }));

        if (resolvedItems.length === 0) {
            throw new Error("Order must contain valid menu items.");
        }

        const branchIds = new Set(resolvedItems.map((item) => item.menuItem.BranchId));

        if (branchIds.size > 1) {
            throw new Error("Order items belong to more than one branch. Place separate orders per branch.");
        }

        const branchId = [...branchIds][0];

        // Options are re-resolved fresh here, never trusted from the client
        // (or even from a cart snapshot) - a menu item's price/options could
        // have changed since the customer added it to their cart.
        const pricedItems = [];

        for (const item of resolvedItems) {

            const { priceDelta, selectedOptions } = await resolveMenuItemOptions(client, item.menuItemId, item.selectedOptionIds);

            pricedItems.push({
                ...item,
                unitPrice: Number(item.menuItem.Price) + priceDelta,
                selectedOptions
            });

        }

        const subTotal = pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

        // Re-validated fresh here, never trusted from a checkout "preview"
        // call - the coupon could hit its usage limit or expire between
        // preview and actually placing the order.
        const { discountAmount, couponId } = await resolveCoupon(
            client, customerTenantId, order.couponCode, order.customerId, subTotal
        );

        const { cgstAmount, sgstAmount, totalAmount } = computeOrderTax(pricedItems, subTotal, discountAmount);

        // Every Dine In order attaches to its table's current Open visit
        // (starting one if this is the table's first round this sitting) -
        // this is what lets several rounds share one consolidated bill
        // later while each still gets its own KOT now. Takeaway/Delivery
        // orders have no table to attach to and keep VisitId null, exactly
        // as they always have (each is its own self-contained order).
        const visitId = deliveryType === "Dine In" && order.tableNumber
            ? await resolveOpenVisitId(client, branchId, order.tableNumber)
            : null;

        const orderInsert = await client.query(
            `INSERT INTO "Orders"
                ("BranchId", "CustomerId", "AddressId", "DeliveryType", "PaymentMethod", "SubTotal", "CgstAmount", "SgstAmount", "TotalAmount", "OrderStatus", "OrderNotes", "OrderDate", "TableNumber", "CouponId", "DiscountAmount", "CreatedByAdminId", "VisitId")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10, NOW(), $11, $12, $13, $14, $15)
             RETURNING "OrderId"`,
            [
                branchId,
                order.customerId,
                order.addressId ?? null,
                deliveryType,
                order.paymentMethod,
                subTotal,
                cgstAmount,
                sgstAmount,
                totalAmount,
                order.notes ?? null,
                order.tableNumber ?? null,
                couponId,
                discountAmount,
                order.createdByAdminId ?? null,
                visitId
            ]
        );

        const orderId = orderInsert.rows[0].OrderId;

        if (couponId) {
            await CouponRepository.recordRedemption(client, couponId, order.customerId, orderId, discountAmount);
        }

        for (const item of pricedItems) {

            await client.query(
                `INSERT INTO "OrderItems" ("OrderId", "MenuItemId", "ItemName", "Price", "Quantity", "TotalPrice", "SelectedOptions")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    orderId,
                    item.menuItem.MenuItemId,
                    item.menuItem.ItemName,
                    item.unitPrice,
                    item.quantity,
                    item.unitPrice * item.quantity,
                    JSON.stringify(item.selectedOptions)
                ]
            );

        }

        const result = await client.query(
            `SELECT O.*, B."BranchName"
             FROM "Orders" O
             INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
             WHERE O."OrderId" = $1`,
            [orderId]
        );

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

// A table is "occupied" for as long as it has an Open TableVisit, not
// merely for as long as it has an order that isn't Delivered yet - a guest
// who's finished eating (every round Delivered) but hasn't asked for the
// bill is still sitting at the table. Settling the visit, not any
// individual order reaching a terminal status, is what actually frees a
// table now - see migration 0024_table_visits. VisitId is included so the
// frontend can route "Settle Bill" straight to a visit without a second
// lookup.
export const getActiveTableOrders = async (branchId) => {

    const result = await pool.query(
        `SELECT O."TableNumber", O."OrderId", O."OrderStatus", O."TotalAmount", O."OrderDate", O."VisitId", C."FullName" AS "CustomerName"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         INNER JOIN "TableVisits" V ON O."VisitId" = V."VisitId" AND V."Status" = 'Open'
         WHERE O."BranchId" = $1
           AND O."DeliveryType" = 'Dine In'
           AND O."TableNumber" IS NOT NULL
           AND O."OrderStatus" != 'Cancelled'
         ORDER BY O."OrderDate" DESC`,
        [branchId]
    );

    return result.rows;

};

// Every order the kitchen still has work to do on, across all delivery
// types (Dine In, Takeaway, Delivery) - unlike getActiveTableOrders, which
// is Dine-In-only for the POS table grid. Items include SelectedOptions so
// the kitchen sees customizations (e.g. "no onions"), not just item names.
export const getKitchenOrders = async (branchId) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."TableNumber", O."DeliveryType", O."OrderStatus", O."OrderNotes", O."OrderDate",
                COALESCE(
                    (SELECT json_agg(json_build_object(
                            'OrderItemId', OI."OrderItemId",
                            'ItemName', OI."ItemName",
                            'Quantity', OI."Quantity",
                            'SelectedOptions', OI."SelectedOptions"
                        ) ORDER BY OI."OrderItemId")
                     FROM "OrderItems" OI WHERE OI."OrderId" = O."OrderId"),
                    '[]'
                ) AS "Items"
         FROM "Orders" O
         WHERE O."BranchId" = $1
           AND O."OrderStatus" IN ('Pending', 'Accepted', 'Preparing', 'Ready')
         ORDER BY O."OrderDate" ASC`,
        [branchId]
    );

    return result.rows;

};

// tenantId is always enforced here, independent of branchId - an owner
// admin (no branchId restriction) querying "all branches" must still only
// ever see their OWN tenant's branches, never the whole platform's orders.
// `pagination` is optional and additive on purpose - every existing caller
// (storefront's own order history, POS, getOrdersByCustomer) keeps getting
// the full unpaginated array back exactly as before. Only a caller that
// explicitly opts in by passing { page, limit } gets the paginated shape
// (rows + total), so this doesn't silently change behavior for anyone who
// hasn't been updated to expect it. `filters` only applies alongside
// pagination - the unpaginated callers above have no UI to filter from.
export const getAllOrders = async (tenantId, branchId, customerId, pagination = null, filters = null) => {

    const baseParams = [tenantId, branchId ?? null, customerId ?? null];

    if (!pagination) {

        const result = await pool.query(
            `SELECT O."OrderId", O."BranchId", B."BranchName", O."CustomerId", C."FullName" AS "CustomerName",
                    C."Phone" AS "CustomerPhone",
                    O."AddressId", O."DeliveryType", O."PaymentMethod", O."TotalAmount", O."DiscountAmount", O."OrderStatus",
                    O."OrderNotes", O."OrderDate", O."TableNumber", O."CreatedByAdminId", A."FullName" AS "CreatedByAdminName"
             FROM "Orders" O
             INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
             INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
             LEFT JOIN "Admins" A ON O."CreatedByAdminId" = A."AdminId"
             WHERE B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2) AND ($3::int IS NULL OR O."CustomerId" = $3)
             ORDER BY O."OrderDate" DESC`,
            baseParams
        );

        return result.rows;

    }

    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Status/date-range/search are exactly the filters Orders.jsx (tenant-
    // admin) used to apply client-side, over the entire fetched history -
    // moved server-side so a growing order history stops meaning a growing
    // page-load. Date range is compared against the database session's own
    // timezone via ::date, not the browser's local calendar day - the same
    // approximation getDashboardSummary's "Today" already makes below, kept
    // consistent rather than introducing a second, different rule.
    const status = filters?.status && filters.status !== "All" ? filters.status : null;
    const dateFrom = filters?.dateFrom || null;
    const dateTo = filters?.dateTo || null;
    const search = filters?.search?.trim() || null;

    const filterParams = [...baseParams, status, dateFrom, dateTo, search];

    // COUNT(*) OVER() rides along in the same query/index scan instead of a
    // second round trip for the total - every row carries the same total
    // count, so it's just read off row 0 (or defaulted to 0 if the page is
    // empty).
    const result = await pool.query(
        `SELECT O."OrderId", O."BranchId", B."BranchName", O."CustomerId", C."FullName" AS "CustomerName",
                C."Phone" AS "CustomerPhone",
                O."AddressId", O."DeliveryType", O."PaymentMethod", O."TotalAmount", O."DiscountAmount", O."OrderStatus",
                O."OrderNotes", O."OrderDate", O."TableNumber", O."CreatedByAdminId", A."FullName" AS "CreatedByAdminName",
                COUNT(*) OVER() AS "TotalCount"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         LEFT JOIN "Admins" A ON O."CreatedByAdminId" = A."AdminId"
         WHERE B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2) AND ($3::int IS NULL OR O."CustomerId" = $3)
           AND ($4::varchar IS NULL OR O."OrderStatus" = $4)
           AND ($5::date IS NULL OR O."OrderDate"::date >= $5)
           AND ($6::date IS NULL OR O."OrderDate"::date <= $6)
           AND ($7::text IS NULL OR CAST(O."OrderId" AS TEXT) ILIKE '%' || $7 || '%' OR C."FullName" ILIKE '%' || $7 || '%')
         ORDER BY O."OrderDate" DESC
         LIMIT $8 OFFSET $9`,
        [...filterParams, limit, offset]
    );

    const total = result.rows[0]?.TotalCount ?? 0;
    const orders = result.rows.map(({ TotalCount, ...order }) => order);

    return { orders, total };

};

// Counts orders per status under the same branch/date-range/search scope a
// paginated getAllOrders call is using - deliberately NOT filtered by
// status itself, since the point is showing how many sit in EACH status
// (the filter chip row), not just the currently-selected one. A single
// GROUP BY alongside the paginated query, not derived from the page's own
// rows (which are just one page, not the whole filtered set).
export const getOrderStatusCounts = async (tenantId, branchId, filters = null) => {

    const dateFrom = filters?.dateFrom || null;
    const dateTo = filters?.dateTo || null;
    const search = filters?.search?.trim() || null;

    const result = await pool.query(
        `SELECT O."OrderStatus", COUNT(*)::int AS "Count"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2)
           AND ($3::date IS NULL OR O."OrderDate"::date >= $3)
           AND ($4::date IS NULL OR O."OrderDate"::date <= $4)
           AND ($5::text IS NULL OR CAST(O."OrderId" AS TEXT) ILIKE '%' || $5 || '%' OR C."FullName" ILIKE '%' || $5 || '%')
         GROUP BY O."OrderStatus"`,
        [tenantId, branchId ?? null, dateFrom, dateTo, search]
    );

    return result.rows.reduce((counts, row) => {
        counts[row.OrderStatus] = row.Count;
        return counts;
    }, {});

};

// Cheap aggregate numbers for the dashboard's stat cards, plus the 5 most
// recent orders - replaces fetching the entire order history just to derive
// 3 numbers and a short list client-side (see Dashboard.jsx's prior
// implementation). "Today" is computed in the database's own session
// timezone via CURRENT_DATE, which won't exactly match a browser's local
// "today" right at a day boundary - an accepted approximation for a
// single-timezone-market product, not attempted to be perfectly precise.
export const getDashboardSummary = async (tenantId, branchId) => {

    const params = [tenantId, branchId ?? null];

    const countsResult = await pool.query(
        `SELECT
                COUNT(*) AS "TotalOrders",
                COUNT(*) FILTER (WHERE O."OrderStatus" NOT IN ('Delivered', 'Cancelled')) AS "ActiveOrders",
                COALESCE(SUM(O."TotalAmount") FILTER (
                    WHERE O."OrderDate" >= CURRENT_DATE AND O."OrderDate" < CURRENT_DATE + INTERVAL '1 day'
                ), 0) AS "TodaysRevenue"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2)`,
        params
    );

    const recentResult = await pool.query(
        `SELECT O."OrderId", O."BranchId", B."BranchName", O."CustomerId", C."FullName" AS "CustomerName",
                C."Phone" AS "CustomerPhone",
                O."AddressId", O."DeliveryType", O."PaymentMethod", O."TotalAmount", O."DiscountAmount", O."OrderStatus",
                O."OrderNotes", O."OrderDate", O."TableNumber", O."CreatedByAdminId", A."FullName" AS "CreatedByAdminName"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         LEFT JOIN "Admins" A ON O."CreatedByAdminId" = A."AdminId"
         WHERE B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2)
         ORDER BY O."OrderDate" DESC
         LIMIT 5`,
        params
    );

    const counts = countsResult.rows[0];

    return {
        totalOrders: Number(counts.TotalOrders),
        activeOrders: Number(counts.ActiveOrders),
        todaysRevenue: Number(counts.TodaysRevenue),
        recentOrders: recentResult.rows
    };

};

export const getOrderById = async (orderId) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."BranchId", B."BranchName", B."TenantId", O."CustomerId", C."FullName" AS "CustomerName",
                C."Phone" AS "CustomerPhone",
                B."Address" AS "BranchAddress", B."City" AS "BranchCity", B."Pincode" AS "BranchPincode",
                B."Phone" AS "BranchPhone",
                O."AddressId", O."DeliveryType", O."PaymentMethod", O."SubTotal", O."CgstAmount", O."SgstAmount",
                O."TotalAmount", O."DiscountAmount", O."OrderStatus", O."OrderNotes", O."OrderDate", O."TableNumber",
                O."CreatedByAdminId", A."FullName" AS "CreatedByAdminName",
                OI."OrderItemId", OI."MenuItemId", OI."ItemName", OI."Price", OI."Quantity", OI."TotalPrice", OI."SelectedOptions"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         INNER JOIN "OrderItems" OI ON O."OrderId" = OI."OrderId"
         LEFT JOIN "Admins" A ON O."CreatedByAdminId" = A."AdminId"
         WHERE O."OrderId" = $1`,
        [orderId]
    );

    return result.rows;

};

export const getOrdersByCustomer = async (customerId) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."BranchId", B."BranchName", O."CustomerId", O."AddressId", O."DeliveryType",
                O."PaymentMethod", O."TotalAmount", O."DiscountAmount", O."OrderStatus", O."OrderNotes", O."OrderDate", O."TableNumber",
                COALESCE(
                    (SELECT json_agg(json_build_object('ItemName', OI."ItemName", 'Quantity', OI."Quantity")
                              ORDER BY OI."OrderItemId")
                     FROM "OrderItems" OI WHERE OI."OrderId" = O."OrderId"),
                    '[]'
                ) AS "Items"
         FROM "Orders" O
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE O."CustomerId" = $1
         ORDER BY O."OrderDate" DESC`,
        [customerId]
    );

    return result.rows;

};

// FRS A5: two staff members advancing the same order at once (or POS and a
// stale KDS tab) used to both read the same pre-advance status and both
// succeed, silently - last write wins, no error to either caller. The
// SELECT ... FOR UPDATE below locks the row for the duration of this
// transaction; a second concurrent call blocks until the first commits,
// then re-reads the now-current status and correctly rejects an
// already-invalid transition instead of racing it. `onValidated` runs
// Inventory consumption (FRS B7 - InventoryService.consumeForOrder) in the
// same transaction as the status write, so a consumption failure rolls
// back the status change too rather than leaving them inconsistent.
export const updateOrderStatus = async (id, orderStatus, onValidated) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const existing = await client.query(
            `SELECT "OrderStatus", "DeliveryType" FROM "Orders" WHERE "OrderId" = $1 FOR UPDATE`,
            [id]
        );

        if (existing.rows.length === 0) {
            throw new Error("Order not found.");
        }

        const currentStatus = existing.rows[0].OrderStatus;
        const deliveryType = existing.rows[0].DeliveryType;

        if (["Delivered", "Cancelled"].includes(currentStatus)) {
            throw new Error("This order is already finished and cannot be updated.");
        }

        const sequence = deliveryType === "Delivery" ? DELIVERY_SEQUENCE : OTHER_SEQUENCE;

        const currentStep = sequence.indexOf(currentStatus);
        const targetStep = sequence.indexOf(orderStatus);

        if (targetStep === -1) {
            throw new Error("That status is not valid for this order type.");
        }

        if (targetStep <= currentStep) {
            throw new Error("Order status can only move forward.");
        }

        const result = await client.query(
            `UPDATE "Orders" SET "OrderStatus" = $1 WHERE "OrderId" = $2 RETURNING *`,
            [orderStatus, id]
        );

        if (onValidated) {
            await onValidated(client, result.rows[0]);
        }

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

export const updateOrderItems = async (orderId, items) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const orderCheck = await client.query(
            `SELECT "OrderStatus", "BranchId", "DiscountAmount" FROM "Orders" WHERE "OrderId" = $1`,
            [orderId]
        );

        if (orderCheck.rows.length === 0) {
            throw new Error("Order not found.");
        }

        const orderStatus = orderCheck.rows[0].OrderStatus;
        const branchId = orderCheck.rows[0].BranchId;
        const discountAmount = Number(orderCheck.rows[0].DiscountAmount || 0);

        if (orderStatus !== "Pending") {
            throw new Error("Only pending orders can have their items edited.");
        }

        const menuItemIds = items.map((item) => item.menuItemId);

        const menuItemsResult = await client.query(
            `SELECT "MenuItemId", "BranchId", "ItemName", "Price", "TaxRatePercent" FROM "MenuItems" WHERE "MenuItemId" = ANY($1::int[])`,
            [menuItemIds]
        );

        const menuItemsById = new Map(menuItemsResult.rows.map((row) => [row.MenuItemId, row]));

        const resolvedItems = items
            .filter((item) => menuItemsById.has(item.menuItemId))
            .map((item) => ({ ...item, menuItem: menuItemsById.get(item.menuItemId) }));

        if (resolvedItems.length === 0) {
            throw new Error("Order must contain at least one valid item.");
        }

        if (resolvedItems.some((item) => item.menuItem.BranchId !== branchId)) {
            throw new Error("Items must belong to the order's branch.");
        }

        const pricedItems = [];

        for (const item of resolvedItems) {

            const { priceDelta, selectedOptions } = await resolveMenuItemOptions(client, item.menuItemId, item.selectedOptionIds);

            pricedItems.push({
                ...item,
                unitPrice: Number(item.menuItem.Price) + priceDelta,
                selectedOptions
            });

        }

        await client.query(`DELETE FROM "OrderItems" WHERE "OrderId" = $1`, [orderId]);

        for (const item of pricedItems) {

            await client.query(
                `INSERT INTO "OrderItems" ("OrderId", "MenuItemId", "ItemName", "Price", "Quantity", "TotalPrice", "SelectedOptions")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    orderId,
                    item.menuItem.MenuItemId,
                    item.menuItem.ItemName,
                    item.unitPrice,
                    item.quantity,
                    item.unitPrice * item.quantity,
                    JSON.stringify(item.selectedOptions)
                ]
            );

        }

        const subTotal = pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

        // The order's existing coupon discount (if any) was silently dropped
        // here before - tax/total were recomputed off the raw new subtotal
        // while the DiscountAmount column still claimed a discount applied,
        // overcharging the customer relative to what they were promised at
        // checkout. computeOrderTax clamps at 0 in case the edit shrinks the
        // order below the discount amount.
        const { cgstAmount, sgstAmount, totalAmount } = computeOrderTax(pricedItems, subTotal, discountAmount);

        await client.query(
            `UPDATE "Orders" SET "SubTotal" = $1, "CgstAmount" = $2, "SgstAmount" = $3, "TotalAmount" = $4 WHERE "OrderId" = $5`,
            [subTotal, cgstAmount, sgstAmount, totalAmount, orderId]
        );

        const result = await client.query(
            `SELECT O.*, B."BranchName"
             FROM "Orders" O
             INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
             WHERE O."OrderId" = $1`,
            [orderId]
        );

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

// FRS A4: a customer and staff don't get the same cancellation window - a
// customer can back out through Accepted, but once the kitchen has
// started (Preparing), only staff can still call it off. `allowedStatuses`
// is caller-supplied so the two roles' rules live in the service layer,
// not duplicated here. Row-locked for the same reason updateOrderStatus
// is (FRS A5) - a cancel racing a simultaneous status advance must not
// silently let both "succeed". `onValidated` runs Inventory reversal
// (FRS B8 - InventoryService.reverseConsumptionForOrder) in the same
// transaction as the cancel.
export const cancelOrder = async (orderId, allowedStatuses, onValidated) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const existing = await client.query(`SELECT "OrderStatus" FROM "Orders" WHERE "OrderId" = $1 FOR UPDATE`, [orderId]);

        if (existing.rows.length === 0) {
            throw new Error("Order not found.");
        }

        const currentStatus = existing.rows[0].OrderStatus;

        if (!allowedStatuses.includes(currentStatus)) {
            throw new Error(`Order cannot be cancelled once it is ${currentStatus}.`);
        }

        const result = await client.query(
            `UPDATE "Orders" SET "OrderStatus" = 'Cancelled' WHERE "OrderId" = $1
             RETURNING "OrderId", "BranchId", "CustomerId", "AddressId", "DeliveryType", "PaymentMethod", "TotalAmount", "OrderStatus", "OrderNotes", "OrderDate"`,
            [orderId]
        );

        if (onValidated) {
            await onValidated(client, result.rows[0]);
        }

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};
