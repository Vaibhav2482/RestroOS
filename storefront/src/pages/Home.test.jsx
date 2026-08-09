import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Home from "./Home";
import * as publicService from "../services/publicService";
import * as cartService from "../services/cartService";
import { useStorefront } from "../context/StorefrontContext";

vi.mock("../services/publicService");
vi.mock("../services/cartService");
vi.mock("../context/StorefrontContext");

const CATEGORIES = [
    { CategoryId: 1, CategoryName: "Starters", IsActive: true, DisplayOrder: 1 },
    { CategoryId: 2, CategoryName: "Mains", IsActive: true, DisplayOrder: 2 }
];

const MENU_ITEMS = [
    { MenuItemId: 1, CategoryId: 1, ItemName: "Veg Spring Rolls", Price: 149, IsVeg: true, IsPopular: true, IsAvailable: true, IsActive: true, HasOptions: false },
    { MenuItemId: 2, CategoryId: 1, ItemName: "Chicken Wings", Price: 199, IsVeg: false, IsPopular: false, IsAvailable: true, IsActive: true, HasOptions: false },
    { MenuItemId: 3, CategoryId: 2, ItemName: "Paneer Butter Masala", Price: 249, IsVeg: true, IsPopular: false, IsAvailable: true, IsActive: true, HasOptions: false }
];

const renderHome = () => render(
    <MemoryRouter>
        <Home />
    </MemoryRouter>
);

beforeEach(() => {

    vi.clearAllMocks();

    useStorefront.mockReturnValue({
        tenantSlug: "ccc",
        branches: [{ BranchId: 1, BranchName: "Kondapur" }],
        selectedBranchId: 1,
        isLoggedIn: true,
        customer: { CustomerId: 1 },
        setCartCount: vi.fn(),
        loading: false
    });

    publicService.getPublicCategories.mockResolvedValue({ success: true, data: CATEGORIES });
    publicService.getMenuItems.mockResolvedValue({ success: true, data: MENU_ITEMS });
    cartService.getCart.mockResolvedValue({ success: true, data: [] });

});

describe("Home - Veg/Non-Veg/Bestseller filters", () => {

    it("shows every available item with no filters active", async () => {

        renderHome();

        // Veg Spring Rolls is IsPopular, so it legitimately renders twice
        // (Recommended + its own category) - see the dedicated Recommended
        // section tests below for that behavior specifically.
        expect(await screen.findAllByText("Veg Spring Rolls")).not.toHaveLength(0);
        expect(screen.getByText("Chicken Wings")).toBeInTheDocument();
        expect(screen.getByText("Paneer Butter Masala")).toBeInTheDocument();

    });

    it("Pure Veg hides non-veg items", async () => {

        const user = userEvent.setup();

        renderHome();

        await screen.findByText("Chicken Wings");

        await user.click(screen.getByRole("button", { name: /pure veg/i }));

        expect(screen.queryByText("Chicken Wings")).not.toBeInTheDocument();
        // Veg Spring Rolls is IsPopular, so it's expected to appear in both
        // Recommended and Starters here - only presence matters for this
        // assertion, not the count (that's what the Recommended-section
        // tests below check specifically).
        expect(screen.getAllByText("Veg Spring Rolls").length).toBeGreaterThan(0);
        expect(screen.getByText("Paneer Butter Masala")).toBeInTheDocument();

    });

    it("Non-Veg replaces Pure Veg instead of both staying active at once", async () => {

        // Veg/non-veg are mutually exclusive, like a real food-ordering
        // app's veg toggle - selecting one deselects the other rather than
        // both chips staying highlighted and silently cancelling out to
        // "show everything."
        const user = userEvent.setup();

        renderHome();

        await screen.findByText("Chicken Wings");

        await user.click(screen.getByRole("button", { name: /pure veg/i }));
        await user.click(screen.getByRole("button", { name: /non-veg/i }));

        // Non-Veg replaced Pure Veg, so only non-veg items should remain -
        // if both were still active (the old bug), Paneer Butter Masala
        // (veg) would still be showing here too.
        expect(screen.queryByText("Paneer Butter Masala")).not.toBeInTheDocument();
        expect(screen.getByText("Chicken Wings")).toBeInTheDocument();

    });

    it("Bestseller shows only IsPopular items", async () => {

        const user = userEvent.setup();

        renderHome();

        await screen.findByText("Chicken Wings");

        await user.click(screen.getByRole("button", { name: /bestseller/i }));

        expect(screen.getAllByText("Veg Spring Rolls").length).toBeGreaterThan(0);
        expect(screen.queryByText("Chicken Wings")).not.toBeInTheDocument();
        expect(screen.queryByText("Paneer Butter Masala")).not.toBeInTheDocument();

    });

    it("combines the search box with an active filter", async () => {

        const user = userEvent.setup();

        renderHome();

        await screen.findByText("Chicken Wings");

        await user.click(screen.getByRole("button", { name: /pure veg/i }));
        await user.type(screen.getByPlaceholderText(/search menu items/i), "paneer");

        expect(screen.queryByText("Veg Spring Rolls")).not.toBeInTheDocument();
        expect(screen.getByText("Paneer Butter Masala")).toBeInTheDocument();

    });

});

