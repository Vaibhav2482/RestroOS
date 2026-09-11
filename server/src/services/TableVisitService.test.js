import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/TableVisitRepository.js");
vi.mock("./RealtimeService.js");
vi.mock("./AuditService.js");

const TableVisitRepository = await import("../repositories/TableVisitRepository.js");
const RealtimeService = await import("./RealtimeService.js");
const AuditService = await import("./AuditService.js");
const { getVisitDetails, settleVisit } = await import("./TableVisitService.js");

beforeEach(() => {

    vi.clearAllMocks();

    // Every settleVisit success path re-shapes the closed visit via
    // shapeVisitDetails (see TableVisitService.settleVisit) - these three
    // are what it calls alongside getVisitHeader, so every such test needs
    // them stubbed even when it doesn't care about Items/Orders/Payments
    // itself. Tests below that DO care override these per-call.
    TableVisitRepository.getVisitConsolidatedItems.mockResolvedValue([]);
    TableVisitRepository.getVisitOrders.mockResolvedValue([]);
    TableVisitRepository.getVisitPayments.mockResolvedValue([]);

});

describe("TableVisitService.getVisitDetails", () => {

    it("reports not found without touching the items/orders queries", async () => {

        TableVisitRepository.getVisitHeader.mockResolvedValue(null);

        const result = await getVisitDetails(999);

        expect(result).toEqual({ success: false, message: "Table visit not found." });
        expect(TableVisitRepository.getVisitConsolidatedItems).not.toHaveBeenCalled();

    });

    it("combines the header, consolidated items, and constituent orders into one shape", async () => {

        TableVisitRepository.getVisitHeader.mockResolvedValue({ VisitId: 5, TableNumber: "A3", TotalAmount: "417.90" });
        TableVisitRepository.getVisitConsolidatedItems.mockResolvedValue([{ ItemName: "Tea", Quantity: 2 }]);
        TableVisitRepository.getVisitOrders.mockResolvedValue([{ OrderId: 301 }, { OrderId: 302 }]);

        const result = await getVisitDetails(5);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            VisitId: 5,
            TableNumber: "A3",
            TotalAmount: "417.90",
            Items: [{ ItemName: "Tea", Quantity: 2 }],
            Orders: [{ OrderId: 301 }, { OrderId: 302 }],
            Payments: []
        });

    });

});

