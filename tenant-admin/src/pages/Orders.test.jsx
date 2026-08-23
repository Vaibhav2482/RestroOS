import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Orders from "./Orders";
import * as orderService from "../services/orderService";

vi.mock("../services/orderService");

// A non-owner (branch-scoped) admin skips the branch-loading path entirely,
// which keeps this suite from also needing to mock branchService.
const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, Email: "staff@test.com" }
};

// Dine In/Takeaway's sequence goes straight from Ready to Delivered (no
// "Out For Delivery" step) - keeping #57 as Dine In here means its next
// status is unambiguously "Delivered", matching the assertions below.
const sampleOrders = [
    { OrderId: 62, CustomerName: "Vaibhav Nawale", DeliveryType: "Dine In", TotalAmount: 105, OrderStatus: "Delivered", OrderDate: "2026-07-25T21:00:24", CreatedByAdminName: "Priya Sharma" },
    { OrderId: 57, CustomerName: "Vaibhav Nawale", DeliveryType: "Dine In", TotalAmount: 31.5, OrderStatus: "Ready", OrderDate: "2026-07-25T15:56:30" },
    { OrderId: 56, CustomerName: "Vaibhav Nawale", DeliveryType: "Dine In", TotalAmount: 147, OrderStatus: "Cancelled", OrderDate: "2026-07-25T15:54:36" },
    { OrderId: 70, CustomerName: "New Guest", DeliveryType: "Dine In", TotalAmount: 50, OrderStatus: "Pending", OrderDate: "2026-07-25T22:00:00" }
];

// Orders.jsx now fetches a server-filtered/paginated page rather than
// filtering a full array client-side - this stands in for the real
// backend's GET /orders?page=&limit=&status=&search=&... behavior (see
// OrderRepository.getAllOrders/getOrderStatusCounts), so every existing
// test's user-facing assertions (what shows up after a search/filter) stay
// meaningful without needing to know the request was server-side now.
const mockServerOrders = (allOrders) => {

    orderService.getAllOrders.mockImplementation(async (branchId, params = {}) => {

        const withoutStatus = allOrders.filter((order) => {

            if (params.search) {

                const query = params.search.toLowerCase();
                const matches = String(order.OrderId).includes(query) || (order.CustomerName || "").toLowerCase().includes(query);

                if (!matches) {
                    return false;
                }

            }

            return true;

        });

        const statusCounts = withoutStatus.reduce((counts, order) => {
            counts[order.OrderStatus] = (counts[order.OrderStatus] || 0) + 1;
            return counts;
        }, {});

        const filtered = params.status ? withoutStatus.filter((order) => order.OrderStatus === params.status) : withoutStatus;

        const page = params.page || 1;
        const limit = params.limit || 25;
        const pageSlice = filtered.slice((page - 1) * limit, page * limit);

        return {
            success: true,
            data: { orders: pageSlice, total: filtered.length, statusCounts, page, limit }
        };

    });

};

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));
    mockServerOrders(sampleOrders);

});

describe("Orders - search and status filter", () => {

    it("filters by order id or customer name (debounced, server-side)", async () => {

        const user = userEvent.setup();

        render(<Orders />);

        await screen.findByText("#62");
        expect(screen.getByText("#70")).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText(/search by order/i), "70");

        // Debounced 400ms before the filtered request fires - waitFor's
        // default timeout comfortably covers that.
        await waitFor(() => expect(screen.queryByText("#62")).not.toBeInTheDocument());
        expect(screen.getByText("#70")).toBeInTheDocument();

    });

    it("filters by status chip and shows the right counts", async () => {

        const user = userEvent.setup();

        render(<Orders />);

        await screen.findByText("#62");

        expect(screen.getByRole("button", { name: /^All \(4\)$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Ready \(1\)$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Cancelled \(1\)$/ })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /^Ready \(1\)$/ }));

        await waitFor(() => expect(screen.getByText("#57")).toBeInTheDocument());
        expect(screen.queryByText("#62")).not.toBeInTheDocument();
        expect(screen.queryByText("#56")).not.toBeInTheDocument();

    });

    it("shows a distinct message when the filter matches nothing", async () => {

        const user = userEvent.setup();

        render(<Orders />);

        await screen.findByText("#62");

        await user.type(screen.getByPlaceholderText(/search by order/i), "no-such-order");

        expect(await screen.findByText(/no orders match your search\/filter/i)).toBeInTheDocument();

    });

    it("shows which staff member took an order, and says nothing for one placed by a customer", async () => {

        render(<Orders />);

        await screen.findByText("#62");

        expect(screen.getByText("by Priya Sharma")).toBeInTheDocument();

        // #57/#56/#70 all lack CreatedByAdminName (a customer's own online
        // order) - exactly one attribution line should exist, not "by
        // undefined" or an empty one silently rendered for the other three.
        expect(screen.getAllByText(/^by /)).toHaveLength(1);

    });

});

describe("Orders - quick status advance", () => {

    it("advances a Ready order without opening the details dialog", async () => {

        const user = userEvent.setup();

        orderService.updateOrderStatus.mockResolvedValue({ success: true, message: "Order status updated." });

        render(<Orders />);

        await screen.findByText("#57");

        await user.click(screen.getByRole("button", { name: /mark delivered/i }));

        await waitFor(() => expect(orderService.updateOrderStatus).toHaveBeenCalledWith(57, "Delivered"));

        // Clicking the action button must not also trigger the row's own
        // onClick (which opens the details dialog and fetches the order).
        expect(orderService.getOrderById).not.toHaveBeenCalled();

    });

    it("does not show a quick-action button for terminal orders", async () => {

        // Isolate to only terminal orders - #57/#70 in the shared sample
        // data do have a next status, which would make a global "no mark
        // button anywhere" assertion pass or fail for the wrong reason.
        mockServerOrders(sampleOrders.filter((order) => order.OrderStatus === "Delivered" || order.OrderStatus === "Cancelled"));

        render(<Orders />);

        await screen.findByText("#62");

        expect(screen.queryByRole("button", { name: /mark/i })).not.toBeInTheDocument();

    });

    it("opens the details dialog when the row itself is clicked", async () => {

        const user = userEvent.setup();

        orderService.getOrderById.mockResolvedValue({
            success: true,
            data: { ...sampleOrders[1], Items: [] }
        });

        render(<Orders />);

        await screen.findByText("#57");

        await user.click(screen.getByText("#57"));

        await waitFor(() => expect(orderService.getOrderById).toHaveBeenCalledWith(57));

    });

});
