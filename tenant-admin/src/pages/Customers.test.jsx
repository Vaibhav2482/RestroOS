import { render, screen } from "@testing-library/react";
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

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));
    customerService.getAllCustomers.mockResolvedValue({ success: true, data: sampleCustomers });

});

describe("Customers - list and search", () => {

    it("shows every customer with their order stats", async () => {

        render(<Customers />);

        await screen.findByText("Vaibhav Nawale");

        expect(screen.getByText("New Guest")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("₹450.00")).toBeInTheDocument();

    });

    it("filters by name, phone, or email", async () => {

        const user = userEvent.setup();

        render(<Customers />);

        await screen.findByText("Vaibhav Nawale");

        await user.type(screen.getByPlaceholderText(/search by name, phone or email/i), "9123456780");

        expect(screen.queryByText("Vaibhav Nawale")).not.toBeInTheDocument();
        expect(screen.getByText("New Guest")).toBeInTheDocument();

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
