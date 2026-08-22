import { getPusherClient } from "../config/pusher.js";

// Realtime is best-effort: an order must never fail to place, or a status
// update never fail to save, just because Pusher is unreachable or not
// configured yet. Every publish here swallows its own errors.
const safeTrigger = async (channel, event, payload) => {

    const pusher = getPusherClient();

    if (!pusher) {
        return;
    }

    try {

        await pusher.trigger(channel, event, payload);

    } catch (error) {

        console.error(`Realtime publish failed (${channel} / ${event}): ${error.message}`);

    }

};

export const publishOrderCreated = (order) => {

    return safeTrigger(`private-branch-${order.BranchId}`, "order:created", {
        orderId: order.OrderId,
        branchId: order.BranchId,
        customerId: order.CustomerId,
        orderStatus: order.OrderStatus
    });

};

export const publishOrderStatusChanged = (order) => {

    return Promise.all([
        safeTrigger(`private-branch-${order.BranchId}`, "order:status-changed", {
            orderId: order.OrderId,
            branchId: order.BranchId,
            orderStatus: order.OrderStatus
        }),
        safeTrigger(`private-customer-${order.CustomerId}`, "order:status-changed", {
            orderId: order.OrderId,
            orderStatus: order.OrderStatus
        })
    ]);

};

// Reuses the branch channel's existing "order:status-changed" event rather
// than introducing a new one the POS floor grid would need its own
// listener for - it already refreshes table state on that event, and a
// settled visit freeing a table is exactly the kind of change that
// refresh exists to pick up.
export const publishTableVisitSettled = (visit) => {

    return safeTrigger(`private-branch-${visit.BranchId}`, "order:status-changed", {
        visitId: visit.VisitId,
        branchId: visit.BranchId,
        tableNumber: visit.TableNumber
    });

};
