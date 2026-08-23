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
    ...overrides
});

beforeEach(() => {

    vi.clearAllMocks();

    TenantRepository.getBySlug.mockResolvedValue(tenant);

});

describe("CustomerAuthService.login", () => {

    it("rejects a wrong password with the generic message", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer());
        bcrypt.compare.mockResolvedValue(false);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "wrong");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Invalid Email or Password.");

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

    it("logs in successfully with the correct password", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer());
        bcrypt.compare.mockResolvedValue(true);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "correct-password");

        expect(result.success).toBe(true);

    });

    it("never includes the password hash in the response", async () => {

        CustomerRepository.customerLogin.mockResolvedValue(buildCustomer());
        bcrypt.compare.mockResolvedValue(true);

        const result = await CustomerAuthService.login("alpha-diner", "ravi@example.com", "correct-password");

        expect(result.data.Password).toBeUndefined();

    });

});
