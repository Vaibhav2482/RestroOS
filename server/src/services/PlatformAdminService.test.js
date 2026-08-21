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

describe("PlatformAdminService.bootstrapFirstAdmin", () => {

    it("rejects a password shorter than 8 characters", async () => {

        PlatformAdminRepository.count.mockResolvedValue(0);

        const result = await PlatformAdminService.bootstrapFirstAdmin({
            fullName: "Ops", email: "ops@restroos.app", password: "short1"
        });

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/at least 8 characters/i);
        expect(PlatformAdminRepository.create).not.toHaveBeenCalled();

    });

    it("creates the account when a platform admin doesn't exist yet and the password clears the floor", async () => {

        PlatformAdminRepository.count.mockResolvedValue(0);
        bcrypt.hash.mockResolvedValue("hashed-password");
        PlatformAdminRepository.create.mockResolvedValue(buildAdmin());

        const result = await PlatformAdminService.bootstrapFirstAdmin({
            fullName: "Ops", email: "ops@restroos.app", password: "a-real-passphrase"
        });

        expect(result.success).toBe(true);
        expect(PlatformAdminRepository.create).toHaveBeenCalledWith({
            fullName: "Ops", email: "ops@restroos.app", password: "hashed-password"
        });

    });

    it("still refuses once a platform admin already exists, regardless of password strength", async () => {

        PlatformAdminRepository.count.mockResolvedValue(1);

        const result = await PlatformAdminService.bootstrapFirstAdmin({
            fullName: "Ops", email: "ops@restroos.app", password: "a-real-passphrase"
        });

        expect(result.success).toBe(false);
        expect(PlatformAdminRepository.create).not.toHaveBeenCalled();

    });

});

describe("PlatformAdminService.changeOwnPassword", () => {

    it("rejects a new password shorter than 8 characters", async () => {

        const result = await PlatformAdminService.changeOwnPassword(1, "oldpass123", "short");

        expect(result.success).toBe(false);
        expect(PlatformAdminRepository.getPasswordHash).not.toHaveBeenCalled();

    });

    it("rejects when the current password doesn't match", async () => {

        PlatformAdminRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(false);

        const result = await PlatformAdminService.changeOwnPassword(1, "wrong-current", "brandnewpassword");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/incorrect/i);
        expect(PlatformAdminRepository.updatePassword).not.toHaveBeenCalled();

    });

    it("changes the password when the current password is correct", async () => {

        PlatformAdminRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(true);
        bcrypt.hash.mockResolvedValue("hashed-new-password");

        const result = await PlatformAdminService.changeOwnPassword(1, "correct-current", "brandnewpassword");

        expect(result.success).toBe(true);
        expect(PlatformAdminRepository.updatePassword).toHaveBeenCalledWith(1, "hashed-new-password");

    });

});
