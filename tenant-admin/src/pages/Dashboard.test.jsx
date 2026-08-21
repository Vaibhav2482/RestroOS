import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Dashboard from "./Dashboard";
import * as orderService from "../services/orderService";

vi.mock("../services/orderService");

const withoutOrders = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, FullName: "Test Staff", Permissions: ["manage_menu"] }
};

const withOrders = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, FullName: "Test Staff", Permissions: ["manage_orders"] }
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Dashboard - degrades gracefully without manage_orders", () => {

    it("never calls the dashboard summary endpoint and shows a plain message when manage_orders isn't granted", async () => {

        localStorage.setItem("tenantAdmin", JSON.stringify(withoutOrders));

        render(<Dashboard />);

        expect(await screen.findByText(/don't have access to order data/i)).toBeInTheDocument();
        expect(orderService.getDashboardSummary).not.toHaveBeenCalled();

    });

    it("loads and shows order stats normally when manage_orders is granted", async () => {

        localStorage.setItem("tenantAdmin", JSON.stringify(withOrders));
        orderService.getDashboardSummary.mockResolvedValue({
            success: true,
            data: {
                totalOrders: 1,
                activeOrders: 1,
                todaysRevenue: 100,
                recentOrders: [{ OrderId: 1, OrderStatus: "Pending", TotalAmount: 100, OrderDate: new Date().toISOString(), CustomerName: "A", DeliveryType: "Dine In" }]
            }
        });

        render(<Dashboard />);

        expect(await screen.findByText("Total Orders")).toBeInTheDocument();
        expect(orderService.getDashboardSummary).toHaveBeenCalled();

    });

});
