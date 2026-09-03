import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Kitchen from "./Kitchen";
import * as orderService from "../services/orderService";

vi.mock("../services/orderService");

// A non-owner (branch-scoped) admin skips the branch-loading path entirely,
// same trick Orders.test.jsx uses to avoid also mocking branchService.
const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, Email: "staff@test.com", tenantName: "Chai Chakhna" }
};

const baseOrder = (overrides) => ({
    OrderId: 1,
    DeliveryType: "Takeaway",
    OrderStatus: "Pending",
    OrderDate: new Date().toISOString(),
    Items: [],
    ...overrides
});

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));

});

describe("Kitchen - payment-confirmation guard", () => {

    // Mirrors Orders.jsx's quick-advance guard - the backend blocks a
    // Card/UPI order from reaching Preparing (or anything past it) without a
    // confirmed payment. This used to just fail with a bare error toast
    // after the round trip; it should now be disabled up front instead.
    it("disables Start Preparing for a Pending Card order with no confirmed payment", async () => {

        orderService.getKitchenOrders.mockResolvedValue({
            success: true,
            data: [baseOrder({ OrderId: 10, OrderStatus: "Pending", PaymentMethod: "Card", LatestPaymentStatus: "Pending" })]
        });

        render(<Kitchen />);

        await screen.findByText("#10");

        expect(screen.getByRole("button", { name: /^start preparing$/i })).toBeDisabled();

    });

    it("does not disable Start Preparing for a Cash order", async () => {

        orderService.getKitchenOrders.mockResolvedValue({
            success: true,
            data: [baseOrder({ OrderId: 11, OrderStatus: "Pending", PaymentMethod: "Cash", LatestPaymentStatus: null })]
        });

        render(<Kitchen />);

        await screen.findByText("#11");

        expect(screen.getByRole("button", { name: /^start preparing$/i })).not.toBeDisabled();

    });

    it("does not disable Start Preparing once the Card payment is confirmed", async () => {

        orderService.getKitchenOrders.mockResolvedValue({
            success: true,
            data: [baseOrder({ OrderId: 12, OrderStatus: "Pending", PaymentMethod: "Card", LatestPaymentStatus: "Paid" })]
        });

        render(<Kitchen />);

        await screen.findByText("#12");

        expect(screen.getByRole("button", { name: /^start preparing$/i })).not.toBeDisabled();

    });

    // Mark Ready on an Accepted (not yet Preparing) ticket jumps straight
    // over Preparing - the same server gate fires for that jump too, so
    // this needs the same guard as Start Preparing, not just that button.
    it("disables Mark Ready for an Accepted UPI order with no confirmed payment", async () => {

        orderService.getKitchenOrders.mockResolvedValue({
            success: true,
            data: [baseOrder({ OrderId: 13, OrderStatus: "Accepted", PaymentMethod: "UPI", LatestPaymentStatus: "Failed" })]
        });

        render(<Kitchen />);

        await screen.findByText("#13");

        expect(screen.getByRole("button", { name: /^mark ready$/i })).toBeDisabled();

    });

});
