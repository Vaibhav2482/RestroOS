import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Orders from "./Orders";
import * as orderService from "../services/orderService";
import { useStorefront } from "../context/StorefrontContext";
import { openRazorpayCheckout } from "../utils/razorpayCheckout";

vi.mock("../services/orderService");
vi.mock("../context/StorefrontContext");
vi.mock("../utils/razorpayCheckout");

const baseOrder = (overrides) => ({
    OrderId: 42,
    OrderStatus: "Pending",
    DeliveryType: "Delivery",
    PaymentMethod: "Cash",
    TableNumber: null,
    OrderDate: "2026-07-25T10:00:00Z",
    TotalAmount: 210,
    Items: [{ ItemName: "Veg Burger", Quantity: 1 }],
    ...overrides
});

const renderOrders = () => render(
    <MemoryRouter initialEntries={["/ccc/orders"]}>
        <Routes>
            <Route path="/:tenantSlug/orders" element={<Orders />} />
        </Routes>
    </MemoryRouter>
);

beforeEach(() => {

    vi.clearAllMocks();

    useStorefront.mockReturnValue({
        tenantSlug: "ccc",
        customer: { CustomerId: 1, FullName: "Test Customer", Email: "test@example.com", Phone: "9999999999" }
    });

});

describe("Orders - payment status visibility", () => {

    it("shows a Payment Failed badge and a Retry Payment button instead of Reorder for a failed Card order", async () => {

        orderService.getOrdersByCustomer.mockResolvedValue({
            success: true,
            data: [baseOrder({ OrderId: 57, PaymentMethod: "Card", LatestPaymentStatus: "Failed" })]
        });

        renderOrders();

        expect(await screen.findByText("Payment Failed")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^retry payment$/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^reorder$/i })).not.toBeInTheDocument();

    });

    it("shows no payment badge and the ordinary Reorder button for a Paid Card order", async () => {

        orderService.getOrdersByCustomer.mockResolvedValue({
            success: true,
            data: [baseOrder({ OrderId: 58, PaymentMethod: "Card", LatestPaymentStatus: "Paid" })]
        });

        renderOrders();

        await screen.findByText("Order #58");

        expect(screen.queryByText(/^Payment /)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^reorder$/i })).toBeInTheDocument();

    });

    it("shows no payment badge for a Cash order even with no LatestPaymentStatus at all", async () => {

        orderService.getOrdersByCustomer.mockResolvedValue({
            success: true,
            data: [baseOrder({ OrderId: 59, PaymentMethod: "Cash" })]
        });

        renderOrders();

        await screen.findByText("Order #59");

        expect(screen.queryByText(/^Payment /)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^reorder$/i })).toBeInTheDocument();

    });

    it("opens Razorpay checkout without navigating to the order detail page when Retry Payment is clicked", async () => {

        const user = userEvent.setup();
        const order = baseOrder({ OrderId: 60, PaymentMethod: "UPI", LatestPaymentStatus: "Pending" });

        orderService.getOrdersByCustomer.mockResolvedValue({ success: true, data: [order] });
        openRazorpayCheckout.mockResolvedValue(undefined);

        renderOrders();

        await user.click(await screen.findByRole("button", { name: /^retry payment$/i }));

        expect(openRazorpayCheckout).toHaveBeenCalledTimes(1);
        const call = openRazorpayCheckout.mock.calls[0][0];
        expect(call.order.OrderId).toBe(60);
        expect(call.paymentMethod).toBe("UPI");

        // Still on the list page - the row's own onClick (navigate) must not
        // have also fired.
        expect(await screen.findByText("Order #60")).toBeInTheDocument();

    });

});
