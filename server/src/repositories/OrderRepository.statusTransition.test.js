import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as OrderRepository's other transactional tests (see
// TableVisitRepository.test.js) - stub the client this function BEGINs a
// transaction on, so this exercises the real terminal-status guard and
// forward-only sequence validation with no actual database involved.
const clientQueryMock = vi.fn();
const clientReleaseMock = vi.fn();

vi.mock("../config/db.js", () => ({
    default: {
        query: vi.fn(),
        connect: vi.fn(async () => ({ query: clientQueryMock, release: clientReleaseMock }))
    }
}));

const { updateOrderStatus } = await import("./OrderRepository.js");

beforeEach(() => {
    clientQueryMock.mockReset();
    clientReleaseMock.mockReset();
});

// The terminal-status guard (OrderRepository.js ~line 550) used to check
// literal equality against "Delivered"/"Cancelled" only - a Dine In order
// resting at its own terminal status "Served" (or a Takeaway order at
// "Picked Up") wasn't recognized as finished by that specific guard, even
// though the forward-only sequence check below it would separately have
// blocked any further move anyway. This test exercises that guard directly
// per channel, since nothing else in the suite did before.
describe("OrderRepository.updateOrderStatus - terminal status guard, per channel", () => {

    it("rejects any further move on a Dine In order already Served", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Served", DeliveryType: "Dine In" }] }); // SELECT ... FOR UPDATE
        clientQueryMock.mockResolvedValueOnce(undefined); // ROLLBACK

        await expect(updateOrderStatus(1, "Served", null)).rejects.toThrow(
            "This order is already finished and cannot be updated."
        );

        expect(clientQueryMock).toHaveBeenCalledWith("ROLLBACK");

    });

    it("rejects any further move on a Takeaway order already Picked Up", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Picked Up", DeliveryType: "Takeaway" }] });
        clientQueryMock.mockResolvedValueOnce(undefined); // ROLLBACK

        await expect(updateOrderStatus(2, "Picked Up", null)).rejects.toThrow(
            "This order is already finished and cannot be updated."
        );

    });

    it("allows a Dine In order to move from Ready to Served", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Ready", DeliveryType: "Dine In" }] });
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 3, OrderStatus: "Served", DeliveryType: "Dine In" }] }); // UPDATE ... RETURNING
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        const result = await updateOrderStatus(3, "Served", null);

        expect(result.OrderStatus).toBe("Served");

    });

    it("allows a Takeaway order to move from Ready to Picked Up", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Ready", DeliveryType: "Takeaway" }] });
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderId: 4, OrderStatus: "Picked Up", DeliveryType: "Takeaway" }] });
        clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

        const result = await updateOrderStatus(4, "Picked Up", null);

        expect(result.OrderStatus).toBe("Picked Up");

    });

    it("rejects Delivered as a target status for a Dine In order", async () => {

        clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
        clientQueryMock.mockResolvedValueOnce({ rows: [{ OrderStatus: "Ready", DeliveryType: "Dine In" }] });
        clientQueryMock.mockResolvedValueOnce(undefined); // ROLLBACK

        await expect(updateOrderStatus(5, "Delivered", null)).rejects.toThrow(
            "That status is not valid for this order type."
        );

    });

});
