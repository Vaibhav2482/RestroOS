import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Admins from "./Admins";
import * as adminService from "../services/adminService";
import * as branchService from "../services/branchService";

vi.mock("../services/adminService");
vi.mock("../services/branchService");

const OWNER_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: null, FullName: "Test Owner", Email: "owner@test.com" }
};

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(OWNER_AUTH));
    adminService.getAllAdmins.mockResolvedValue({ success: true, data: [] });
    branchService.getAllBranches.mockResolvedValue({ success: true, data: [{ BranchId: 5, BranchName: "Main Branch" }] });

});

describe("Admins - new Branch Admin defaults", () => {

    it("pre-checks the core operational permissions and leaves the non-core ones unchecked", async () => {

        const user = userEvent.setup();

        render(<Admins />);

        await user.click(await screen.findByRole("button", { name: /add staff/i }));

        await user.click(screen.getByLabelText(/branch access/i));
        await user.click(await screen.findByRole("option", { name: "Main Branch" }));

        const ordersCheckbox = screen.getByRole("checkbox", { name: /orders, take order \(pos\) & kitchen/i });
        const couponsCheckbox = screen.getByRole("checkbox", { name: /manage coupons/i });

        expect(ordersCheckbox).toBeChecked();
        expect(couponsCheckbox).not.toBeChecked();

    });

    it("submits the pre-checked core permissions when creating a new Branch Admin without touching them", async () => {

        const user = userEvent.setup();

        adminService.createAdmin.mockResolvedValue({ success: true, message: "Admin created successfully.", data: {} });

        render(<Admins />);

        await user.click(await screen.findByRole("button", { name: /add staff/i }));

        await user.click(screen.getByLabelText(/branch access/i));
        await user.click(await screen.findByRole("option", { name: "Main Branch" }));

        await user.type(screen.getByLabelText(/full name/i), "New Hire");
        await user.type(screen.getByLabelText(/^email/i), "newhire@test.com");
        await user.type(screen.getByLabelText(/^password/i), "Password123");

        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: /create staff/i }));

        expect(adminService.createAdmin).toHaveBeenCalledWith(
            expect.objectContaining({
                permissions: expect.arrayContaining(["manage_orders", "manage_menu", "manage_inventory"])
            })
        );

    });

});
