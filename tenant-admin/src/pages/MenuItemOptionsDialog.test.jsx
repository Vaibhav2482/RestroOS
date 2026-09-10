import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import MenuItemOptionsDialog from "./MenuItemOptionsDialog";
import * as menuOptionService from "../services/menuOptionService";

vi.mock("../services/menuOptionService");

const MENU_ITEM = { MenuItemId: 10, ItemName: "Buttermilk / Chaas" };

beforeEach(() => {
    vi.clearAllMocks();
});

// A Required group with no active option is impossible for a customer to
// satisfy - the storefront and order-creation both skip enforcing it as a
// safety net (so the item stays orderable), but that's not a substitute
// for the admin actually noticing and fixing it. This is the one place
// that says so.
describe("MenuItemOptionsDialog - warns about a Required group with no active options", () => {

    it("shows a warning, not just 'No options yet', when a Required group is empty", async () => {

        menuOptionService.getOptionGroupsByMenuItem.mockResolvedValue({
            success: true,
            data: [{ GroupId: 1, GroupName: "Butter", IsRequired: true, MinSelect: 1, MaxSelect: 5, Options: [] }]
        });

        render(<MenuItemOptionsDialog open menuItem={MENU_ITEM} onClose={vi.fn()} />);

        expect(await screen.findByText(/this group is required but has no active options/i)).toBeInTheDocument();
        expect(screen.queryByText("No options yet.")).not.toBeInTheDocument();

    });

    it("shows a warning when every option in a Required group is deactivated, not just when there are none", async () => {

        menuOptionService.getOptionGroupsByMenuItem.mockResolvedValue({
            success: true,
            data: [{
                GroupId: 1,
                GroupName: "Butter",
                IsRequired: true,
                MinSelect: 1,
                MaxSelect: 5,
                Options: [{ OptionId: 101, OptionName: "Extra Butter", PriceDelta: 10, IsActive: false }]
            }]
        });

        render(<MenuItemOptionsDialog open menuItem={MENU_ITEM} onClose={vi.fn()} />);

        expect(await screen.findByText(/this group is required but has no active options/i)).toBeInTheDocument();

    });

    it("shows the plain 'No options yet' message for an Optional (not Required) empty group", async () => {

        menuOptionService.getOptionGroupsByMenuItem.mockResolvedValue({
            success: true,
            data: [{ GroupId: 1, GroupName: "Toppings", IsRequired: false, MinSelect: 0, MaxSelect: 5, Options: [] }]
        });

        render(<MenuItemOptionsDialog open menuItem={MENU_ITEM} onClose={vi.fn()} />);

        expect(await screen.findByText("No options yet.")).toBeInTheDocument();
        expect(screen.queryByText(/this group is required but has no active options/i)).not.toBeInTheDocument();

    });

    it("shows neither message once the Required group has an active option", async () => {

        menuOptionService.getOptionGroupsByMenuItem.mockResolvedValue({
            success: true,
            data: [{
                GroupId: 1,
                GroupName: "Butter",
                IsRequired: true,
                MinSelect: 1,
                MaxSelect: 5,
                Options: [{ OptionId: 101, OptionName: "Extra Butter", PriceDelta: 10, IsActive: true }]
            }]
        });

        render(<MenuItemOptionsDialog open menuItem={MENU_ITEM} onClose={vi.fn()} />);

        await screen.findByText("Extra Butter");

        expect(screen.queryByText(/this group is required but has no active options/i)).not.toBeInTheDocument();
        expect(screen.queryByText("No options yet.")).not.toBeInTheDocument();

    });

});
