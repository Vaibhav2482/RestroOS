import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import PosOrderBuilder from "./PosOrderBuilder";
import * as menuService from "../services/menuService";
import * as categoryService from "../services/categoryService";
import * as customerService from "../services/customerService";
import * as orderService from "../services/orderService";
import * as menuOptionService from "../services/menuOptionService";

// This file's first job is simply to import the component. One of the three
// visual regressions that reached production on this screen was a syntax
// error every prior test passed through, because nothing imported this file
// at all - an import alone catches that class again here.

vi.mock("../services/menuService");
vi.mock("../services/categoryService");
vi.mock("../services/customerService");
vi.mock("../services/orderService");
vi.mock("../services/menuOptionService");

const GUEST_CUSTOMER = { CustomerId: 1, Phone: "0000000000", FullName: "Guest" };

const CHAI = { MenuItemId: 11, ItemName: "Ginger Chai", Price: 30, CategoryId: 1, IsAvailable: true, IsActive: true, HasOptions: false };
const SAMOSA = { MenuItemId: 12, ItemName: "Samosa", Price: 20, CategoryId: 1, IsAvailable: true, IsActive: true, HasOptions: false };
const PIZZA = { MenuItemId: 13, ItemName: "Margherita Pizza", Price: 200, CategoryId: 1, IsAvailable: true, IsActive: true, HasOptions: true };

const CATEGORY = { CategoryId: 1, CategoryName: "All Day", IsActive: true };

const SIZE_GROUP = {
    GroupId: 1,
    GroupName: "Size",
    IsRequired: true,
    MinSelect: 1,
    MaxSelect: 1,
    Options: [
        { OptionId: 101, OptionName: "Regular", PriceDelta: 0, IsDefault: true, IsActive: true },
        { OptionId: 102, OptionName: "Large", PriceDelta: 50, IsDefault: false, IsActive: true }
    ]
};

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify({ token: "test-token", admin: { AdminId: 1, tenantName: "Chai Chakhna" } }));

    categoryService.getAllCategories.mockResolvedValue({ success: true, data: [CATEGORY] });
    customerService.getOrCreateGuestCustomer.mockResolvedValue({ success: true, data: GUEST_CUSTOMER });
    menuService.getAllMenuItems.mockResolvedValue({ success: true, data: [CHAI, SAMOSA, PIZZA] });
    menuOptionService.getOptionGroupsByMenuItem.mockResolvedValue({ success: true, data: [SIZE_GROUP] });

});

const renderBuilder = (props = {}) =>
    render(
        <PosOrderBuilder
            branchId={5}
            branchName="Kondapur"
            deliveryType="Dine In"
            tableNumber="A1"
            onCreated={vi.fn()}
            onCancel={vi.fn()}
            {...props}
        />
    );

// The menu tile's own "Add" button/stepper is swapped for a different
// control the moment a line exists, which reorders getAllByRole("button")'s
// index for every item after it - scoping to the item's own card avoids
// tests silently clicking the wrong tile once an earlier item has been added.
const addFromMenu = async (user, itemName) => {
    const card = screen.getByText(itemName).closest(".MuiCard-root");
    await user.click(within(card).getByRole("button", { name: /^add$/i }));
};

