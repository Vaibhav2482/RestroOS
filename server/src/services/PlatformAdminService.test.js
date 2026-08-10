import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as PlatformAdminService from "./PlatformAdminService.js";
import * as PlatformAdminRepository from "../repositories/PlatformAdminRepository.js";

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

    it("never locks the account, however many attempts have already failed", async () => {

        PlatformAdminRepository.getByEmail.mockResolvedValue(buildAdmin({ FailedLoginAttempts: 99 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await PlatformAdminService.login("ops@restroos.app", "wrong");

        expect(result.success).toBe(false);
        // The generic message, never a lockout one - and null, never a Date,
        // so no threshold can quietly reappear here.
        expect(result.message).toBe("Invalid email or password.");
        expect(PlatformAdminRepository.recordFailedLogin).toHaveBeenCalledWith(1, null);

    });

    it("ignores a LockedUntil still sitting in the database from before lockout was removed", async () => {

        // This is the most privileged account on the platform, and it is also
        // the one with no other way back in if it were left locked.
        PlatformAdminRepository.getByEmail.mockResolvedValue(
            buildAdmin({ LockedUntil: new Date(Date.now() + 5 * 60 * 1000) })
        );
        bcrypt.compare.mockResolvedValue(true);

        const result = await PlatformAdminService.login("ops@restroos.app", "correct-password");

        expect(result.success).toBe(true);

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
