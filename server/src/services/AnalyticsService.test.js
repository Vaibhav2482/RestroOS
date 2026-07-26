import { describe, it, expect, vi, beforeEach } from "vitest";

import * as AnalyticsService from "./AnalyticsService.js";
import * as AnalyticsRepository from "../repositories/AnalyticsRepository.js";

vi.mock("../repositories/AnalyticsRepository.js");

beforeEach(() => {

    vi.clearAllMocks();

    AnalyticsRepository.getSummary.mockResolvedValue({ Revenue: 1000, OrderCount: 10, AvgOrderValue: 100 });
    AnalyticsRepository.getRevenueTrend.mockResolvedValue([]);
    AnalyticsRepository.getTopItems.mockResolvedValue([]);
    AnalyticsRepository.getPeakHours.mockResolvedValue([]);
    AnalyticsRepository.getBranchComparison.mockResolvedValue([]);

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
