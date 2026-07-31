import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as PlatformAdminService from "./PlatformAdminService.js";
import * as PlatformAdminRepository from "../repositories/PlatformAdminRepository.js";
import { MAX_FAILED_ATTEMPTS } from "../config/lockoutPolicy.js";

vi.mock("../repositories/PlatformAdminRepository.js");
vi.mock("bcrypt");

const buildAdmin = (overrides = {}) => ({
    PlatformAdminId: 1,
    FullName: "Ops",
    Email: "ops@restroos.app",
    Password: "hashed-password",
    FailedLoginAttempts: 0,
    LockedUntil: null,
    ...overrides
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("PlatformAdminService.login", () => {

    it("rejects a wrong password and records the failed attempt", async () => {

        PlatformAdminRepository.getByEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: 1 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await PlatformAdminService.login("ops@restroos.app", "wrong");

        expect(result.success).toBe(false);
        expect(PlatformAdminRepository.recordFailedLogin).toHaveBeenCalledWith(1, null);

    });

    it("locks the account once failed attempts reach the threshold", async () => {

        PlatformAdminRepository.getByEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: MAX_FAILED_ATTEMPTS - 1 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await PlatformAdminService.login("ops@restroos.app", "wrong");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/too many failed attempts/i);
        expect(PlatformAdminRepository.recordFailedLogin).toHaveBeenCalledWith(1, expect.any(Date));

    });

    it("rejects a login while locked out, without even checking the password", async () => {

        PlatformAdminRepository.getByEmail.mockResolvedValue(
            buildAdmin({ LockedUntil: new Date(Date.now() + 5 * 60 * 1000) })
        );

        const result = await PlatformAdminService.login("ops@restroos.app", "correct-password");

        expect(result.success).toBe(false);
        expect(bcrypt.compare).not.toHaveBeenCalled();

    });

    it("resets the failed-attempt counter on a successful login", async () => {

        PlatformAdminRepository.getByEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: 3 }));
        bcrypt.compare.mockResolvedValue(true);

        const result = await PlatformAdminService.login("ops@restroos.app", "correct-password");

        expect(result.success).toBe(true);
        expect(PlatformAdminRepository.resetFailedLogins).toHaveBeenCalledWith(1);

    });

    it("never includes the password hash or lockout bookkeeping fields in the response", async () => {

        PlatformAdminRepository.getByEmail.mockResolvedValue(buildAdmin());
        bcrypt.compare.mockResolvedValue(true);

        const result = await PlatformAdminService.login("ops@restroos.app", "correct-password");

        expect(result.data.Password).toBeUndefined();
        expect(result.data.FailedLoginAttempts).toBeUndefined();
        expect(result.data.LockedUntil).toBeUndefined();

    });

});
