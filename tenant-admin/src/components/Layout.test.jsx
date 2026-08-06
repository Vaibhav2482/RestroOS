import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import Layout from "./Layout";
import * as adminService from "../services/adminService";

vi.mock("../services/adminService");

const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, TenantId: 9, BranchId: 5, FullName: "Test Staff", Email: "staff@test.com", Permissions: [] }
};

beforeEach(() => {

    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));

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