describe("PosOrderBuilder - building the cart", () => {

    it("adds a plain item to the cart and reflects it in the subtotal", async () => {

        const user = userEvent.setup();
        renderBuilder();

        await screen.findByText("Ginger Chai");

        await addFromMenu(user, "Ginger Chai");

        expect(screen.getByText(/subtotal: ₹\s*30\.00/i)).toBeInTheDocument();

    });

    it("increments and decrements the quantity from the menu tile stepper", async () => {

        const user = userEvent.setup();
        renderBuilder({ props: { deliveryType: "Dine In" } });

        await screen.findByText("Ginger Chai");
        await addFromMenu(user, "Ginger Chai");

        // Once a line exists, the menu tile's own "Add" button is replaced by
        // a +/- stepper - its increment icon is the first AddRoundedIcon in
        // the document (the cart sidebar's stepper for the same line comes
        // after it in DOM order).
        const incrementButtons = screen.getAllByTestId("AddRoundedIcon");
        await user.click(incrementButtons[0]);
        await user.click(incrementButtons[0]);

        expect(screen.getByText(/subtotal: ₹\s*90\.00/i)).toBeInTheDocument();

        const decrementButtons = screen.getAllByTestId("RemoveRoundedIcon");
        await user.click(decrementButtons[0]);

        expect(screen.getByText(/subtotal: ₹\s*60\.00/i)).toBeInTheDocument();

    });

    it("lets staff type an exact quantity directly into a cart line", async () => {

        const user = userEvent.setup();
        renderBuilder();

        await screen.findByText("Ginger Chai");
        await addFromMenu(user, "Ginger Chai");

        // The quantity buffer only commits on blur/Enter (see QuantityInput) -
        // a plain change event would otherwise fire a commit of 0 on the
        // first backspace and delete the line before the second digit lands.
        const quantityInputs = screen.getAllByRole("spinbutton");
        const menuTileInput = quantityInputs[0];

        await user.clear(menuTileInput);
        await user.type(menuTileInput, "5");
        fireEvent.blur(menuTileInput);

        expect(screen.getByText(/subtotal: ₹\s*150\.00/i)).toBeInTheDocument();

    });

    it("applies a selected option to the cart at the adjusted price", async () => {

        const user = userEvent.setup();
        renderBuilder();

        await screen.findByText("Margherita Pizza");

        await addFromMenu(user, "Margherita Pizza");

        await screen.findByText(/select 1/i);

        await user.click(screen.getByLabelText(/large \(\+₹50\)/i));
        await user.click(screen.getByRole("button", { name: /add item — ₹250\.00/i }));

        // Confirming closes the options dialog and folds the customized line
        // into the cart at unitPrice (200 base + 50 delta), not the item's
        // plain menu price.
        expect(screen.getByText(/subtotal: ₹\s*250\.00/i)).toBeInTheDocument();
        expect(screen.getByText("Large")).toBeInTheDocument();

    });

    it("sums every cart line into the subtotal, not just the most recent one", async () => {

        const user = userEvent.setup();
        renderBuilder();

        await screen.findByText("Ginger Chai");

        await addFromMenu(user, "Ginger Chai");
        await addFromMenu(user, "Samosa");

        expect(screen.getByText(/subtotal: ₹\s*50\.00/i)).toBeInTheDocument();

    });

});

describe("PosOrderBuilder - placing the order", () => {

    it("blocks placing an order with an empty cart", async () => {

        renderBuilder();

        await screen.findByText("Ginger Chai");

        // Disabled outright now, not just rejected after a click - the
        // button no longer offers an action it's going to refuse. A
        // genuinely disabled button can't even be clicked (userEvent
        // correctly refuses to simulate a click on one), so the disabled
        // assertion itself is the proof here.
        expect(screen.getByRole("button", { name: /place order/i })).toBeDisabled();
        expect(orderService.createOrder).not.toHaveBeenCalled();

    });

    it("submits the resolved customer, cart items and payment method together", async () => {

        const user = userEvent.setup();

        orderService.createOrder.mockResolvedValue({
            success: true,
            data: { OrderId: 501, TotalAmount: 63 }
        });

        renderBuilder();

        await screen.findByText("Ginger Chai");
        await addFromMenu(user, "Ginger Chai");
        await user.click(screen.getByRole("button", { name: "UPI" }));
        await user.click(screen.getByRole("button", { name: /place order/i }));

        await waitFor(() => expect(orderService.createOrder).toHaveBeenCalledWith({
            customerId: GUEST_CUSTOMER.CustomerId,
            deliveryType: "Dine In",
            tableNumber: "A1",
            paymentMethod: "UPI",
            notes: undefined,
            items: [{ menuItemId: CHAI.MenuItemId, quantity: 1, selectedOptionIds: [] }]
        }));

    });

    it("surfaces the server's rejection message and leaves the cart intact when the order fails", async () => {

        const user = userEvent.setup();

        orderService.createOrder.mockResolvedValue({ success: false, message: "That table already has an open order." });

        renderBuilder();

        await screen.findByText("Ginger Chai");
        await addFromMenu(user, "Ginger Chai");
        await user.click(screen.getByRole("button", { name: /place order/i }));

        await waitFor(() => expect(orderService.createOrder).toHaveBeenCalled());

        // Rejected, not merely pending - the cart line staff already built is
        // still there (still showing a ₹30 subtotal), not silently cleared as
        // if the order had gone through.
        expect(screen.getByText(/subtotal: ₹\s*30\.00/i)).toBeInTheDocument();

    });

});

