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

    const [items, orders, payments] = await Promise.all([
        TableVisitRepository.getVisitConsolidatedItems(visitId),
        TableVisitRepository.getVisitOrders(visitId),
        TableVisitRepository.getVisitPayments(visitId)
    ]);

    return { ...header, Items: items, Orders: orders, Payments: payments };

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
// A split share needs its own valid method and a positive amount - the sum
// actually matching what's due is checked later, inside the repository's
// locked transaction (see its own comment on why).
const validateSplits = (splits) => {

    if (splits.length < 2) {
        return "Split billing needs at least two shares.";
    }

    for (const split of splits) {

        if (!split.paymentMethod || !VALID_PAYMENT_METHODS.includes(split.paymentMethod)) {
            return "Every split needs a valid payment method.";
        }

        if (!(Number(split.amount) > 0)) {
            return "Every split needs an amount greater than zero.";
        }

    }

    return null;

};

export const settleVisit = async (visitId, { paymentMethod, adminId, tenantId, discountAmount, discountReason, canApplyDiscount, splits }) => {

    const isSplit = Array.isArray(splits) && splits.length > 0;

    if (isSplit) {

        const splitError = validateSplits(splits);

        if (splitError) {
            return { success: false, message: splitError };
        }

    } else if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {

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

    const normalizedSplits = isSplit
        ? splits.map((split) => ({ amount: Number(split.amount), paymentMethod: split.paymentMethod }))
        : null;

    try {

        const closedHeader = await TableVisitRepository.settleVisit(visitId, {
            paymentMethod, adminId, discountAmount: discount, discountReason: reason, splits: normalizedSplits
        });

        const paidVia = isSplit
            ? `via a split bill (${normalizedSplits.map((split) => `${split.paymentMethod} ₹${split.amount.toFixed(2)}`).join(", ")})`
            : `via ${paymentMethod}`;

        const settledSummary = `Settled Table ${closedHeader.TableNumber} (₹${Number(closedHeader.TotalAmount).toFixed(2)}, ${closedHeader.OrderCount} order${closedHeader.OrderCount === 1 ? "" : "s"}) ${paidVia}`;

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

        // The repository only ever returns the bare header (it has no
        // reason to know about Items/Orders/Payments) - re-shaping here is
        // what lets the dialog that's already open print a real receipt
        // (line items, the split breakdown) right after settling, instead
        // of one that suddenly looks empty because the in-memory visit got
        // replaced with just the header.
        const fullDetails = await shapeVisitDetails(visitId);

        return { success: true, message: "Bill settled and table closed.", data: fullDetails };

    } catch (error) {

        return { success: false, message: error.message };

    }

};