describe("TableVisitService.settleVisit", () => {

    it("rejects an invalid payment method before touching the repository", async () => {

        const result = await settleVisit(5, { paymentMethod: "Bitcoin", adminId: 1, tenantId: 9 });

        expect(result).toEqual({ success: false, message: "A valid payment method is required." });
        expect(TableVisitRepository.settleVisit).not.toHaveBeenCalled();

    });

    it("rejects a missing payment method", async () => {

        const result = await settleVisit(5, { adminId: 1, tenantId: 9 });

        expect(result.success).toBe(false);

    });

    it("surfaces a repository error (already settled, not found, ...) as a failure result, not a throw", async () => {

        TableVisitRepository.settleVisit.mockRejectedValue(new Error("This table's bill has already been settled."));

        const result = await settleVisit(5, { paymentMethod: "Cash", adminId: 1, tenantId: 9 });

        expect(result).toEqual({ success: false, message: "This table's bill has already been settled." });
        expect(AuditService.record).not.toHaveBeenCalled();
        expect(RealtimeService.publishTableVisitSettled).not.toHaveBeenCalled();

    });

    it("on success, records an audit entry and publishes the realtime event so the floor grid frees the table", async () => {

        TableVisitRepository.settleVisit.mockResolvedValue({
            VisitId: 5, BranchId: 1, TableNumber: "A3", TotalAmount: "417.90", OrderCount: 2
        });
        // The response the dialog actually renders comes from a fresh
        // shapeVisitDetails call, not the bare closedHeader above - see
        // TableVisitService.settleVisit's own comment on why.
        TableVisitRepository.getVisitHeader.mockResolvedValue({
            VisitId: 5, BranchId: 1, TableNumber: "A3", TotalAmount: "417.90", OrderCount: 2
        });

        const result = await settleVisit(5, { paymentMethod: "Cash", adminId: 1, tenantId: 9 });

        expect(result.success).toBe(true);
        expect(result.data.TableNumber).toBe("A3");

        expect(AuditService.record).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 9,
            actorAdminId: 1,
            action: "TABLE_VISIT_SETTLED",
            entityType: "TableVisit",
            entityId: 5
        }));

        expect(RealtimeService.publishTableVisitSettled).toHaveBeenCalledWith(
            expect.objectContaining({ VisitId: 5, TableNumber: "A3" })
        );

    });

    // Regression test: the repository's own settleVisit only ever returns
    // the bare header (it has no reason to know about Items/Orders/
    // Payments) - returning that AS-IS used to mean a receipt printed right
    // after settling (the dialog never closed in between) rendered with no
    // line items and no payment breakdown, since the in-memory visit had
    // just been overwritten with a header-only object.
    it("returns the full Items/Orders/Payments shape, not just the bare closed header", async () => {

        TableVisitRepository.settleVisit.mockResolvedValue({ VisitId: 5, TableNumber: "A3", TotalAmount: "417.90", OrderCount: 1 });
        TableVisitRepository.getVisitHeader.mockResolvedValue({ VisitId: 5, TableNumber: "A3", TotalAmount: "417.90", OrderCount: 1 });
        TableVisitRepository.getVisitConsolidatedItems.mockResolvedValue([{ ItemName: "Thali", Quantity: 1 }]);
        TableVisitRepository.getVisitPayments.mockResolvedValue([{ PaymentMethod: "Cash", Amount: "417.90" }]);

        const result = await settleVisit(5, { paymentMethod: "Cash", adminId: 1, tenantId: 9 });

        expect(result.data.Items).toEqual([{ ItemName: "Thali", Quantity: 1 }]);
        expect(result.data.Payments).toEqual([{ PaymentMethod: "Cash", Amount: "417.90" }]);

    });

});

describe("TableVisitService.settleVisit - bill discount", () => {

    it("rejects a negative discount before touching the repository", async () => {

        const result = await settleVisit(5, { paymentMethod: "Cash", adminId: 1, tenantId: 9, discountAmount: -10, canApplyDiscount: true });

        expect(result).toEqual({ success: false, message: "Discount cannot be negative." });
        expect(TableVisitRepository.settleVisit).not.toHaveBeenCalled();

    });

    it("rejects a discount from an admin without apply_discounts", async () => {

        const result = await settleVisit(5, {
            paymentMethod: "Cash", adminId: 1, tenantId: 9, discountAmount: 50, discountReason: "Service delay", canApplyDiscount: false
        });

        expect(result).toEqual({ success: false, message: "You don't have permission to apply a bill discount." });
        expect(TableVisitRepository.settleVisit).not.toHaveBeenCalled();

    });

    it("requires a reason once an amount is entered", async () => {

        const result = await settleVisit(5, {
            paymentMethod: "Cash", adminId: 1, tenantId: 9, discountAmount: 50, discountReason: "   ", canApplyDiscount: true
        });

        expect(result).toEqual({ success: false, message: "A reason is required to apply a discount." });
        expect(TableVisitRepository.settleVisit).not.toHaveBeenCalled();

    });

    it("settling with zero discount never requires the permission or a reason", async () => {

        TableVisitRepository.settleVisit.mockResolvedValue({ VisitId: 5, TableNumber: "A3", TotalAmount: "417.90", AmountDue: "417.90", OrderCount: 1 });

        const result = await settleVisit(5, { paymentMethod: "Cash", adminId: 1, tenantId: 9, canApplyDiscount: false });

        expect(result.success).toBe(true);
        expect(TableVisitRepository.settleVisit).toHaveBeenCalledWith(5, expect.objectContaining({ discountAmount: 0, discountReason: undefined }));

    });

    it("passes a valid discount through and records it in the audit summary", async () => {

        TableVisitRepository.settleVisit.mockResolvedValue({
            VisitId: 5, TableNumber: "A3", TotalAmount: "417.90", AmountDue: "367.90", OrderCount: 1
        });

        const result = await settleVisit(5, {
            paymentMethod: "Cash", adminId: 1, tenantId: 9, discountAmount: 50, discountReason: "  Service delay  ", canApplyDiscount: true
        });

        expect(result.success).toBe(true);
        expect(TableVisitRepository.settleVisit).toHaveBeenCalledWith(5, expect.objectContaining({ discountAmount: 50, discountReason: "Service delay" }));
        expect(AuditService.record).toHaveBeenCalledWith(expect.objectContaining({
            summary: expect.stringContaining("₹50.00 bill discount (Service delay)")
        }));

    });

});