describe("PosOrderBuilder - keyboard shortcuts", () => {

    beforeEach(() => {
        window.print = vi.fn();
    });

    it("F2 places the order, same as clicking the button, once the cart has an item", async () => {

        const user = userEvent.setup();

        orderService.createOrder.mockResolvedValue({ success: true, data: { OrderId: 501, TotalAmount: 30 } });

        renderBuilder();

        await screen.findByText("Ginger Chai");
        await addFromMenu(user, "Ginger Chai");

        fireEvent.keyDown(window, { key: "F2" });

        await waitFor(() => expect(orderService.createOrder).toHaveBeenCalledTimes(1));

    });

    it("Ctrl+Enter also places the order", async () => {

        const user = userEvent.setup();

        orderService.createOrder.mockResolvedValue({ success: true, data: { OrderId: 502, TotalAmount: 30 } });

        renderBuilder();

        await screen.findByText("Ginger Chai");
        await addFromMenu(user, "Ginger Chai");

        fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

        await waitFor(() => expect(orderService.createOrder).toHaveBeenCalledTimes(1));

    });

    it("F2 does nothing with an empty cart, same as the disabled button", async () => {

        renderBuilder();

        await screen.findByText("Ginger Chai");

        fireEvent.keyDown(window, { key: "F2" });

        expect(orderService.createOrder).not.toHaveBeenCalled();

    });

    it("F1 focuses the menu search field", async () => {

        renderBuilder();

        await screen.findByText("Ginger Chai");

        fireEvent.keyDown(window, { key: "F1" });

        expect(screen.getByPlaceholderText(/search menu items/i)).toHaveFocus();

    });

    it("F3 prints the KOT once one exists, via the browser-print fallback (no thermal printer configured in this test)", async () => {

        const user = userEvent.setup();

        orderService.createOrder.mockResolvedValue({ success: true, data: { OrderId: 503, TotalAmount: 30 } });

        renderBuilder();

        await screen.findByText("Ginger Chai");
        await addFromMenu(user, "Ginger Chai");
        await user.click(screen.getByRole("button", { name: /place order/i }));

        await screen.findByText(/order #503 placed/i);

        fireEvent.keyDown(window, { key: "F3" });

        await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));

    });

});

describe("PosOrderBuilder - menu tile content integrity", () => {

    // jsdom performs no real layout, so a pixel-accurate "does this escape
    // its card's bounds" check (what the roadmap calls for) isn't possible
    // here - that needs a real browser/visual test. This instead guards the
    // failure mode actually seen in production: a name or price rendering as
    // an empty/undefined/NaN value rather than a visibly clipped one.
    it("never renders an item's name or price as empty, undefined or NaN", async () => {

        menuService.getAllMenuItems.mockResolvedValue({
            success: true,
            data: [
                { MenuItemId: 21, ItemName: "A Very Long Item Name That Could Wrap Or Truncate On A Narrow Tile", Price: 145, CategoryId: 1, IsAvailable: true, IsActive: true, HasOptions: false }
            ]
        });

        const { container } = renderBuilder();

        await screen.findByText(/a very long item name/i);

        expect(container.textContent).not.toMatch(/undefined|NaN|₹\s*$/);

    });

});
