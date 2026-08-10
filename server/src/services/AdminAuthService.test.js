import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as AdminAuthService from "./AdminAuthService.js";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as TenantRepository from "../repositories/TenantRepository.js";

vi.mock("../repositories/AdminRepository.js");
vi.mock("../repositories/TenantRepository.js");
vi.mock("bcrypt");

const tenant = { TenantId: 9, Slug: "alpha-diner", TenantName: "Alpha Diner", IsActive: true };

const buildAdmin = (overrides = {}) => ({
    AdminId: 3,
    TenantId: 9,
    FullName: "Owner",
    Email: "owner@alpha.test",
    Password: "hashed-password",
    BranchId: null,
    FailedLoginAttempts: 0,
    LockedUntil: null,
    ...overrides
});

beforeEach(() => {

    vi.clearAllMocks();

    TenantRepository.getBySlug.mockResolvedValue(tenant);

});

describe("AdminAuthService.login", () => {

    it("rejects a wrong password and records the failed attempt", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: 1 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "wrong");

        expect(result.success).toBe(false);
        expect(AdminRepository.recordFailedLogin).toHaveBeenCalledWith(3, null);

    });

    it("never locks the account, however many attempts have already failed", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: 99 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "wrong");

        expect(result.success).toBe(false);
        // The generic message, never a lockout one - and null, never a Date,
        // so no threshold can quietly reappear here.
        expect(result.message).toBe("Invalid email or password.");
        expect(AdminRepository.recordFailedLogin).toHaveBeenCalledWith(3, null);

    });

    it("ignores a LockedUntil still sitting in the database from before lockout was removed", async () => {

        // Rows locked while the old policy was live keep their LockedUntil -
        // nothing clears it - so the only thing stopping those accounts from
        // being permanently shut out is that login no longer reads it.
        AdminRepository.getByTenantAndEmail.mockResolvedValue(
            buildAdmin({ LockedUntil: new Date(Date.now() + 5 * 60 * 1000) })
        );
        bcrypt.compare.mockResolvedValue(true);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "correct-password");

        expect(result.success).toBe(true);

    });

    it("allows login again once the lockout window has passed", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(
            buildAdmin({ LockedUntil: new Date(Date.now() - 60 * 1000) })
        );
        bcrypt.compare.mockResolvedValue(true);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "correct-password");

        expect(result.success).toBe(true);

    });

    it("resets the failed-attempt counter on a successful login", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: 3 }));
        bcrypt.compare.mockResolvedValue(true);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "correct-password");

        expect(result.success).toBe(true);
        expect(AdminRepository.resetFailedLogins).toHaveBeenCalledWith(3);

    });

    it("never includes the password hash or lockout bookkeeping fields in the response", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin());
        bcrypt.compare.mockResolvedValue(true);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "correct-password");

        expect(result.data.Password).toBeUndefined();
        expect(result.data.FailedLoginAttempts).toBeUndefined();
        expect(result.data.LockedUntil).toBeUndefined();

    });

});
