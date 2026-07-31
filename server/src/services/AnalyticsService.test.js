import { describe, it, expect, vi, beforeEach } from "vitest";

import * as AnalyticsService from "./AnalyticsService.js";
import * as AnalyticsRepository from "../repositories/AnalyticsRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

vi.mock("../repositories/AnalyticsRepository.js");
vi.mock("../repositories/BranchRepository.js");

beforeEach(() => {

    vi.clearAllMocks();

    AnalyticsRepository.getSummary.mockResolvedValue({ Revenue: 1000, OrderCount: 10, AvgOrderValue: 100 });
    AnalyticsRepository.getRevenueTrend.mockResolvedValue([]);
    AnalyticsRepository.getTopItems.mockResolvedValue([]);
    AnalyticsRepository.getPeakHours.mockResolvedValue([]);
    AnalyticsRepository.getBranchComparison.mockResolvedValue([]);
    AnalyticsRepository.getCogsSummary.mockResolvedValue({ CogsValue: 0, WastageValue: 0, IngredientsMissingCost: 0 });

});

describe("AnalyticsService.getOverview", () => {

    it("defaults to a 30-day range ending today when no dates are given", async () => {

        const result = await AnalyticsService.getOverview(1, null, undefined, undefined);

        expect(result.success).toBe(true);

        const [, , from, to] = AnalyticsRepository.getSummary.mock.calls[0];
        const rangeDays = Math.round((to - from) / (24 * 60 * 60 * 1000));

        expect(rangeDays).toBe(30);

    });

    it("treats the \"to\" date as inclusive of that whole calendar day", async () => {

        await AnalyticsService.getOverview(1, null, "2026-01-01", "2026-01-01");

        const [, , from, to] = AnalyticsRepository.getSummary.mock.calls[0];

        expect(from.toISOString().slice(0, 10)).toBe("2026-01-01");
        expect(to.toISOString().slice(0, 10)).toBe("2026-01-02");

    });

    it("rejects a \"from\" that isn't before \"to\"", async () => {

        const result = await AnalyticsService.getOverview(1, null, "2026-01-10", "2026-01-05");

        expect(result.success).toBe(false);
        expect(AnalyticsRepository.getSummary).not.toHaveBeenCalled();

    });

    it("rejects an unparseable date instead of passing NaN through to SQL", async () => {

        const result = await AnalyticsService.getOverview(1, null, "not-a-date", undefined);

        expect(result.success).toBe(false);
        expect(AnalyticsRepository.getSummary).not.toHaveBeenCalled();

    });

    it("rejects a range spanning more than a year", async () => {

        const result = await AnalyticsService.getOverview(1, null, "2020-01-01", "2026-01-01");

        expect(result.success).toBe(false);
        expect(AnalyticsRepository.getSummary).not.toHaveBeenCalled();

    });

    it("passes branchId through unchanged, including null for an owner viewing every branch", async () => {

        await AnalyticsService.getOverview(1, 5, undefined, undefined);

        expect(AnalyticsRepository.getSummary).toHaveBeenCalledWith(1, 5, expect.any(Date), expect.any(Date));

    });

});

describe("AnalyticsService.getBranchComparison", () => {

    it("fetches all of a tenant's branches for the resolved range", async () => {

        const result = await AnalyticsService.getBranchComparison(1, "2026-01-01", "2026-01-31");

        expect(result.success).toBe(true);
        expect(AnalyticsRepository.getBranchComparison).toHaveBeenCalledWith(1, expect.any(Date), expect.any(Date));

    });

});

describe("AnalyticsService.getOverview - cogs", () => {

    it("folds the COGS summary into the overview response", async () => {

        AnalyticsRepository.getCogsSummary.mockResolvedValue({ CogsValue: 450.5, WastageValue: 30, IngredientsMissingCost: 2 });

        const result = await AnalyticsService.getOverview(1, null, undefined, undefined);

        expect(result.data.cogs).toEqual({ CogsValue: 450.5, WastageValue: 30, IngredientsMissingCost: 2 });

    });

});

describe("AnalyticsService.getMenuProfitability", () => {

    it("rejects a branch that doesn't belong to the caller's tenant", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 1, TenantId: 999 });

        const result = await AnalyticsService.getMenuProfitability(1, 1);

        expect(result.success).toBe(false);
        expect(AnalyticsRepository.getMenuItemProfitability).not.toHaveBeenCalled();

    });

    it("requires a branchId - menu items can't be meaningfully aggregated across branches", async () => {

        const result = await AnalyticsService.getMenuProfitability(null, 1);

        expect(result.success).toBe(false);

    });

    it("computes margin and margin percent when every ingredient has a cost", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 1, TenantId: 1 });
        AnalyticsRepository.getMenuItemProfitability.mockResolvedValue([
            { MenuItemId: 1, ItemName: "Veg Fried Rice", Price: "200.00", IngredientCost: "80.00" }
        ]);

        const result = await AnalyticsService.getMenuProfitability(1, 1);

        expect(result.success).toBe(true);
        expect(result.data[0]).toEqual(
            expect.objectContaining({ IngredientCost: 80, Margin: 120, MarginPercent: 60 })
        );

    });

    it("carries a null ingredient cost through as null margin, not a wrong 0", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 1, TenantId: 1 });
        // The repository returns IngredientCost: null when any recipe
        // ingredient has no CostPerBaseUnit set (SQL NULL propagation
        // through the SUM) - this must NOT be treated as "cost is 0",
        // which would show a fabricated 100% margin.
        AnalyticsRepository.getMenuItemProfitability.mockResolvedValue([
            { MenuItemId: 2, ItemName: "Butter Chicken", Price: "350.00", IngredientCost: null }
        ]);

        const result = await AnalyticsService.getMenuProfitability(1, 1);

        expect(result.data[0]).toEqual(
            expect.objectContaining({ IngredientCost: null, Margin: null, MarginPercent: null })
        );

    });

});

