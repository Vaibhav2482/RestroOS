import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Menu from "./Menu";
import * as menuService from "../services/menuService";
import * as categoryService from "../services/categoryService";

vi.mock("../services/menuService");
vi.mock("../services/categoryService");

// A non-owner (branch-scoped) admin skips the branch-loading path entirely,
// same trick Orders.test.jsx/Kitchen.test.jsx use to avoid also mocking
// branchService.
const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, Email: "staff@test.com" }
};

const CATEGORY = { CategoryId: 1, CategoryName: "Beverages" };

const items = [
    { MenuItemId: 10, ItemName: "Ginger Chai", CategoryId: 1, CategoryName: "Beverages", Price: 30, IsVeg: true, IsAvailable: true, IsPopular: false, IsActive: true },
    { MenuItemId: 11, ItemName: "Cold Coffee", CategoryId: 1, CategoryName: "Beverages", Price: 60, IsVeg: true, IsAvailable: true, IsPopular: false, IsActive: true }
];

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));

    categoryService.getAllCategories.mockResolvedValue({ success: true, data: [CATEGORY] });
    menuService.getAllMenuItems.mockResolvedValue({ success: true, data: items });
    menuService.updateMenuItem.mockResolvedValue({ success: true, data: {} });

});

// Deleting a single item already asks first - bulk-hiding (or restoring)
// an entire category used to fire straight off the click with no
// confirmation at all, even though it's the more consequential action:
// one fat-fingered tap could take a whole category off the menu
// mid-service with nothing to catch it.
describe("Menu - bulk availability requires confirmation", () => {

    it("does not call the API the instant '86 All' is clicked - it opens a confirmation dialog first", async () => {

        const user = userEvent.setup();

        render(<Menu />);

        await screen.findByText("Ginger Chai");

        await user.click(screen.getByRole("button", { name: /^86 all \(2\)$/i }));

        expect(menuService.updateMenuItem).not.toHaveBeenCalled();
        expect(await screen.findByText(/mark all 2 items in "beverages" as out of stock/i)).toBeInTheDocument();

    });

    it("only calls the API once the bulk action is confirmed", async () => {

        const user = userEvent.setup();

        render(<Menu />);

        await screen.findByText("Ginger Chai");

        await user.click(screen.getByRole("button", { name: /^86 all \(2\)$/i }));
        await screen.findByText(/mark all 2 items/i);

        // Two buttons now share the label "86 All" - the row action and the
        // dialog's own confirm button - so this scopes to the dialog.
        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: /^86 all$/i }));

        await waitFor(() => expect(menuService.updateMenuItem).toHaveBeenCalledTimes(2));
        expect(menuService.updateMenuItem).toHaveBeenCalledWith(10, expect.objectContaining({ isAvailable: false }));
        expect(menuService.updateMenuItem).toHaveBeenCalledWith(11, expect.objectContaining({ isAvailable: false }));

    });

    it("does nothing when the confirmation is cancelled", async () => {

        const user = userEvent.setup();

        render(<Menu />);

        await screen.findByText("Ginger Chai");

        await user.click(screen.getByRole("button", { name: /^86 all \(2\)$/i }));
        await screen.findByText(/mark all 2 items/i);

        await user.click(screen.getByRole("button", { name: /^cancel$/i }));

        expect(menuService.updateMenuItem).not.toHaveBeenCalled();
        expect(screen.queryByText(/mark all 2 items/i)).not.toBeInTheDocument();

    });

    it("also confirms before restoring a category with 'Mark All Available'", async () => {

        const user = userEvent.setup();

        render(<Menu />);

        await screen.findByText("Ginger Chai");

        await user.click(screen.getByRole("button", { name: /^mark all available$/i }));

        expect(menuService.updateMenuItem).not.toHaveBeenCalled();
        expect(await screen.findByText(/mark all 2 items in "beverages" as available again/i)).toBeInTheDocument();

    });

});
