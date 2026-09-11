import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import toast from "react-hot-toast";

import Checkout from "./Checkout";
import * as cartService from "../services/cartService";
import * as addressService from "../services/addressService";
import * as checkoutService from "../services/checkoutService";
import * as paymentService from "../services/paymentService";
import * as customerService from "../services/customerService";
import { useStorefront } from "../context/StorefrontContext";
import { getStoredAuth } from "../utils/customerAuth";

vi.mock("../services/cartService");
vi.mock("../services/addressService");
vi.mock("../services/checkoutService");
vi.mock("../services/paymentService");
vi.mock("../services/couponService");
vi.mock("../services/customerService");
vi.mock("../utils/razorpayCheckout");
vi.mock("../context/StorefrontContext");
vi.mock("../utils/customerAuth");
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const CART_ITEMS = [
    { CartId: 1, MenuItemId: 1, ItemName: "Veg Spring Rolls", Quantity: 1, UnitPrice: 149, TotalPrice: 149, TaxRatePercent: 5, SelectedOptions: [] }
];

const renderCheckout = () => render(
    <MemoryRouter>
        <Checkout />
    </MemoryRouter>
);

const baseStorefront = {
    tenantSlug: "alpha-diner",
    customer: { CustomerId: 501, FullName: "Guest" },
    isGuest: true,
    tableNumber: null,
    login: vi.fn(),
    refreshCartCount: vi.fn()
};

beforeEach(() => {

    vi.clearAllMocks();

    useStorefront.mockReturnValue({ ...baseStorefront });

    cartService.getCart.mockResolvedValue({ success: true, data: CART_ITEMS });
    addressService.getAddresses.mockResolvedValue({ success: true, data: [] });
    getStoredAuth.mockReturnValue({ token: "guest-token", customer: baseStorefront.customer });

});

describe("Checkout - guest details", () => {

    it("shows a Your Details section for a guest session", async () => {

        renderCheckout();

        expect(await screen.findByText("Your Details")).toBeInTheDocument();
        expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();

    });

    it("does not show Your Details for a real logged-in customer", async () => {

        useStorefront.mockReturnValue({ ...baseStorefront, isGuest: false, customer: { CustomerId: 9, FullName: "Ravi Kumar" } });

        renderCheckout();

        await screen.findByText("Checkout");
        expect(screen.queryByText("Your Details")).not.toBeInTheDocument();

    });

    it("blocks placing the order until name and phone are filled in", async () => {

        useStorefront.mockReturnValue({ ...baseStorefront, tableNumber: "5" });

        const user = userEvent.setup();
        renderCheckout();

        await screen.findByText("Your Details");
        await user.click(screen.getByRole("button", { name: /place order/i }));

        expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/name and phone/i));
        expect(customerService.updateCustomer).not.toHaveBeenCalled();

    });

    it("saves the guest's name/phone and places a Dine In order with the table number", async () => {

        useStorefront.mockReturnValue({ ...baseStorefront, tableNumber: "12" });
        customerService.updateCustomer.mockResolvedValue({ success: true, data: { CustomerId: 501, FullName: "Anita Rao", Phone: "9998887777", IsGuest: false } });
        checkoutService.checkout.mockResolvedValue({ success: true, data: { OrderId: 88, TotalAmount: 156.45 } });
        paymentService.createPayment.mockResolvedValue({ success: true });

        const user = userEvent.setup();
        renderCheckout();

        await screen.findByText("Your Details");

        await user.type(screen.getByLabelText(/your name/i), "Anita Rao");
        await user.type(screen.getByLabelText(/phone number/i), "9998887777");
        await user.click(screen.getByRole("button", { name: /place order/i }));

        await waitFor(() => expect(checkoutService.checkout).toHaveBeenCalled());

        expect(customerService.updateCustomer).toHaveBeenCalledWith(501, { fullName: "Anita Rao", phone: "9998887777" });
        expect(checkoutService.checkout).toHaveBeenCalledWith(
            expect.objectContaining({ deliveryType: "Dine In", tableNumber: "12" })
        );

    });

});

describe("Checkout - loyalty points redemption", () => {

    beforeEach(() => {
        useStorefront.mockReturnValue({ ...baseStorefront, isGuest: false, customer: { CustomerId: 9, FullName: "Ravi Kumar" } });
    });

    it("shows nothing when the customer has no points", async () => {

        customerService.getLoyalty.mockResolvedValue({ success: true, data: { balance: 0, transactions: [] } });

        renderCheckout();

        await screen.findByText("Checkout");
        expect(screen.queryByLabelText(/redeem points/i)).not.toBeInTheDocument();

    });

    it("shows the balance and lets the customer redeem points as a discount", async () => {

        customerService.getLoyalty.mockResolvedValue({ success: true, data: { balance: 100, transactions: [] } });

        const user = userEvent.setup();
        renderCheckout();

        expect(await screen.findByText(/you have 100 points/i)).toBeInTheDocument();

        await user.type(screen.getByLabelText(/redeem points/i), "50");

        expect(await screen.findByText("-₹50.00 off this order")).toBeInTheDocument();
        expect(screen.getByText("Loyalty Points (50 pts)")).toBeInTheDocument();

    });

    it("caps redemption at the cart subtotal, not the full balance", async () => {

        // Cart total is 149 + 5% tax; subtotal itself is 149 - redeeming more
        // than that would take the discount past what's actually owed.
        customerService.getLoyalty.mockResolvedValue({ success: true, data: { balance: 500, transactions: [] } });

        const user = userEvent.setup();
        renderCheckout();

        await screen.findByText(/you have 500 points/i);
        await user.type(screen.getByLabelText(/redeem points/i), "500");

        expect(await screen.findByText("Loyalty Points (149 pts)")).toBeInTheDocument();
        expect(screen.getByText("-₹149.00 off this order")).toBeInTheDocument();

    });

    it("sends redeemPoints through at checkout", async () => {

        useStorefront.mockReturnValue({ ...baseStorefront, isGuest: false, customer: { CustomerId: 9, FullName: "Ravi Kumar" }, tableNumber: "5" });
        customerService.getLoyalty.mockResolvedValue({ success: true, data: { balance: 100, transactions: [] } });
        checkoutService.checkout.mockResolvedValue({ success: true, data: { OrderId: 88, TotalAmount: 100 } });
        paymentService.createPayment.mockResolvedValue({ success: true });

        const user = userEvent.setup();
        renderCheckout();

        await screen.findByText(/you have 100 points/i);
        await user.type(screen.getByLabelText(/redeem points/i), "30");
        await user.click(screen.getByRole("button", { name: /place order/i }));

        await waitFor(() => expect(checkoutService.checkout).toHaveBeenCalledWith(
            expect.objectContaining({ redeemPoints: 30 })
        ));

    });

});
