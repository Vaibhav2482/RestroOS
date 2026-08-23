import * as TableVisitRepository from "../repositories/TableVisitRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as AuditService from "./AuditService.js";

const VALID_PAYMENT_METHODS = ["Cash", "Card", "UPI"];

export const getOpenVisitForTable = async (branchId, tableNumber) => {

    if (!branchId || !tableNumber) {
        return { success: false, message: "Branch Id and table number are required." };
    }

    const visit = await TableVisitRepository.getOpenVisitForTable(branchId, tableNumber);

    return { success: true, message: "Open table visit fetched successfully.", data: visit };

};

const shapeVisitDetails = async (visitId) => {

    const header = await TableVisitRepository.getVisitHeader(visitId);

    if (!header) {
        return null;
    }

    const [items, orders] = await Promise.all([
        TableVisitRepository.getVisitConsolidatedItems(visitId),
        TableVisitRepository.getVisitOrders(visitId)
    ]);

    return { ...header, Items: items, Orders: orders };

};

export const getVisitDetails = async (visitId) => {

    const details = await shapeVisitDetails(visitId);

    if (!details) {
        return { success: false, message: "Table visit not found." };
    }

    return { success: true, message: "Table visit fetched successfully.", data: details };

};

export const updateGuestCount = async (visitId, guestCount) => {

    if (!Number.isInteger(guestCount) || guestCount <= 0) {
        return { success: false, message: "Guest count must be a positive whole number." };
    }

    const updated = await TableVisitRepository.updateGuestCount(visitId, guestCount);

    if (!updated) {
        return { success: false, message: "This table's bill has already been settled, or the visit was not found." };
    }

    return { success: true, message: "Guest count updated.", data: updated };

};

// Consolidates every non-cancelled order under the visit into one bill,
// records the single payment that settles the whole table, and closes the
// visit - which is what actually frees the table on the floor grid (see
// migration 0024_table_visits). Individual orders keep whatever
// OrderStatus they already had; settling is a billing event, not a kitchen
// one.
export const settleVisit = async (visitId, { paymentMethod, adminId, tenantId }) => {

    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
        return { success: false, message: "A valid payment method is required." };
    }

    try {

        const closedHeader = await TableVisitRepository.settleVisit(visitId, { paymentMethod, adminId });

        AuditService.record({
            tenantId,
            actorAdminId: adminId,
            action: "TABLE_VISIT_SETTLED",
            entityType: "TableVisit",
            entityId: visitId,
            summary: `Settled Table ${closedHeader.TableNumber} (₹${Number(closedHeader.TotalAmount).toFixed(2)}, ${closedHeader.OrderCount} order${closedHeader.OrderCount === 1 ? "" : "s"}) via ${paymentMethod}`
        });

        RealtimeService.publishTableVisitSettled(closedHeader);

        return { success: true, message: "Bill settled and table closed.", data: closedHeader };

    } catch (error) {

        return { success: false, message: error.message };

    }

};
