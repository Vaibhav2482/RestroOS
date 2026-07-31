import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ItemCustomizationDialog from "./ItemCustomizationDialog";
import * as menuOptionService from "../services/menuOptionService";
import * as cartService from "../services/cartService";
import * as publicService from "../services/publicService";
import { useStorefront } from "../context/StorefrontContext";

vi.mock("../services/menuOptionService");
vi.mock("../services/cartService");
vi.mock("../services/publicService");
vi.mock("../context/StorefrontContext");

const ITEM = { MenuItemId: 10, ItemName: "Veg Burger", Price: 150 };

const REQUIRED_GROUP_NO_DEFAULT = {
    GroupId: 1,
    GroupName: "Spice Level",
    IsRequired: true,
    MinSelect: 1,
    MaxSelect: 1,
    Options: [
        { OptionId: 101, OptionName: "Mild", PriceDelta: 0, IsDefault: false, IsActive: true },
        { OptionId: 102, OptionName: "Spicy", PriceDelta: 0, IsDefault: false, IsActive: true }
    ]
};

beforeEach(() => {

    vi.clearAllMocks();

    useStorefront.mockReturnValue({
        customer: { CustomerId: 1 },
        refreshCartCount: vi.fn()
    });

    publicService.getRecommendations.mockResolvedValue({ success: true, data: [] });

});

describe("ItemCustomizationDialog - required group validation", () => {

    it("keeps Add Item disabled until a required group with no default is answered", async () => {

        const user = userEvent.setup();

        menuOptionService.getGroupsForMenuItem.mockResolvedValue({ success: true, data: [REQUIRED_GROUP_NO_DEFAULT] });

        render(<ItemCustomizationDialog open item={ITEM} onClose={vi.fn()} />);

        await screen.findByText("Spicy");

        expect(screen.getByRole("button", { name: /add item/i })).toBeDisabled();

        await user.click(screen.getByRole("radio", { name: /mild/i }));

        expect(screen.getByRole("button", { name: /add item/i })).toBeEnabled();

    });

});

describe("ItemCustomizationDialog - option pricing display", () => {

    it("shows a discounted (negative PriceDelta) option with a minus sign, not blank", async () => {

        menuOptionService.getGroupsForMenuItem.mockResolvedValue({
            success: true,
            data: [{
                GroupId: 2,
                GroupName: "Portion",
                IsRequired: true,
                MinSelect: 1,
                MaxSelect: 1,
                Options: [
                    { OptionId: 201, OptionName: "Regular", PriceDelta: 0, IsDefault: true, IsActive: true },
                    { OptionId: 202, OptionName: "Small", PriceDelta: -20, IsDefault: false, IsActive: true }
                ]
            }]
        });

        render(<ItemCustomizationDialog open item={ITEM} onClose={vi.fn()} />);

        expect(await screen.findByText("-₹20.00")).toBeInTheDocument();

    });

});

describe("ItemCustomizationDialog - quick-add recommendations", () => {

    it("tells the parent page to reload its cart after a quick-add, not just the header badge", async () => {

        const user = userEvent.setup();
        const onCartChanged = vi.fn();
        const refreshCartCount = vi.fn();

        useStorefront.mockReturnValue({ customer: { CustomerId: 1 }, refreshCartCount });

        menuOptionService.getGroupsForMenuItem.mockResolvedValue({ success: true, data: [] });
        publicService.getRecommendations.mockResolvedValue({
            success: true,
            data: [{ MenuItemId: 20, ItemName: "Fries", Price: 80, HasOptions: false }]
        });
        cartService.addToCart.mockResolvedValue({ success: true, data: { CartId: 999 } });

        render(<ItemCustomizationDialog open item={ITEM} onClose={vi.fn()} onCartChanged={onCartChanged} />);

        await user.click(await screen.findByRole("button", { name: "Add Fries" }));

        await waitFor(() => expect(cartService.addToCart).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: 1, menuItemId: 20, quantity: 1 })
        ));

        expect(refreshCartCount).toHaveBeenCalled();
        expect(onCartChanged).toHaveBeenCalled();

    });

});
