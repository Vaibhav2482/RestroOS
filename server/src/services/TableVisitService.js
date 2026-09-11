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

// Consolidates every non-cancelled order under the visit into one bill,
// records the single payment that settles the whole table, and closes the
// visit - which is what actually frees the table on the floor grid (see
// migration 0024_table_visits). Individual orders keep whatever
// OrderStatus they already had; settling is a billing event, not a kitchen
// one.
export const settleVisit = async (visitId, { paymentMethod, adminId, tenantId, discountAmount, discountReason, canApplyDiscount }) => {

    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
        return { success: false, message: "A valid payment method is required." };
    }

    const discount = Number(discountAmount) || 0;

    if (discount < 0) {
        return { success: false, message: "Discount cannot be negative." };
    }

    if (discount > 0 && !canApplyDiscount) {
        return { success: false, message: "You don't have permission to apply a bill discount." };
    }

    const reason = discountReason?.trim();

    if (discount > 0 && !reason) {
        return { success: false, message: "A reason is required to apply a discount." };
    }

    try {

        const closedHeader = await TableVisitRepository.settleVisit(visitId, { paymentMethod, adminId, discountAmount: discount, discountReason: reason });

        const settledSummary = `Settled Table ${closedHeader.TableNumber} (₹${Number(closedHeader.TotalAmount).toFixed(2)}, ${closedHeader.OrderCount} order${closedHeader.OrderCount === 1 ? "" : "s"}) via ${paymentMethod}`;

        AuditService.record({
            tenantId,
            actorAdminId: adminId,
            action: "TABLE_VISIT_SETTLED",
            entityType: "TableVisit",
            entityId: visitId,
            summary: discount > 0
                ? `${settledSummary}, with a ₹${discount.toFixed(2)} bill discount (${reason}) - ₹${Number(closedHeader.AmountDue).toFixed(2)} collected`
                : settledSummary
        });

        RealtimeService.publishTableVisitSettled(closedHeader);

        return { success: true, message: "Bill settled and table closed.", data: closedHeader };

    } catch (error) {

        return { success: false, message: error.message };

    }

};
