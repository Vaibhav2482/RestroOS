import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as AdminAuthService from "./AdminAuthService.js";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as TenantRepository from "../repositories/TenantRepository.js";
import { MAX_FAILED_ATTEMPTS } from "../config/lockoutPolicy.js";

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

    it("locks the account once failed attempts reach the threshold", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: MAX_FAILED_ATTEMPTS - 1 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "wrong");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/too many failed attempts/i);
        expect(AdminRepository.recordFailedLogin).toHaveBeenCalledWith(3, expect.any(Date));

    });

    it("rejects a login while locked out, without even checking the password", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(
            buildAdmin({ LockedUntil: new Date(Date.now() + 5 * 60 * 1000) })
        );

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "correct-password");

        expect(result.success).toBe(false);
        expect(bcrypt.compare).not.toHaveBeenCalled();

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
