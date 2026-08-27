import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository's other transactional tests (see
// OrderRepository.statusTransition.test.js) - stub the client this function
// BEGINs a transaction on, so this exercises the real Payments-row insert
// with no actual database involved. resolveMenuItemOptions/resolveCoupon are
// called directly (not through client.query), so they're mocked at the
// module level rather than sequenced as query calls.
const clientQueryMock = vi.fn();
const clientReleaseMock = vi.fn();

vi.mock("../config/db.js", () => ({
    default: {
        query: vi.fn(),
        connect: vi.fn(async () => ({ query: clientQueryMock, release: clientReleaseMock }))
    }
}));

vi.mock("../utils/menuOptionResolver.js", () => ({
    resolveMenuItemOptions: vi.fn(async () => ({ priceDelta: 0, selectedOptions: [] }))
}));

vi.mock("../utils/couponResolver.js", () => ({
    resolveCoupon: vi.fn(async () => ({ discountAmount: 0, couponId: null }))
}));

const { createOrder } = await import("./OrderRepository.js");

beforeEach(() => {
    clientQueryMock.mockReset();
    clientReleaseMock.mockReset();
});

const TAKEAWAY_ORDER = {
    customerId: 1,
    deliveryType: "Takeaway",
    items: [{ menuItemId: 10, quantity: 1, selectedOptionIds: [] }]
};

// Queues the full sequence of client.query calls a Takeaway order's
// transaction makes before/around the Payments-row question: BEGIN,
// customer check, menu item check, the Orders insert itself, the OrderItems
// insert, the final select, and COMMIT. Takeaway has no address check and no
// table visit lookup, keeping this to the minimum real sequence.
const queueBaseSequence = () => {

    clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [{ TenantId: 1 }] }); // customer check
    clientQueryMock.mockResolvedValueOnce({
        rows: [{ MenuItemId: 10, BranchId: 5, ItemName: "Tea", Price: 30, TaxRatePercent: 5, TenantId: 1 }]
    }); // menu item check
    clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 100 }] }); // Orders insert

};

describe("OrderRepository.createOrder - Payments row for staff-created Card/UPI orders", () => {

    it("inserts a Paid Payments row for a staff Card order", async () => {

        queueBaseSequence();
        clientQueryMock.mockResolvedValueOnce(undefined); // Payments insert
        clientQueryMock.mockResolvedValueOnce(undefined); // OrderItems insert
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 100 }] }); // final select
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        await createOrder({ ...TAKEAWAY_ORDER, paymentMethod: "Card", createdByAdminId: 7 });

        const paymentsInsertCall = clientQueryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO "Payments"'));

        expect(paymentsInsertCall).toBeDefined();
        expect(paymentsInsertCall[0]).toContain("'Paid'");
        expect(paymentsInsertCall[1]).toEqual([100, "Card", 31.5]);

    });

    it("inserts a Paid Payments row for a staff UPI order", async () => {

        queueBaseSequence();
        clientQueryMock.mockResolvedValueOnce(undefined); // Payments insert
        clientQueryMock.mockResolvedValueOnce(undefined); // OrderItems insert
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 100 }] }); // final select
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        await createOrder({ ...TAKEAWAY_ORDER, paymentMethod: "UPI", createdByAdminId: 7 });

        const paymentsInsertCall = clientQueryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO "Payments"'));

        expect(paymentsInsertCall).toBeDefined();

    });

    it("does not insert a Payments row for a staff Cash order - Cash is never gated", async () => {

        queueBaseSequence();
        clientQueryMock.mockResolvedValueOnce(undefined); // OrderItems insert
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 100 }] }); // final select
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        await createOrder({ ...TAKEAWAY_ORDER, paymentMethod: "Cash", createdByAdminId: 7 });

        const paymentsInsertCall = clientQueryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO "Payments"'));

        expect(paymentsInsertCall).toBeUndefined();

    });

    // A customer's own Card/UPI order (createdByAdminId null) goes through
    // storefront's separate Razorpay checkout flow after this call returns -
    // this insert must not fire for it, or the payment gate would think a
    // customer order was already paid before Razorpay ever confirmed it.
    it("does not insert a Payments row for a customer's own Card order", async () => {

        queueBaseSequence();
        clientQueryMock.mockResolvedValueOnce(undefined); // OrderItems insert
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 100 }] }); // final select
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        await createOrder({ ...TAKEAWAY_ORDER, paymentMethod: "Card", createdByAdminId: null });

        const paymentsInsertCall = clientQueryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO "Payments"'));

        expect(paymentsInsertCall).toBeUndefined();

    });

});
