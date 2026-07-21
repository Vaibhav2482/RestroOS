import pool from "../config/db.js";

const DELIVERY_SEQUENCE = ["Pending", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered"];
const OTHER_SEQUENCE = ["Pending", "Accepted", "Preparing", "Ready", "Delivered"];

const roundGst = (amount) => Math.round(amount * 0.025 * 100) / 100;

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
            `SELECT M."MenuItemId", M."BranchId", M."ItemName", M."Price", B."TenantId"
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

        const subTotal = resolvedItems.reduce((sum, item) => sum + item.menuItem.Price * item.quantity, 0);
        const cgstAmount = roundGst(subTotal);
        const sgstAmount = roundGst(subTotal);
        const totalAmount = subTotal + cgstAmount + sgstAmount;

        const orderInsert = await client.query(
            `INSERT INTO "Orders"
                ("BranchId", "CustomerId", "AddressId", "DeliveryType", "PaymentMethod", "SubTotal", "CgstAmount", "SgstAmount", "TotalAmount", "OrderStatus", "OrderNotes", "OrderDate", "TableNumber")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10, NOW(), $11)
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
                order.tableNumber ?? null
            ]
        );

        const orderId = orderInsert.rows[0].OrderId;

        for (const item of resolvedItems) {

            await client.query(
                `INSERT INTO "OrderItems" ("OrderId", "MenuItemId", "ItemName", "Price", "Quantity", "TotalPrice")
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [orderId, item.menuItem.MenuItemId, item.menuItem.ItemName, item.menuItem.Price, item.quantity, item.menuItem.Price * item.quantity]
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

export const getActiveTableOrders = async (branchId) => {

    const result = await pool.query(
        `SELECT O."TableNumber", O."OrderId", O."OrderStatus", O."TotalAmount", O."OrderDate", C."FullName" AS "CustomerName"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         WHERE O."BranchId" = $1
           AND O."DeliveryType" = 'Dine In'
           AND O."TableNumber" IS NOT NULL
           AND O."OrderStatus" NOT IN ('Delivered', 'Cancelled')
         ORDER BY O."OrderDate" DESC`,
        [branchId]
    );

    return result.rows;

};

// tenantId is always enforced here, independent of branchId - an owner
// admin (no branchId restriction) querying "all branches" must still only
// ever see their OWN tenant's branches, never the whole platform's orders.
export const getAllOrders = async (tenantId, branchId) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."BranchId", B."BranchName", O."CustomerId", C."FullName" AS "CustomerName",
                C."Phone" AS "CustomerPhone",
                O."AddressId", O."DeliveryType", O."PaymentMethod", O."TotalAmount", O."OrderStatus",
                O."OrderNotes", O."OrderDate", O."TableNumber"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         WHERE B."TenantId" = $1 AND ($2::int IS NULL OR O."BranchId" = $2)
         ORDER BY O."OrderDate" DESC`,
        [tenantId, branchId ?? null]
    );

    return result.rows;

};

export const getOrderById = async (orderId) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."BranchId", B."BranchName", B."TenantId", O."CustomerId", C."FullName" AS "CustomerName",
                C."Phone" AS "CustomerPhone",
                B."Address" AS "BranchAddress", B."City" AS "BranchCity", B."Pincode" AS "BranchPincode",
                B."Phone" AS "BranchPhone",
                O."AddressId", O."DeliveryType", O."PaymentMethod", O."SubTotal", O."CgstAmount", O."SgstAmount",
                O."TotalAmount", O."OrderStatus", O."OrderNotes", O."OrderDate", O."TableNumber",
                OI."OrderItemId", OI."MenuItemId", OI."ItemName", OI."Price", OI."Quantity", OI."TotalPrice"
         FROM "Orders" O
         INNER JOIN "Customers" C ON O."CustomerId" = C."CustomerId"
         INNER JOIN "Branches" B ON O."BranchId" = B."BranchId"
         INNER JOIN "OrderItems" OI ON O."OrderId" = OI."OrderId"
         WHERE O."OrderId" = $1`,
        [orderId]
    );

    return result.rows;

};

export const getOrdersByCustomer = async (customerId) => {

    const result = await pool.query(
        `SELECT O."OrderId", O."BranchId", B."BranchName", O."CustomerId", O."AddressId", O."DeliveryType",
                O."PaymentMethod", O."TotalAmount", O."OrderStatus", O."OrderNotes", O."OrderDate", O."TableNumber",
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

export const updateOrderStatus = async (id, orderStatus) => {

    const existing = await pool.query(
        `SELECT "OrderStatus", "DeliveryType" FROM "Orders" WHERE "OrderId" = $1`,
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

    const result = await pool.query(
        `UPDATE "Orders" SET "OrderStatus" = $1 WHERE "OrderId" = $2 RETURNING *`,
        [orderStatus, id]
    );

    return result.rows[0];

};

export const updateOrderItems = async (orderId, items) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const orderCheck = await client.query(
            `SELECT "OrderStatus", "BranchId" FROM "Orders" WHERE "OrderId" = $1`,
            [orderId]
        );

        if (orderCheck.rows.length === 0) {
            throw new Error("Order not found.");
        }

        const orderStatus = orderCheck.rows[0].OrderStatus;
        const branchId = orderCheck.rows[0].BranchId;

        if (orderStatus !== "Pending") {
            throw new Error("Only pending orders can have their items edited.");
        }

        const menuItemIds = items.map((item) => item.menuItemId);

        const menuItemsResult = await client.query(
            `SELECT "MenuItemId", "BranchId", "ItemName", "Price" FROM "MenuItems" WHERE "MenuItemId" = ANY($1::int[])`,
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

        await client.query(`DELETE FROM "OrderItems" WHERE "OrderId" = $1`, [orderId]);

        for (const item of resolvedItems) {

            await client.query(
                `INSERT INTO "OrderItems" ("OrderId", "MenuItemId", "ItemName", "Price", "Quantity", "TotalPrice")
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [orderId, item.menuItem.MenuItemId, item.menuItem.ItemName, item.menuItem.Price, item.quantity, item.menuItem.Price * item.quantity]
            );

        }

        const subTotal = resolvedItems.reduce((sum, item) => sum + item.menuItem.Price * item.quantity, 0);
        const cgstAmount = roundGst(subTotal);
        const sgstAmount = roundGst(subTotal);
        const totalAmount = subTotal + cgstAmount + sgstAmount;

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

export const cancelOrder = async (orderId) => {

    const existing = await pool.query(`SELECT "OrderStatus" FROM "Orders" WHERE "OrderId" = $1`, [orderId]);

    if (existing.rows.length === 0) {
        throw new Error("Order not found.");
    }

    const currentStatus = existing.rows[0].OrderStatus;

    if (!["Pending", "Accepted", "Preparing"].includes(currentStatus)) {
        throw new Error("Order cannot be cancelled once it is Ready, Out For Delivery, Delivered, or already Cancelled.");
    }

    const result = await pool.query(
        `UPDATE "Orders" SET "OrderStatus" = 'Cancelled' WHERE "OrderId" = $1
         RETURNING "OrderId", "CustomerId", "AddressId", "DeliveryType", "PaymentMethod", "TotalAmount", "OrderStatus", "OrderNotes", "OrderDate"`,
        [orderId]
    );

    return result.rows[0];

};
