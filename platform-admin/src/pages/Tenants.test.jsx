import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Tenants from "./Tenants";
import * as tenantService from "../services/tenantService";

vi.mock("../services/tenantService");

const sampleTenant = {
    TenantId: 1,
    TenantName: "Satish Bhau Dhaba",
    Slug: "satish-s-dhaba",
    OwnerEmail: "spatil@maildrop.cc",
    PlanType: "trial",
    IsActive: true,
    CreatedAt: "2026-07-25T00:00:00.000Z"
};

function renderTenants() {
    return render(
        <MemoryRouter>
            <Tenants />
        </MemoryRouter>
    );
}

beforeEach(() => {

    vi.clearAllMocks();
    tenantService.getAllTenants.mockResolvedValue({ success: true, data: [sampleTenant] });

});

describe("Tenants - owner password reset", () => {

    it("confirms, resets, and shows the new password exactly once", async () => {

        const user = userEvent.setup();

        tenantService.resetOwnerPassword.mockResolvedValue({
            success: true,
            message: "Password reset successfully.",
            data: { adminId: 5, email: sampleTenant.OwnerEmail, temporaryPassword: "abc123XYZ" }
        });

        renderTenants();

        await screen.findByText(sampleTenant.TenantName);

        await user.click(screen.getByRole("button", { name: `Reset owner password for ${sampleTenant.TenantName}` }));

        expect(await screen.findByText(/reset password\?/i)).toBeInTheDocument();

        // The owner's email also appears in the table cell behind the dialog -
        // scope this query to the dialog so it doesn't match both.
        const confirmDialog = screen.getByRole("dialog");
        expect(within(confirmDialog).getByText(new RegExp(sampleTenant.OwnerEmail))).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /^reset password$/i }));

        await waitFor(() => expect(tenantService.resetOwnerPassword).toHaveBeenCalledWith(sampleTenant.TenantId));

        // The copy-button interaction itself is covered by
        // TemporaryPasswordDialog.test.jsx - this just confirms Tenants.jsx
        // wires the reset response into that dialog correctly.
        expect(await screen.findByText("abc123XYZ")).toBeInTheDocument();

        // Confirm dialog is gone once the result dialog takes over.
        expect(screen.queryByRole("heading", { name: /reset password\?/i })).not.toBeInTheDocument();

    });

    it("shows an error and never opens the password dialog when the reset fails", async () => {

        const user = userEvent.setup();

        tenantService.resetOwnerPassword.mockResolvedValue({
            success: false,
            message: "No admin account found for this restaurant's owner email."
        });

        renderTenants();

        await screen.findByText(sampleTenant.TenantName);

        await user.click(screen.getByRole("button", { name: `Reset owner password for ${sampleTenant.TenantName}` }));
        await user.click(screen.getByRole("button", { name: /^reset password$/i }));

        await waitFor(() => expect(tenantService.resetOwnerPassword).toHaveBeenCalled());

        // Scoped to the heading role, not a plain text match - the confirm
        // dialog's own sentence ("...a new temporary password will be
        // generated...") contains this same substring, so a plain
        // queryByText(/temporary password/i) matches the wrong dialog.
        expect(screen.queryByRole("heading", { name: /temporary password/i })).not.toBeInTheDocument();

        // MUI's Dialog exit animation keeps it mounted for ~225ms after
        // close - waitFor gives it room instead of racing the transition.
        await waitFor(() => expect(screen.queryByRole("heading", { name: /reset password\?/i })).not.toBeInTheDocument());

    });

    it("cancelling the confirm dialog does not call the reset endpoint", async () => {

        const user = userEvent.setup();

        renderTenants();

        await screen.findByText(sampleTenant.TenantName);

        await user.click(screen.getByRole("button", { name: `Reset owner password for ${sampleTenant.TenantName}` }));
        await screen.findByText(/reset password\?/i);

        await user.click(screen.getByRole("button", { name: /cancel/i }));

        await waitFor(() => expect(screen.queryByRole("heading", { name: /reset password\?/i })).not.toBeInTheDocument());
        expect(tenantService.resetOwnerPassword).not.toHaveBeenCalled();

    });

});

describe("Tenants - onboarding shows the temporary password", () => {

    it("displays the owner's temporary password after creating a tenant", async () => {

        tenantService.getAllTenants.mockResolvedValue({ success: true, data: [] });
        tenantService.createTenant.mockResolvedValue({
            success: true,
            message: "Restaurant onboarded successfully.",
            data: {
                TenantId: 2,
                TenantName: "New Place",
                Slug: "new-place",
                ownerAdmin: { adminId: 9, email: "owner@newplace.test", temporaryPassword: "freshPass1" }
            }
        });

        const user = userEvent.setup();

        renderTenants();

        await user.click(screen.getByRole("button", { name: /onboard restaurant/i }));

        await user.type(screen.getByLabelText(/restaurant name/i), "New Place");
        await user.type(screen.getByLabelText(/owner email/i), "owner@newplace.test");

        await user.click(screen.getByRole("button", { name: /create tenant/i }));

        expect(await screen.findByText("freshPass1")).toBeInTheDocument();
        expect(screen.getByText("owner@newplace.test")).toBeInTheDocument();

    });

});
