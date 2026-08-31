import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Orders from "./Orders";
import * as orderService from "../services/orderService";

// Orders now navigates to /pos for Reorder, so it needs a Router in scope
// even for tests that never touch that button - useNavigate() throws
// without one regardless of whether it's actually called.
const renderOrders = () => render(<Orders />, { wrapper: MemoryRouter });

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal()),
    useNavigate: () => mockNavigate
}));

vi.mock("../services/orderService");

// A non-owner (branch-scoped) admin skips the branch-loading path entirely,
// which keeps this suite from also needing to mock branchService.
const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, Email: "staff@test.com" }
};

// Dine In's sequence goes straight from Ready to Served (no "Out For
// Delivery" step) - keeping #57 as Dine In here means its next status is
// unambiguously "Served", matching the assertions below.
const sampleOrders = [
    { OrderId: 62, CustomerName: "Vaibhav Nawale", DeliveryType: "Dine In", TotalAmount: 105, OrderStatus: "Served", OrderDate: "2026-07-25T21:00:24", CreatedByAdminName: "Priya Sharma" },
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

        renderOrders();

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

        renderOrders();

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

        renderOrders();

        await screen.findByText("#62");

        await user.type(screen.getByPlaceholderText(/search by order/i), "no-such-order");

        expect(await screen.findByText(/no orders match your search\/filter/i)).toBeInTheDocument();

    });

    it("shows which staff member took an order, and says nothing for one placed by a customer", async () => {

        renderOrders();

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

        renderOrders();

        await screen.findByText("#57");

        await user.click(screen.getByRole("button", { name: /mark served/i }));

        await waitFor(() => expect(orderService.updateOrderStatus).toHaveBeenCalledWith(57, "Served"));

        // Clicking the action button must not also trigger the row's own
        // onClick (which opens the details dialog and fetches the order).
        expect(orderService.getOrderById).not.toHaveBeenCalled();

    });

    it("does not show a quick-action button for terminal orders", async () => {

        // Isolate to only terminal orders - #57/#70 in the shared sample
        // data do have a next status, which would make a global "no mark
        // button anywhere" assertion pass or fail for the wrong reason.
        mockServerOrders(sampleOrders.filter((order) => order.OrderStatus === "Served" || order.OrderStatus === "Cancelled"));

        renderOrders();

        await screen.findByText("#62");

        expect(screen.queryByRole("button", { name: /mark/i })).not.toBeInTheDocument();

    });

    it("opens the details dialog when the row itself is clicked", async () => {

        const user = userEvent.setup();

        orderService.getOrderById.mockResolvedValue({
            success: true,
            data: { ...sampleOrders[1], Items: [] }
        });

        renderOrders();

        await screen.findByText("#57");

        await user.click(screen.getByText("#57"));

        await waitFor(() => expect(orderService.getOrderById).toHaveBeenCalledWith(57));

    });

    // A cancelled order is already dead, so this still shows (staff
    // scanning cancelled orders need to tell "customer's payment just
    // failed" apart from "voided for some other reason") but as plain
    // caption text, not a second chip - two badge shapes stacked under
    // each other read as two competing statuses on one row even when the
    // second one is muted in color.
    it("shows plain text, not a chip, for the payment info on a Cancelled order", async () => {

        mockServerOrders([
            { OrderId: 90, CustomerName: "Vaibhav Nawale", DeliveryType: "Delivery", PaymentMethod: "Card", LatestPaymentStatus: "Failed", TotalAmount: 200, OrderStatus: "Cancelled", OrderDate: "2026-07-25T21:00:24" }
        ]);

        renderOrders();

        await screen.findByText("#90");

        const note = screen.getByText(/payment failed/i);
        expect(note).toBeInTheDocument();
        expect(note.closest(".MuiChip-root")).toBeNull();

    });

    it("shows the payment badge as a solid, alarming chip on a non-cancelled order with a failed payment", async () => {

        mockServerOrders([
            { OrderId: 91, CustomerName: "Vaibhav Nawale", DeliveryType: "Delivery", PaymentMethod: "Card", LatestPaymentStatus: "Failed", TotalAmount: 200, OrderStatus: "Pending", OrderDate: "2026-07-25T21:00:24" }
        ]);

        renderOrders();

        await screen.findByText("#91");

        const badge = screen.getByText(/payment failed/i);
        expect(badge).toBeInTheDocument();
        expect(badge.closest(".MuiChip-root")).toHaveClass("MuiChip-filled");

    });

    // The backend blocks a Card/UPI order from reaching Preparing (or
    // beyond) without a confirmed payment - clicking "Mark Preparing" here
    // used to just fail with an error toast after a round trip. It should
    // now be disabled up front instead.
    it("disables the quick-advance button when it would move a Card/UPI order to Preparing without a confirmed payment", async () => {

        mockServerOrders([
            { OrderId: 92, CustomerName: "Vaibhav Nawale", DeliveryType: "Delivery", PaymentMethod: "Card", LatestPaymentStatus: "Pending", TotalAmount: 200, OrderStatus: "Accepted", OrderDate: "2026-07-25T21:00:24" }
        ]);

        renderOrders();

        await screen.findByText("#92");

        expect(screen.getByRole("button", { name: /^mark preparing$/i })).toBeDisabled();

    });

    it("does not disable the quick-advance button for a step that does not yet require a confirmed payment", async () => {

        mockServerOrders([
            { OrderId: 93, CustomerName: "Vaibhav Nawale", DeliveryType: "Delivery", PaymentMethod: "Card", LatestPaymentStatus: "Pending", TotalAmount: 200, OrderStatus: "Pending", OrderDate: "2026-07-25T21:00:24" }
        ]);

        renderOrders();

        await screen.findByText("#93");

        // Pending -> Accepted doesn't reach Preparing yet, so this step is
        // still fine even with an unconfirmed payment.
        expect(screen.getByRole("button", { name: /^mark accepted$/i })).not.toBeDisabled();

    });

    // A finished/cancelled order used to leave this slot blank - Reorder
    // gives staff something to do with it instead of a dead end.
    it("shows a Reorder button for a finished Dine In order, and hands off to Take Order with its items", async () => {

        const user = userEvent.setup();

        mockServerOrders([
            { OrderId: 94, CustomerName: "Vaibhav Nawale", DeliveryType: "Dine In", TotalAmount: 200, OrderStatus: "Served", OrderDate: "2026-07-25T21:00:24" }
        ]);

        orderService.getOrderById.mockResolvedValue({
            success: true,
            data: {
                OrderId: 94,
                BranchId: 5,
                DeliveryType: "Dine In",
                CustomerId: 12,
                CustomerName: "Vaibhav Nawale",
                CustomerPhone: "9876543210",
                Items: [
                    { MenuItemId: 1, ItemName: "Masala Chai", Quantity: 2, SelectedOptions: [] },
                    { MenuItemId: 2, ItemName: "Samosa", Quantity: 1, SelectedOptions: [{ OptionId: 9, OptionName: "Extra Spicy" }] }
                ]
            }
        });

        renderOrders();

        await screen.findByText("#94");

        await user.click(screen.getByRole("button", { name: /^reorder$/i }));

        await waitFor(() => expect(orderService.getOrderById).toHaveBeenCalledWith(94));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/pos", {
            state: {
                reorder: {
                    sourceOrderId: 94,
                    branchId: 5,
                    deliveryType: "Dine In",
                    customer: { CustomerId: 12, FullName: "Vaibhav Nawale", Phone: "9876543210" },
                    items: [
                        { menuItemId: 1, quantity: 2, hadOptions: false },
                        { menuItemId: 2, quantity: 1, hadOptions: true }
                    ]
                }
            }
        }));

    });

    it("does not show a Reorder button for a finished Delivery order - Take Order has no Delivery mode to land in", async () => {

        mockServerOrders([
            { OrderId: 95, CustomerName: "Vaibhav Nawale", DeliveryType: "Delivery", TotalAmount: 200, OrderStatus: "Delivered", OrderDate: "2026-07-25T21:00:24" }
        ]);

        renderOrders();

        await screen.findByText("#95");

        expect(screen.queryByRole("button", { name: /^reorder$/i })).not.toBeInTheDocument();

    });

    it("does not show a Reorder button for an order still in progress", async () => {

        mockServerOrders([
            { OrderId: 96, CustomerName: "Vaibhav Nawale", DeliveryType: "Takeaway", TotalAmount: 200, OrderStatus: "Preparing", OrderDate: "2026-07-25T21:00:24" }
        ]);

        renderOrders();

        await screen.findByText("#96");

        expect(screen.queryByRole("button", { name: /^reorder$/i })).not.toBeInTheDocument();

    });

});
