import * as AnalyticsRepository from "../repositories/AnalyticsRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

const MAX_RANGE_DAYS = 366;

// [from, to) - "to" is inclusive from the caller's perspective (a calendar
// day), so it's pushed to the start of the next day here rather than
// asking every query to reason about end-of-day timestamps. Uses UTC
// methods throughout (not setHours/getDate, which read the server
// process's local timezone) - a Vercel serverless function's local
// timezone isn't guaranteed, so mixing that with a "YYYY-MM-DD" input
// (always parsed as UTC midnight) silently shifted the range by whatever
// the host's UTC offset happened to be.
const resolveDateRange = (fromInput, toInput) => {

    const to = toInput ? new Date(toInput) : new Date();

    if (Number.isNaN(to.getTime())) {
        return { error: "Invalid \"to\" date." };
    }

    to.setUTCHours(0, 0, 0, 0);
    to.setUTCDate(to.getUTCDate() + 1);

    const from = fromInput ? new Date(fromInput) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime())) {
        return { error: "Invalid \"from\" date." };
    }

    from.setUTCHours(0, 0, 0, 0);

    if (from >= to) {
        return { error: "\"from\" must be before \"to\"." };
    }

    if ((to - from) / (24 * 60 * 60 * 1000) > MAX_RANGE_DAYS) {
        return { error: `Date range can't exceed ${MAX_RANGE_DAYS} days.` };
    }

    return { from, to };

};

export const getOverview = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const [summary, revenueTrend, topItems, peakHours, cogs] = await Promise.all([
        AnalyticsRepository.getSummary(tenantId, branchId, from, to),
        AnalyticsRepository.getRevenueTrend(tenantId, branchId, from, to),
        AnalyticsRepository.getTopItems(tenantId, branchId, from, to, 10),
        AnalyticsRepository.getPeakHours(tenantId, branchId, from, to),
        AnalyticsRepository.getCogsSummary(tenantId, branchId, from, to)
    ]);

    return {
        success: true,
        message: "Analytics fetched successfully.",
        data: { summary, revenueTrend, topItems, peakHours, cogs }
    };

};

// Per-branch only - see getMenuItemProfitability's own comment for why
// "all branches" isn't offered here.
export const getMenuProfitability = async (branchId, tenantId) => {

    if (!branchId) {
        return { success: false, message: "Branch Id is required." };
    }

    const branch = await BranchRepository.getBranchById(branchId);

    if (!branch || branch.TenantId !== tenantId) {
        return { success: false, message: "Branch not found." };
    }

    const rows = await AnalyticsRepository.getMenuItemProfitability(branchId);

    // Margin/MarginPercent are only computable when every ingredient in
    // the recipe has a cost set - IngredientCost arrives as null from the
    // repository in that case (SQL NULL propagation through the SUM), and
    // that null is deliberately carried through here rather than treated
    // as 0, so the frontend can show "cost incomplete" instead of a wrong
    // margin.
    const items = rows.map((row) => {

        const price = Number(row.Price);
        const ingredientCost = row.IngredientCost === null ? null : Number(row.IngredientCost);
        const margin = ingredientCost === null ? null : price - ingredientCost;
        const marginPercent = margin === null || price === 0 ? null : (margin / price) * 100;

        return {
            MenuItemId: row.MenuItemId,
            ItemName: row.ItemName,
            Price: price,
            IngredientCost: ingredientCost,
            Margin: margin,
            MarginPercent: marginPercent
        };

    });

    return { success: true, message: "Menu item profitability fetched successfully.", data: items };

};

export const getTaxSummary = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const daily = await AnalyticsRepository.getTaxSummary(tenantId, branchId, from, to);

    const totals = daily.reduce((sum, row) => ({
        SubTotal: sum.SubTotal + Number(row.SubTotal),
        DiscountAmount: sum.DiscountAmount + Number(row.DiscountAmount),
        CgstAmount: sum.CgstAmount + Number(row.CgstAmount),
        SgstAmount: sum.SgstAmount + Number(row.SgstAmount),
        TotalAmount: sum.TotalAmount + Number(row.TotalAmount),
        OrderCount: sum.OrderCount + Number(row.OrderCount)
    }), { SubTotal: 0, DiscountAmount: 0, CgstAmount: 0, SgstAmount: 0, TotalAmount: 0, OrderCount: 0 });

    return { success: true, message: "Tax summary fetched successfully.", data: { daily, totals } };

};

export const getPaymentBreakdown = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const breakdown = await AnalyticsRepository.getPaymentBreakdown(tenantId, branchId, from, to);

    return { success: true, message: "Payment breakdown fetched successfully.", data: breakdown };

};

export const getBranchComparison = async (tenantId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const branches = await AnalyticsRepository.getBranchComparison(tenantId, from, to);

    return { success: true, message: "Branch comparison fetched successfully.", data: branches };

};
