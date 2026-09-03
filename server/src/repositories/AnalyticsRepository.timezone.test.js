import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getRevenueTrend, getPeakHours, getTaxSummary, getSalesSummary } = await import("./AnalyticsRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
});

// O."OrderDate" is a naive "timestamp without time zone" holding a real UTC
// instant (NOW()'s underlying instant, not a session-timezone label) -
// confirmed to differ between environments (local dev's DB session
// timezone is Asia/Calcutta, production's is GMT), so bucketing by a raw
// DATE()/EXTRACT(HOUR) on the column groups by the UTC calendar day/hour,
// not the IST one every restaurant here actually operates in. Every
// bucketing query needs the fixed +5:30 IST correction before grouping.
describe("AnalyticsRepository - day/hour bucketing is IST-corrected", () => {

    it("getRevenueTrend groups by the IST calendar day, not the raw UTC one", async () => {

        await getRevenueTrend(1, null, new Date(), new Date());

        const [sql] = queryMock.mock.calls[0];

        expect(sql).not.toMatch(/DATE\(O\."OrderDate"\)/);
        expect(sql).toMatch(/DATE\(\(O\."OrderDate" \+ INTERVAL '5 hours 30 minutes'\)\)/);

    });

    it("getPeakHours extracts the IST hour, not the raw UTC one", async () => {

        await getPeakHours(1, null, new Date(), new Date());

        const [sql] = queryMock.mock.calls[0];

        expect(sql).not.toMatch(/EXTRACT\(HOUR FROM O\."OrderDate"\)/);
        expect(sql).toMatch(/EXTRACT\(HOUR FROM \(O\."OrderDate" \+ INTERVAL '5 hours 30 minutes'\)\)/);

    });

    it("getTaxSummary groups by the IST calendar day", async () => {

        await getTaxSummary(1, null, new Date(), new Date());

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/DATE\(\(O\."OrderDate" \+ INTERVAL '5 hours 30 minutes'\)\)/);

    });

    it("getSalesSummary groups by the IST calendar day", async () => {

        await getSalesSummary(1, null, new Date(), new Date());

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/DATE\(\(O\."OrderDate" \+ INTERVAL '5 hours 30 minutes'\)\)/);

    });

});