describe("AnalyticsService.getTaxSummary", () => {

    it("sums the daily rows into a totals object", async () => {

        AnalyticsRepository.getTaxSummary.mockResolvedValue([
            { Date: "2026-01-01", SubTotal: 100, DiscountAmount: 0, CgstAmount: 2.5, SgstAmount: 2.5, TotalAmount: 105, OrderCount: 2 },
            { Date: "2026-01-02", SubTotal: 200, DiscountAmount: 10, CgstAmount: 4.75, SgstAmount: 4.75, TotalAmount: 199.5, OrderCount: 3 }
        ]);

        const result = await AnalyticsService.getTaxSummary(1, null, "2026-01-01", "2026-01-02");

        expect(result.success).toBe(true);
        expect(result.data.totals).toEqual({
            SubTotal: 300, DiscountAmount: 10, CgstAmount: 7.25, SgstAmount: 7.25, TotalAmount: 304.5, OrderCount: 5
        });

    });

});

describe("AnalyticsService.getPaymentBreakdown", () => {

    it("passes the resolved range through to the repository", async () => {

        AnalyticsRepository.getPaymentBreakdown.mockResolvedValue([{ PaymentMethod: "Cash", OrderCount: 5, Revenue: 500 }]);

        const result = await AnalyticsService.getPaymentBreakdown(1, null, "2026-01-01", "2026-01-31");

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);

    });

});

describe("AnalyticsService.getSalesSummary", () => {

    it("sums daily rows into totals and derives AOV from completed orders only", async () => {

        AnalyticsRepository.getSalesSummary.mockResolvedValue([
            { Date: "2026-01-01", TotalOrders: 10, CancelledOrders: 2, GrossSales: 800, AvgOrderValue: 100 },
            { Date: "2026-01-02", TotalOrders: 5, CancelledOrders: 0, GrossSales: 500, AvgOrderValue: 100 }
        ]);

        const result = await AnalyticsService.getSalesSummary(1, null, "2026-01-01", "2026-01-02");

        expect(result.success).toBe(true);
        expect(result.data.totals.TotalOrders).toBe(15);
        expect(result.data.totals.CancelledOrders).toBe(2);
        expect(result.data.totals.GrossSales).toBe(1300);
        // 13 completed orders (15 total - 2 cancelled), not 15 - a
        // cancelled order contributed nothing to GrossSales and shouldn't
        // dilute the average either.
        expect(result.data.totals.AvgOrderValue).toBeCloseTo(1300 / 13);

    });

    it("doesn't divide by zero when every order in range was cancelled", async () => {

        AnalyticsRepository.getSalesSummary.mockResolvedValue([
            { Date: "2026-01-01", TotalOrders: 3, CancelledOrders: 3, GrossSales: 0, AvgOrderValue: 0 }
        ]);

        const result = await AnalyticsService.getSalesSummary(1, null, "2026-01-01", "2026-01-01");

        expect(result.data.totals.AvgOrderValue).toBe(0);

    });

});

describe("AnalyticsService.getCategorySales", () => {

    it("passes the resolved range through to the repository", async () => {

        AnalyticsRepository.getCategorySales.mockResolvedValue([
            { CategoryId: 1, CategoryName: "Starters", QuantitySold: 20, Revenue: 4000 }
        ]);

        const result = await AnalyticsService.getCategorySales(1, null, "2026-01-01", "2026-01-31");

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);

    });

});

describe("AnalyticsService.getCouponUsage", () => {

    it("passes the resolved range through to the repository", async () => {

        AnalyticsRepository.getCouponUsage.mockResolvedValue([
            { CouponId: 1, Code: "WELCOME10", TimesUsed: 4, TotalDiscount: 400, RevenueFromOrders: 3600 }
        ]);

        const result = await AnalyticsService.getCouponUsage(1, null, "2026-01-01", "2026-01-31");

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);

    });

});

describe("AnalyticsService.getCancelledOrders", () => {

    it("computes the total value of cancelled orders in range", async () => {

        AnalyticsRepository.getCancelledOrders.mockResolvedValue([
            { OrderId: 1, OrderDate: "2026-01-01", TotalAmount: 250, PaymentMethod: "Cash", DeliveryType: "Delivery" },
            { OrderId: 2, OrderDate: "2026-01-02", TotalAmount: 150, PaymentMethod: "UPI", DeliveryType: "Takeaway" }
        ]);

        const result = await AnalyticsService.getCancelledOrders(1, null, "2026-01-01", "2026-01-02");

        expect(result.success).toBe(true);
        expect(result.data.orders).toHaveLength(2);
        expect(result.data.totalValue).toBe(400);

    });

    it("reports zero total value when there are no cancelled orders in range", async () => {

        AnalyticsRepository.getCancelledOrders.mockResolvedValue([]);

        const result = await AnalyticsService.getCancelledOrders(1, null, "2026-01-01", "2026-01-01");

        expect(result.data.totalValue).toBe(0);

    });

});
