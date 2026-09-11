import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getBillDiscounts } = await import("./AnalyticsRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
});

// A manual bill discount (see migration 0037_table_visit_discount) is
// separate from every Orders-based revenue query - this scopes by when the
// TableVisit itself closed, in IST, not by any order's own OrderDate, and
// only ever surfaces visits that actually had one applied.
describe("AnalyticsRepository.getBillDiscounts", () => {

    it("scopes by the visit's own ClosedAt, shifted to IST, not OrderDate", async () => {

        await getBillDiscounts(1, null, new Date(), new Date());

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/V\."ClosedAt" \+ INTERVAL '5 hours 30 minutes'/);
        expect(sql).toMatch(/V\."Status" = 'Closed'/);
        expect(sql).toMatch(/V\."DiscountAmount" > 0/);
        expect(params).toEqual([1, null, expect.any(Date), expect.any(Date)]);

    });

    it("left-joins the discounting admin so a missing/deleted admin doesn't drop the row", async () => {

        await getBillDiscounts(1, 4, new Date(), new Date());

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LEFT JOIN "Admins" A ON A\."AdminId" = V\."DiscountByAdminId"/);
        expect(sql).toMatch(/\$2::int IS NULL OR V\."BranchId" = \$2/);

    });

});
