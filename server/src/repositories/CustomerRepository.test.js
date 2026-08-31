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

// Mirrors OrderRepository.getAllOrders' own opt-in pagination branch - no
// pagination argument keeps the full-array shape above unchanged for the
// one caller (CustomerService.getAllCustomers) that doesn't pass it yet.
describe("CustomerRepository.getAllCustomersByTenant - pagination/search", () => {

    it("returns { customers, total } and reads the total off TotalCount, not row count", async () => {

        queryMock.mockResolvedValue({
            rows: [
                { CustomerId: 1, FullName: "A", OrderCount: 2, TotalSpent: 100, TotalCount: 47 },
                { CustomerId: 2, FullName: "B", OrderCount: 0, TotalSpent: 0, TotalCount: 47 }
            ]
        });

        const result = await getAllCustomersByTenant(9, { page: 1, limit: 2 });

        expect(result.total).toBe(47);
        expect(result.customers).toEqual([
            { CustomerId: 1, FullName: "A", OrderCount: 2, TotalSpent: 100 },
            { CustomerId: 2, FullName: "B", OrderCount: 0, TotalSpent: 0 }
        ]);

    });

    it("filters by name, phone, or email via the same search param", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllCustomersByTenant(9, { page: 1, limit: 25 }, { search: "  9876  " });

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/C\."FullName" ILIKE '%' \|\| \$2 \|\| '%' OR C\."Phone" ILIKE '%' \|\| \$2 \|\| '%' OR C\."Email" ILIKE '%' \|\| \$2 \|\| '%'/);
        // Trimmed before being sent as a query param.
        expect(params).toEqual([9, "9876", 25, 0]);

    });

    it("computes LIMIT/OFFSET from page and limit", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getAllCustomersByTenant(9, { page: 3, limit: 10 });

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LIMIT \$3 OFFSET \$4/);
        expect(params).toEqual([9, null, 10, 20]);

    });

});
