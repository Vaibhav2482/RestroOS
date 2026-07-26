import * as AnalyticsRepository from "../repositories/AnalyticsRepository.js";

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

    const [summary, revenueTrend, topItems, peakHours] = await Promise.all([
        AnalyticsRepository.getSummary(tenantId, branchId, from, to),
        AnalyticsRepository.getRevenueTrend(tenantId, branchId, from, to),
        AnalyticsRepository.getTopItems(tenantId, branchId, from, to, 10),
        AnalyticsRepository.getPeakHours(tenantId, branchId, from, to)
    ]);

    return {
        success: true,
        message: "Analytics fetched successfully.",
        data: { summary, revenueTrend, topItems, peakHours }
    };

};

export const getBranchComparison = async (tenantId, fromInput, toInput) => {

    const { from, to, error } = resolveDateRange(fromInput, toInput);

    if (error) {
        return { success: false, message: error };
    }

    const branches = await AnalyticsRepository.getBranchComparison(tenantId, from, to);

    return { success: true, message: "Branch comparison fetched successfully.", data: branches };

};
