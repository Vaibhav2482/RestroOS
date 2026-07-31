import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as CustomerAuthService from "./CustomerAuthService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import * as TenantRepository from "../repositories/TenantRepository.js";
import { MAX_FAILED_ATTEMPTS } from "../config/lockoutPolicy.js";

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

    it("locks the account once failed attempts reach the threshold", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer({ FailedLoginAttempts: MAX_FAILED_ATTEMPTS - 1 }));
        bcrypt.compare.mockResolvedValue(false);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "wrong");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/too many failed attempts/i);
        expect(CustomerRepository.recordFailedLogin).toHaveBeenCalledWith(7, expect.any(Date));

    });

    it("rejects a login while locked out, without even checking the password", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(
            buildCustomer({ LockedUntil: new Date(Date.now() + 5 * 60 * 1000) })
        );

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "correct-password");

        expect(result.success).toBe(false);
        expect(bcrypt.compare).not.toHaveBeenCalled();

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
