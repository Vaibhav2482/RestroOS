import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const { getKitchenOrders } = await import("./OrderRepository.js");

beforeEach(() => {
    queryMock.mockReset();
});

// The Kitchen board's "Start Preparing"/"Mark Ready" buttons need
// PaymentMethod/LatestPaymentStatus to run the same client-side payment-
// confirmation check Orders.jsx's quick-advance button already does (see
// orderStatusUtils.hasStartedPreparing) - without these columns, every
// order here had PaymentMethod/LatestPaymentStatus undefined, so a Card/UPI
// order with no confirmed payment could still be tapped, only to fail with
// a bare error toast after the round trip once the server's own gate
// rejected it.
describe("OrderRepository.getKitchenOrders - payment fields for the client-side gate", () => {

    it("selects PaymentMethod and the latest PaymentStatus alongside the ticket data", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getKitchenOrders(5);

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/O\."PaymentMethod"/);
        expect(sql).toMatch(/SELECT "PaymentStatus" FROM "Payments" WHERE "OrderId" = O\."OrderId" ORDER BY "PaymentDate" DESC LIMIT 1\) AS "LatestPaymentStatus"/);
        expect(params).toEqual([5]);

    });

    it("still scopes to the branch's active kitchen statuses, same as before", async () => {

        queryMock.mockResolvedValue({ rows: [] });

        await getKitchenOrders(5);

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/"OrderStatus" IN \('Pending', 'Accepted', 'Preparing', 'Ready'\)/);

    });

});
