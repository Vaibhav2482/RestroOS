import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import Layout from "./Layout";
import * as adminService from "../services/adminService";
import * as tenantService from "../services/tenantService";

vi.mock("../services/adminService");
vi.mock("../services/tenantService");

const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, TenantId: 9, BranchId: 5, FullName: "Test Staff", Email: "staff@test.com", Permissions: [], tenantDisabledFeatures: [] }
};

beforeEach(() => {

    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));
    tenantService.getOwnTenant.mockResolvedValue({ success: true, data: { DisabledFeatures: [] } });

});

afterEach(() => {
    vi.useRealTimers();
});

describe("Layout - live permission refresh", () => {

    it("does not show a permission-gated nav item until the periodic refresh picks up the grant", async () => {

        adminService.getOwnProfile.mockResolvedValue({
            success: true,
            data: { ...BRANCH_ADMIN_AUTH.admin, Permissions: [] }
        });

        render(
            <MemoryRouter>
                <Layout><div>content</div></Layout>
            </MemoryRouter>
        );

        expect(screen.queryAllByText("Coupons")).toHaveLength(0);

        // The Owner grants manage_coupons out-of-band (a real scenario:
        // another browser tab, another device) - this admin's own session
        // only finds out once the periodic refresh below calls /admins/me.
        adminService.getOwnProfile.mockResolvedValue({
            success: true,
            data: { ...BRANCH_ADMIN_AUTH.admin, Permissions: ["manage_coupons"] }
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60000);
        });

        expect(screen.getAllByText("Coupons").length).toBeGreaterThan(0);

    });

    it("hides an owner-only nav item when the tenant disables its feature, even for the Owner", async () => {

        const OWNER_AUTH = {
            token: "test-token",
            admin: { AdminId: 2, TenantId: 9, BranchId: null, FullName: "Test Owner", Email: "owner@test.com", Permissions: [], tenantDisabledFeatures: [] }
        };

        localStorage.setItem("tenantAdmin", JSON.stringify(OWNER_AUTH));
        adminService.getOwnProfile.mockResolvedValue({ success: true, data: OWNER_AUTH.admin });
        tenantService.getOwnTenant.mockResolvedValue({ success: true, data: { DisabledFeatures: [] } });

        render(
            <MemoryRouter>
                <Layout><div>content</div></Layout>
            </MemoryRouter>
        );

        expect(screen.getAllByText("Branches").length).toBeGreaterThan(0);

        // The Owner disabled manage_branches from another device/tab.
        tenantService.getOwnTenant.mockResolvedValue({ success: true, data: { DisabledFeatures: ["manage_branches"] } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60000);
        });

        expect(screen.queryAllByText("Branches")).toHaveLength(0);

    });

    it("does not touch localStorage when the refresh reports no change", async () => {

        adminService.getOwnProfile.mockResolvedValue({
            success: true,
            data: { ...BRANCH_ADMIN_AUTH.admin }
        });

        render(
            <MemoryRouter>
                <Layout><div>content</div></Layout>
            </MemoryRouter>
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60000);
        });

        expect(JSON.parse(localStorage.getItem("tenantAdmin"))).toEqual(BRANCH_ADMIN_AUTH);

    });

});
