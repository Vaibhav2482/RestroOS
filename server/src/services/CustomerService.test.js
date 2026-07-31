import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as CustomerService from "./CustomerService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

vi.mock("../repositories/CustomerRepository.js");
vi.mock("bcrypt");

const CUSTOMER_ID = 7;

const existingCustomer = {
    CustomerId: CUSTOMER_ID,
    TenantId: 9,
    FullName: "Ravi Kumar",
    Email: "ravi@example.com",
    Phone: "9876543210",
    AvatarUrl: null,
    IsActive: true
};

beforeEach(() => {

    vi.clearAllMocks();

    CustomerRepository.getCustomerById.mockResolvedValue(existingCustomer);

});

describe("CustomerService.updateCustomer", () => {

    it("rejects a missing full name", async () => {

        const result = await CustomerService.updateCustomer(CUSTOMER_ID, { fullName: "  ", email: "ravi@example.com", phone: "9876543210" });

        expect(result.success).toBe(false);
        expect(CustomerRepository.updateCustomer).not.toHaveBeenCalled();

    });

    it("rejects a missing phone", async () => {

        const result = await CustomerService.updateCustomer(CUSTOMER_ID, { fullName: "Ravi Kumar", email: "ravi@example.com", phone: "" });

        expect(result.success).toBe(false);
        expect(CustomerRepository.updateCustomer).not.toHaveBeenCalled();

    });

    it("rejects an email already used by a different customer in the same tenant", async () => {

        CustomerRepository.getCustomerByTenantAndEmail.mockResolvedValue({ CustomerId: 999, Email: "taken@example.com" });

        const result = await CustomerService.updateCustomer(CUSTOMER_ID, { fullName: "Ravi Kumar", email: "taken@example.com", phone: "9876543210" });

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/already registered/i);
        expect(CustomerRepository.updateCustomer).not.toHaveBeenCalled();

    });

    it("allows keeping your own current email unchanged without a uniqueness lookup", async () => {

        CustomerRepository.updateCustomer.mockResolvedValue(existingCustomer);

        await CustomerService.updateCustomer(CUSTOMER_ID, { fullName: "Ravi Kumar", email: "ravi@example.com", phone: "9876543210" });

        expect(CustomerRepository.getCustomerByTenantAndEmail).not.toHaveBeenCalled();
        expect(CustomerRepository.updateCustomer).toHaveBeenCalled();

    });

    it("updates name, phone, and avatar", async () => {

        CustomerRepository.updateCustomer.mockResolvedValue({ ...existingCustomer, FullName: "Ravi K.", AvatarUrl: "https://cdn/img.jpg" });

        const result = await CustomerService.updateCustomer(CUSTOMER_ID, {
            fullName: "Ravi K.",
            email: "ravi@example.com",
            phone: "9876543210",
            avatarUrl: "https://cdn/img.jpg"
        });

        expect(result.success).toBe(true);
        expect(CustomerRepository.updateCustomer).toHaveBeenCalledWith(
            expect.objectContaining({ fullName: "Ravi K.", avatarUrl: "https://cdn/img.jpg" })
        );

    });

    it("keeps the existing avatar when none is supplied", async () => {

        CustomerRepository.updateCustomer.mockResolvedValue(existingCustomer);

        await CustomerService.updateCustomer(CUSTOMER_ID, { fullName: "Ravi Kumar", email: "ravi@example.com", phone: "9876543210" });

        expect(CustomerRepository.updateCustomer).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: null }));

    });

});

describe("CustomerService.changeOwnPassword", () => {

    it("rejects a new password shorter than 8 characters", async () => {

        const result = await CustomerService.changeOwnPassword(CUSTOMER_ID, "oldpass123", "short");

        expect(result.success).toBe(false);
        expect(CustomerRepository.getPasswordHash).not.toHaveBeenCalled();

    });

    it("rejects when the current password doesn't match", async () => {

        CustomerRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(false);

        const result = await CustomerService.changeOwnPassword(CUSTOMER_ID, "wrong-current", "brandnewpassword");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/incorrect/i);
        expect(CustomerRepository.updatePassword).not.toHaveBeenCalled();

    });

    it("changes the password when the current password is correct", async () => {

        CustomerRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(true);
        bcrypt.hash.mockResolvedValue("hashed-new-password");

        const result = await CustomerService.changeOwnPassword(CUSTOMER_ID, "correct-current", "brandnewpassword");

        expect(result.success).toBe(true);
        expect(CustomerRepository.updatePassword).toHaveBeenCalledWith(CUSTOMER_ID, "hashed-new-password");

    });

});
