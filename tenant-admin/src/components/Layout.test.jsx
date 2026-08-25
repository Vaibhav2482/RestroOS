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

    // jsdom doesn't implement real navigation - stub location so the forced
    // relogin's `window.location.href = ...` assignment is observable
    // instead of silently no-op'ing with a "Not implemented" warning.
    delete window.location;
    window.location = { href: "" };

});

afterEach(() => {
    vi.useRealTimers();
});

describe("Layout - live permission refresh", () => {

    it("forces a re-login when the periodic refresh finds a staff permission changed elsewhere", async () => {

        adminService.getOwnProfile.mockResolvedValue({
            success: true,
            data: { ...BRANCH_ADMIN_AUTH.admin, Permissions: [] }
        });

        render(
            <MemoryRouter>
                <Layout><div>content</div></Layout>
            </MemoryRouter>
        );

        // The Owner grants (or revokes) manage_coupons out-of-band (a real
        // scenario: another browser tab, another device) - this admin's own
        // session only finds out once the periodic refresh below calls
        // /admins/me, and should be dropped back to login rather than just
        // having its nav quietly rearranged underneath it.
        adminService.getOwnProfile.mockResolvedValue({
            success: true,
            data: { ...BRANCH_ADMIN_AUTH.admin, Permissions: ["manage_coupons"] }
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60000);
        });

        expect(localStorage.getItem("tenantAdmin")).toBeNull();
        expect(window.location.href).toContain("/login?reason=access-changed");

    });

    it("forces a re-login when the tenant's own feature toggle changes, even for the Owner", async () => {

        const OWNER_AUTH = {
            token: "test-token",
            admin: { AdminId: 2, TenantId: 9, BranchId: null, FullName: "Test Owner", Email: "owner@test.com", Permissions: [], tenantDisabledFeatures: [], tenantPlatformRestrictedFeatures: [] }
        };

        localStorage.setItem("tenantAdmin", JSON.stringify(OWNER_AUTH));
        adminService.getOwnProfile.mockResolvedValue({ success: true, data: OWNER_AUTH.admin });
        tenantService.getOwnTenant.mockResolvedValue({ success: true, data: { DisabledFeatures: [], PlatformRestrictedFeatures: [] } });

        render(
            <MemoryRouter>
                <Layout><div>content</div></Layout>
            </MemoryRouter>
        );

        // The Owner disabled manage_branches from another device/tab.
        tenantService.getOwnTenant.mockResolvedValue({ success: true, data: { DisabledFeatures: ["manage_branches"], PlatformRestrictedFeatures: [] } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60000);
        });

        expect(localStorage.getItem("tenantAdmin")).toBeNull();
        expect(window.location.href).toContain("/login?reason=access-changed");

    });

    it("forces a re-login when a platform admin newly restricts a feature mid-session", async () => {

        const OWNER_AUTH = {
            token: "test-token",
            admin: { AdminId: 2, TenantId: 9, BranchId: null, FullName: "Test Owner", Email: "owner@test.com", Permissions: [], tenantDisabledFeatures: [], tenantPlatformRestrictedFeatures: [] }
        };

        localStorage.setItem("tenantAdmin", JSON.stringify(OWNER_AUTH));
        adminService.getOwnProfile.mockResolvedValue({ success: true, data: OWNER_AUTH.admin });
        tenantService.getOwnTenant.mockResolvedValue({ success: true, data: { DisabledFeatures: [], PlatformRestrictedFeatures: [] } });

        render(
            <MemoryRouter>
                <Layout><div>content</div></Layout>
            </MemoryRouter>
        );

        // A platform admin restricts manage_delivery for this tenant's plan
        // while the Owner is already logged in.
        tenantService.getOwnTenant.mockResolvedValue({ success: true, data: { DisabledFeatures: [], PlatformRestrictedFeatures: ["manage_delivery"] } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60000);
        });

        expect(localStorage.getItem("tenantAdmin")).toBeNull();
        expect(window.location.href).toContain("/login?reason=access-changed");

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
