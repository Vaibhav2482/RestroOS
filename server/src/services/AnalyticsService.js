import * as AnalyticsRepository from "../repositories/AnalyticsRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

const MAX_RANGE_DAYS = 366;

// Every restaurant on this app is India-based (IST, UTC+5:30, no DST) - a
// "YYYY-MM-DD" from/to here always means an IST calendar day, and the
// frontend already builds that string from the browser's own local date
// components for exactly this reason (see tenant-admin's
// toDateInputValue). Orders."OrderDate" is a plain "timestamp without time
// zone" column filled from NOW() - what actually lands in it is a naive
// value holding a real UTC instant (confirmed against both databases:
// local dev's session timezone is Asia/Calcutta, production's is GMT, so
// the ONE thing that's actually portable between them is that NOW()'s
// underlying instant, not its wall-clock label, is what gets stored).
// Parsing "YYYY-MM-DD" as UTC midnight - what this used to do - silently
// queried a window shifted 5.5 hours from the IST day the caller actually
// asked for, the same way AnalyticsRepository's DATE()/EXTRACT(HOUR)
// bucketing needed its own IST correction (see there).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// "YYYY-MM-DD" -> the UTC instant that IST midnight on that calendar day
// actually falls at (e.g. "2026-01-01" -> 2025-12-31T18:30:00.000Z).
const parseAsIstMidnight = (dateStr) => new Date(Date.parse(`${dateStr}T00:00:00Z`) - IST_OFFSET_MS);

// Today's date as an IST calendar-day string - shifting the current
// instant forward by the IST offset before reading its UTC calendar date
// yields the IST wall-clock date, since Node has no timezone-aware date
// formatting built in without pulling in Intl machinery for it.
const todayInIst = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

// [from, to) - "to" is inclusive from the caller's perspective (a calendar
// day), so it's pushed to the start of the *next* IST day here rather than
// asking every query to reason about end-of-day timestamps.
const resolveDateRange = (fromInput, toInput) => {

    const to = parseAsIstMidnight(toInput || todayInIst());

    if (Number.isNaN(to.getTime())) {
        return { error: "Invalid \"to\" date." };
    }

    to.setTime(to.getTime() + 24 * 60 * 60 * 1000);

    const from = fromInput ? parseAsIstMidnight(fromInput) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime())) {
        return { error: "Invalid \"from\" date." };
    }

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

export const getSalesSummary = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const daily = await AnalyticsRepository.getSalesSummary(tenantId, branchId, from, to);

    const totals = daily.reduce((sum, row) => ({
        TotalOrders: sum.TotalOrders + Number(row.TotalOrders),
        CancelledOrders: sum.CancelledOrders + Number(row.CancelledOrders),
        GrossSales: sum.GrossSales + Number(row.GrossSales)
    }), { TotalOrders: 0, CancelledOrders: 0, GrossSales: 0 });

    const completedOrders = totals.TotalOrders - totals.CancelledOrders;

    totals.AvgOrderValue = completedOrders > 0 ? totals.GrossSales / completedOrders : 0;

    return { success: true, message: "Sales summary fetched successfully.", data: { daily, totals } };

};

export const getCategorySales = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const categories = await AnalyticsRepository.getCategorySales(tenantId, branchId, from, to);

    return { success: true, message: "Category sales fetched successfully.", data: categories };

};

export const getStaffSales = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const staff = await AnalyticsRepository.getStaffSales(tenantId, branchId, from, to);

    return { success: true, message: "Staff sales fetched successfully.", data: staff };

};

export const getCouponUsage = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const coupons = await AnalyticsRepository.getCouponUsage(tenantId, branchId, from, to);

    return { success: true, message: "Coupon usage fetched successfully.", data: coupons };

};

export const getCancelledOrders = async (tenantId, branchId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const orders = await AnalyticsRepository.getCancelledOrders(tenantId, branchId, from, to);

    const totalValue = orders.reduce((sum, order) => sum + Number(order.TotalAmount), 0);

    return { success: true, message: "Cancelled orders fetched successfully.", data: { orders, totalValue } };

};

export const getBranchComparison = async (tenantId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const branches = await AnalyticsRepository.getBranchComparison(tenantId, from, to);

    return { success: true, message: "Branch comparison fetched successfully.", data: branches };

};

// The single most standard POS report there is - everything a shift needs
// to close out and reconcile against the till, for exactly one calendar
// day rather than a range. Deliberately built by calling the same
// functions every other tab already uses (same date-string in as both
// "from" and "to") rather than duplicating any of their SQL - the day
// resolves through the exact same IST-aware resolveDateRange each of them
// already goes through, so this can never silently disagree with what the
// individual Sales Summary/Tax Summary/Payment Breakdown/Staff Sales tabs
// show for the same day.
export const getDayEndSummary = async (tenantId, branchId, dateInput) => {

    // Defaulted here, not left to resolveDateRange - passing undefined
    // through as both "from" and "to" would trigger every other report's
    // own default (the last 30 days), not the single day this report is
    // for.
    const date = dateInput || todayInIst();

    const [salesResult, taxResult, paymentResult, staffResult] = await Promise.all([
        getSalesSummary(tenantId, branchId, date, date),
        getTaxSummary(tenantId, branchId, date, date),
        getPaymentBreakdown(tenantId, branchId, date, date),
        getStaffSales(tenantId, branchId, date, date)
    ]);

    const failed = [salesResult, taxResult, paymentResult, staffResult].find((result) => !result.success);

    if (failed) {
        return failed;
    }

    return {
        success: true,
        message: "Day-end summary fetched successfully.",
        data: {
            date,
            sales: salesResult.data.totals,
            tax: taxResult.data.totals,
            payments: paymentResult.data,
            staff: staffResult.data
        }
    };

};
