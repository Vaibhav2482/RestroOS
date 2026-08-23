import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/TableVisitRepository.js");
vi.mock("./RealtimeService.js");
vi.mock("./AuditService.js");

const TableVisitRepository = await import("../repositories/TableVisitRepository.js");
const RealtimeService = await import("./RealtimeService.js");
const AuditService = await import("./AuditService.js");
const { getVisitDetails, settleVisit, updateGuestCount } = await import("./TableVisitService.js");

beforeEach(() => {
    vi.clearAllMocks();
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
            Orders: [{ OrderId: 301 }, { OrderId: 302 }]
        });

    });

});

describe("TableVisitService.updateGuestCount", () => {

    it("rejects a non-positive or non-integer count before touching the repository", async () => {

        expect(await updateGuestCount(5, 0)).toEqual({ success: false, message: "Guest count must be a positive whole number." });
        expect(await updateGuestCount(5, -2)).toEqual({ success: false, message: "Guest count must be a positive whole number." });
        expect(await updateGuestCount(5, 2.5)).toEqual({ success: false, message: "Guest count must be a positive whole number." });
        expect(TableVisitRepository.updateGuestCount).not.toHaveBeenCalled();

    });

    it("reports failure when the visit is already settled or missing (repository returns null)", async () => {

        TableVisitRepository.updateGuestCount.mockResolvedValue(null);

        const result = await updateGuestCount(5, 4);

        expect(result.success).toBe(false);

    });

    it("updates and returns success on a valid count against an Open visit", async () => {

        TableVisitRepository.updateGuestCount.mockResolvedValue({ VisitId: 5 });

        const result = await updateGuestCount(5, 4);

        expect(result).toEqual({ success: true, message: "Guest count updated.", data: { VisitId: 5 } });
        expect(TableVisitRepository.updateGuestCount).toHaveBeenCalledWith(5, 4);

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

});