describe("TableVisitService.settleVisit - split bill", () => {

    it("rejects a single split - splitting needs at least two shares", async () => {

        const result = await settleVisit(5, { adminId: 1, tenantId: 9, splits: [{ amount: 200, paymentMethod: "Cash" }] });

        expect(result).toEqual({ success: false, message: "Split billing needs at least two shares." });
        expect(TableVisitRepository.settleVisit).not.toHaveBeenCalled();

    });

    it("rejects a split with an invalid payment method", async () => {

        const result = await settleVisit(5, {
            adminId: 1, tenantId: 9, splits: [{ amount: 100, paymentMethod: "Bitcoin" }, { amount: 100, paymentMethod: "Cash" }]
        });

        expect(result).toEqual({ success: false, message: "Every split needs a valid payment method." });
        expect(TableVisitRepository.settleVisit).not.toHaveBeenCalled();

    });

    it("rejects a split with a zero or negative amount", async () => {

        const result = await settleVisit(5, {
            adminId: 1, tenantId: 9, splits: [{ amount: 0, paymentMethod: "Cash" }, { amount: 200, paymentMethod: "Card" }]
        });

        expect(result).toEqual({ success: false, message: "Every split needs an amount greater than zero." });
        expect(TableVisitRepository.settleVisit).not.toHaveBeenCalled();

    });

    it("does not require the top-level paymentMethod when splits are provided", async () => {

        TableVisitRepository.settleVisit.mockResolvedValue({
            VisitId: 5, TableNumber: "A3", TotalAmount: "200.00", AmountDue: "200.00", OrderCount: 1
        });

        const result = await settleVisit(5, {
            adminId: 1, tenantId: 9, splits: [{ amount: 100, paymentMethod: "Cash" }, { amount: 100, paymentMethod: "Card" }]
        });

        expect(result.success).toBe(true);
        expect(TableVisitRepository.settleVisit).toHaveBeenCalledWith(5, expect.objectContaining({
            splits: [{ amount: 100, paymentMethod: "Cash" }, { amount: 100, paymentMethod: "Card" }]
        }));

    });

    it("records each split's own method and amount in the audit summary", async () => {

        TableVisitRepository.settleVisit.mockResolvedValue({
            VisitId: 5, TableNumber: "A3", TotalAmount: "200.00", AmountDue: "200.00", OrderCount: 1
        });

        await settleVisit(5, {
            adminId: 1, tenantId: 9, splits: [{ amount: 100, paymentMethod: "Cash" }, { amount: 100, paymentMethod: "Card" }]
        });

        expect(AuditService.record).toHaveBeenCalledWith(expect.objectContaining({
            summary: expect.stringContaining("Cash ₹100.00, Card ₹100.00")
        }));

    });

    it("surfaces a repository-side sum mismatch as a failure result", async () => {

        TableVisitRepository.settleVisit.mockRejectedValue(new Error("Split amounts must add up to the amount due."));

        const result = await settleVisit(5, {
            adminId: 1, tenantId: 9, splits: [{ amount: 50, paymentMethod: "Cash" }, { amount: 50, paymentMethod: "Card" }]
        });

        expect(result).toEqual({ success: false, message: "Split amounts must add up to the amount due." });

    });

});
