import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as CustomerAuthService from "./CustomerAuthService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import * as TenantRepository from "../repositories/TenantRepository.js";

vi.mock("../repositories/CustomerRepository.js");
vi.mock("../repositories/TenantRepository.js");
vi.mock("bcrypt");

const tenant = { TenantId: 9, Slug: "alpha-diner", IsActive: true };

const buildCustomer = (overrides = {}) => ({
    CustomerId: 7,
    TenantId: 9,
    FullName: "Ravi Kumar",
    Email: "ravi@example.com",
    Password: "hashed-password",
    FailedLoginAttempts: 0,
    LockedUntil: null,
    ...overrides
});

beforeEach(() => {

    vi.clearAllMocks();

    TenantRepository.getBySlug.mockResolvedValue(tenant);

});

describe("CustomerAuthService.login", () => {

    it("rejects a wrong password and records the failed attempt", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer({ FailedLoginAttempts: 1 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "wrong");

        expect(result.success).toBe(false);
        expect(CustomerRepository.recordFailedLogin).toHaveBeenCalledWith(7, null);

    });

    it("never locks the account, however many attempts have already failed", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer({ FailedLoginAttempts: 99 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "wrong");

        expect(result.success).toBe(false);
        // The generic message, never a lockout one - and null, never a Date,
        // so no threshold can quietly reappear here.
        expect(result.message).toBe("Invalid Email or Password.");
        expect(CustomerRepository.recordFailedLogin).toHaveBeenCalledWith(7, null);

    });

    it("gives an unknown email and a wrong password the identical message", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(null);
        const unknown = await CustomerAuthService.login("alpha-diner", "nobody@example.com", "whatever");

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer());
        bcrypt.compare.mockResolvedValue(false);
        const wrongPassword = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "wrong");

        // Any difference here, down to capitalisation, tells an attacker
        // which addresses are registered.
        expect(unknown.message).toBe(wrongPassword.message);

    });

    it("ignores a LockedUntil still sitting in the database from before lockout was removed", async () => {

        // Rows locked while the old policy was live keep their LockedUntil -
        // nothing clears it - so the only thing stopping those accounts from
        // being permanently shut out is that login no longer reads it.
        CustomerRepository.customerLogin.mockResolvedValue(
            buildCustomer({ LockedUntil: new Date(Date.now() + 5 * 60 * 1000) })
        );
        bcrypt.compare.mockResolvedValue(true);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "correct-password");

        expect(result.success).toBe(true);

    });

    it("resets the failed-attempt counter on a successful login", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer({ FailedLoginAttempts: 3 }));
        bcrypt.compare.mockResolvedValue(true);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "correct-password");

        expect(result.success).toBe(true);
        expect(CustomerRepository.resetFailedLogins).toHaveBeenCalledWith(7);

    });

    it("never includes the password hash or lockout bookkeeping fields in the response", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer());
        bcrypt.compare.mockResolvedValue(true);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "correct-password");

        expect(result.data.Password).toBeUndefined();
        expect(result.data.FailedLoginAttempts).toBeUndefined();
        expect(result.data.LockedUntil).toBeUndefined();

    });

});
