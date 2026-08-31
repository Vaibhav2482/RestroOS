import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository's own query-shape tests - stub the pool
// this function queries directly, asserting the real SQL rather than
// hitting an actual database.
const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getAllCustomersByTenant } = await import("./CustomerRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

// Regression test: OrderCount used to count every order regardless of
// status while TotalSpent excluded Cancelled ones, so a customer whose
// only order was cancelled showed "1 order, Rs. 0.00 spent" - a number
// that reads as broken, not as "they cancelled everything". Both now use
// the same FILTER.
describe("CustomerRepository.getAllCustomersByTenant - OrderCount/TotalSpent consistency", () => {

    it("excludes Cancelled orders from OrderCount, not just TotalSpent", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllCustomersByTenant(9);

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/COUNT\(O\."OrderId"\) FILTER \(WHERE O\."OrderStatus" <> 'Cancelled'\) AS "OrderCount"/);
        expect(sql).toMatch(/SUM\(O\."TotalAmount"\) FILTER \(WHERE O\."OrderStatus" <> 'Cancelled'\)/);

    });

    it("still left-joins so a customer with zero orders isn't dropped", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllCustomersByTenant(9);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LEFT JOIN "Orders" O/);
        expect(params).toEqual([9]);

    });

});
