import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Customers from "./Customers";
import * as customerService from "../services/customerService";
import * as orderService from "../services/orderService";

vi.mock("../services/customerService");
vi.mock("../services/orderService");

const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, Email: "staff@test.com" }
};

const sampleCustomers = [
    { CustomerId: 1, FullName: "Vaibhav Nawale", Phone: "9876543210", Email: "vaibhav@test.com", OrderCount: 3, TotalSpent: 450, CreatedAt: "2026-06-01T00:00:00" },
    { CustomerId: 2, FullName: "New Guest", Phone: "9123456780", Email: "guest@test.com", OrderCount: 0, TotalSpent: 0, CreatedAt: "2026-07-01T00:00:00" }
];

// Customers.jsx now fetches a server-filtered/paginated page rather than
// filtering a full array client-side - this stands in for the real
// backend's GET /customers?page=&limit=&search= behavior (see
// CustomerRepository.getAllCustomersByTenant), same approach as
// Orders.test.jsx's mockServerOrders.
const mockServerCustomers = (allCustomers) => {

    customerService.getAllCustomers.mockImplementation(async (params = {}) => {

        const filtered = params.search
            ? allCustomers.filter((customer) => {
                const query = params.search.toLowerCase();
                return (
                    (customer.FullName || "").toLowerCase().includes(query) ||
                    (customer.Phone || "").toLowerCase().includes(query) ||
                    (customer.Email || "").toLowerCase().includes(query)
                );
            })
            : allCustomers;

        const page = params.page || 1;
        const limit = params.limit || 25;
        const pageSlice = filtered.slice((page - 1) * limit, page * limit);

        return {
            success: true,
            data: { customers: pageSlice, total: filtered.length, page, limit }
        };

    });

};

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));
    mockServerCustomers(sampleCustomers);

});

describe("Customers - list and search", () => {

    it("shows every customer with their order stats", async () => {

        render(<Customers />);

        await screen.findByText("Vaibhav Nawale");

        expect(screen.getByText("New Guest")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("₹450.00")).toBeInTheDocument();

    });

    it("filters by name, phone, or email (debounced, server-side)", async () => {

        const user = userEvent.setup();

        render(<Customers />);

        await screen.findByText("Vaibhav Nawale");

        await user.type(screen.getByPlaceholderText(/search by name, phone or email/i), "9123456780");

        // Debounced 400ms before the filtered request fires - waitFor's
        // own retry window covers that.
        await waitFor(() => expect(screen.queryByText("Vaibhav Nawale")).not.toBeInTheDocument());
        expect(screen.getByText("New Guest")).toBeInTheDocument();

    });

    it("shows the empty-search-result state rather than the no-customers-yet state", async () => {

        const user = userEvent.setup();

        render(<Customers />);

        await screen.findByText("Vaibhav Nawale");

        await user.type(screen.getByPlaceholderText(/search by name, phone or email/i), "no-such-person");

        expect(await screen.findByText(/no customers match your search/i)).toBeInTheDocument();

    });

    it("opens the customer's order history when a row is clicked", async () => {

        const user = userEvent.setup();

        orderService.getOrdersByCustomer.mockResolvedValue({ success: true, data: [] });

        render(<Customers />);

        await screen.findByText("Vaibhav Nawale");

        await user.click(screen.getByText("Vaibhav Nawale"));

        expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();

    });

});
