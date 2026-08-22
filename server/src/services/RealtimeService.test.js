import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/pusher.js");

const { getPusherClient } = await import("../config/pusher.js");
const { publishOrderCreated } = await import("./RealtimeService.js");

beforeEach(() => {
    vi.clearAllMocks();
});

// Regression test for a real UX bug found via live verification: the
// captain who just placed an order at the POS screen was also seeing the
// branch-wide "New order received" toast + sound fire for their own order
// a moment later, stacking on top of the order's own "Order placed" toast
// and the KOT dialog's success banner - three redundant confirmations for
// one action. createdByAdminId is what the frontend needs to tell "someone
// else's order" apart from "my own order" and skip the echo.
describe("RealtimeService.publishOrderCreated", () => {

    it("includes createdByAdminId in the published payload, from the order", async () => {

        const trigger = vi.fn().mockResolvedValue();
        getPusherClient.mockReturnValue({ trigger });

        await publishOrderCreated({
            OrderId: 324, BranchId: 1, CustomerId: 9, OrderStatus: "Pending", CreatedByAdminId: 3
        });

        expect(trigger).toHaveBeenCalledWith(
            "private-branch-1",
            "order:created",
            expect.objectContaining({ orderId: 324, createdByAdminId: 3 })
        );

    });

    it("publishes createdByAdminId: null for a customer-placed order (no staff attribution to spoof)", async () => {

        const trigger = vi.fn().mockResolvedValue();
        getPusherClient.mockReturnValue({ trigger });

        await publishOrderCreated({ OrderId: 500, BranchId: 1, CustomerId: 9, OrderStatus: "Pending" });

        expect(trigger).toHaveBeenCalledWith(
            "private-branch-1",
            "order:created",
            expect.objectContaining({ createdByAdminId: null })
        );

    });

});