describe("Home - Recommended section", () => {

    it("surfaces bestseller items in a cross-category Recommended section, in addition to their own category", async () => {

        renderHome();

        // "Recommended" appears twice too - once as the scroll-spy chip,
        // once as the section heading - so this also needs findAllByText.
        await screen.findAllByText("Recommended");

        // "Veg Spring Rolls" is IsPopular, so it should appear twice: once
        // under Recommended, once under its real category (Starters) -
        // Recommended is an additional surface, not a replacement.
        expect(await screen.findAllByText("Veg Spring Rolls")).toHaveLength(2);
        // "Starters" also appears twice - chip + section heading.
        expect(screen.getAllByText("Starters").length).toBeGreaterThan(0);

    });

    it("omits the Recommended section entirely when nothing is a bestseller", async () => {

        publicService.getMenuItems.mockResolvedValue({
            success: true,
            data: MENU_ITEMS.map((item) => ({ ...item, IsPopular: false }))
        });

        renderHome();

        await screen.findByText("Veg Spring Rolls");

        expect(screen.queryByText("Recommended")).not.toBeInTheDocument();

    });

});

describe("Home - add to cart", () => {

    it("adds a plain (no-options) item to the cart", async () => {

        const user = userEvent.setup();

        cartService.addToCart.mockResolvedValue({ success: true, data: { CartId: 501 } });

        renderHome();

        // Wait on Chicken Wings, not Veg Spring Rolls - the latter is
        // IsPopular and legitimately renders twice (Recommended + its own
        // category), which findByText's single-match semantics reject.
        await screen.findByText("Chicken Wings");

        // Recommended renders first, so its Veg Spring Rolls (MenuItemId 1)
        // is the first "Add" button in the DOM.
        const addButtons = screen.getAllByRole("button", { name: "Add" });
        await user.click(addButtons[0]);

        await waitFor(() => expect(cartService.addToCart).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: 1, menuItemId: 1, quantity: 1 })
        ));

    });

});

describe("Home - rapid quantity taps", () => {

    it("applies every tap immediately and collapses the burst into one server call", async () => {

        const user = userEvent.setup();

        cartService.addToCart.mockResolvedValue({ success: true, data: { CartId: 501 } });
        cartService.updateCartQuantity.mockResolvedValue({ success: true });

        renderHome();
        await screen.findByText("Chicken Wings");

        await user.click(screen.getAllByRole("button", { name: "Add" })[0]);

        // The stepper replacing the Add button is what confirms the line
        // exists; read the quantity from inside it rather than searching the
        // whole page, where a bare "1" also matches prices and counts.
        // This item is IsPopular, so it renders in both Recommended and its
        // own category - two steppers for one line. Either reflects the same
        // state; the first will do.
        await waitFor(() => expect(screen.getAllByTestId("RemoveIcon").length).toBeGreaterThan(0));
        const stepper = screen.getAllByTestId("RemoveIcon")[0].closest("button").parentElement;
        const quantityOf = () => stepper.querySelector("p").textContent;

        expect(quantityOf()).toBe("1");

        // Four quick taps. Each used to be swallowed while the previous
        // request was still in flight, so the count lagged the finger.
        const plus = screen.getAllByTestId("AddIcon")[0].closest("button");
        await user.click(plus);
        await user.click(plus);
        await user.click(plus);
        await user.click(plus);

        // Every tap landed, without waiting on the network.
        await waitFor(() => expect(quantityOf()).toBe("5"));

        // ...and the burst debounced down to a single sync carrying the
        // final quantity, rather than one request per tap.
        await waitFor(() => expect(cartService.updateCartQuantity).toHaveBeenCalledTimes(1));
        expect(cartService.updateCartQuantity).toHaveBeenCalledWith(501, 5);

    });

});
