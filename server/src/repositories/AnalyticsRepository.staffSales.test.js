import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getStaffSales } = await import("./AnalyticsRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
});

// A customer's own storefront order has no staff member on it at all
// (CreatedByAdminId null) - LEFT JOIN (not INNER) is what keeps those
// orders in the report as their own "Customer (Online)" group instead of
// silently vanishing, so this report's total still reconciles with Sales
// Summary's for the same range.
describe("AnalyticsRepository.getStaffSales", () => {

    it("left-joins Admins so a customer's own order isn't dropped from the report", async () => {

        await getStaffSales(1, null, new Date(), new Date());

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LEFT JOIN "Admins"/);
        expect(sql).not.toMatch(/INNER JOIN "Admins"/);
        expect(sql).toMatch(/COALESCE\(A\."FullName", 'Customer \(Online\)'\)/);
        expect(sql).toMatch(/GROUP BY O\."CreatedByAdminId", A\."FullName"/);
        expect(params).toEqual([1, null, expect.any(Date), expect.any(Date)]);

    });

    it("excludes Cancelled orders, same as every other revenue report", async () => {

        await getStaffSales(1, null, new Date(), new Date());

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"OrderStatus" <> 'Cancelled'/);

    });

});
