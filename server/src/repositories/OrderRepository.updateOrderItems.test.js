import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository.statusTransition.test.js - stub the
// client this function BEGINs a transaction on, so this exercises the real
// edit-window status guard with no actual database involved.
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

const { updateOrderItems } = await import("./OrderRepository.js");

beforeEach(() => {
    clientQueryMock.mockReset();
    clientReleaseMock.mockReset();
});

// A staff-placed order (Take Order/POS) now starts at Accepted rather than
// Pending (see OrderRepository.createOrder.test.js's "initial status" suite)
// - this guard used to check for "Pending" alone, which would have locked
// staff out of editing the exact orders createOrder.js's change was about,
// the moment that change shipped.
describe("OrderRepository.updateOrderItems - edit window covers both Pending and Accepted", () => {

    it("allows editing a Pending order (a customer's own, not yet accepted)", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Pending", BranchId: 5, DiscountAmount: 0 }] }); // order check
        clientQueryMock.mockResolvedValueOnce({ rows: [{ MenuItemId: 10, BranchId: 5, ItemName: "Tea", Price: 30 }] }); // menu items
        clientQueryMock.mockResolvedValueOnce(undefined); // DELETE OrderItems
        clientQueryMock.mockResolvedValueOnce(undefined); // INSERT OrderItems
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE Orders totals
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 1, OrderStatus: "Pending" }] }); // final select
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        await expect(updateOrderItems(1, [{ menuItemId: 10, quantity: 2, selectedOptionIds: [] }])).resolves.toBeDefined();

        expect(clientQueryMock).toHaveBeenCalledWith("COMMIT");

    });

    it("allows editing an Accepted order (a staff-placed one, never Pending at all)", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Accepted", BranchId: 5, DiscountAmount: 0 }] }); // order check
        clientQueryMock.mockResolvedValueOnce({ rows: [{ MenuItemId: 10, BranchId: 5, ItemName: "Tea", Price: 30 }] }); // menu items
        clientQueryMock.mockResolvedValueOnce(undefined); // DELETE OrderItems
        clientQueryMock.mockResolvedValueOnce(undefined); // INSERT OrderItems
        clientQueryMock.mockResolvedValueOnce(undefined); // UPDATE Orders totals
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 2, OrderStatus: "Accepted" }] }); // final select
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        await expect(updateOrderItems(2, [{ menuItemId: 10, quantity: 1, selectedOptionIds: [] }])).resolves.toBeDefined();

        expect(clientQueryMock).toHaveBeenCalledWith("COMMIT");

    });

    it("still rejects editing once the kitchen has started (Preparing)", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Preparing", BranchId: 5, DiscountAmount: 0 }] }); // order check
        clientQueryMock.mockResolvedValueOnce(undefined); // ROLLBACK

        await expect(updateOrderItems(3, [{ menuItemId: 10, quantity: 1, selectedOptionIds: [] }])).rejects.toThrow(
            "Only orders not yet in preparation can have their items edited."
        );

        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");

    });

});
