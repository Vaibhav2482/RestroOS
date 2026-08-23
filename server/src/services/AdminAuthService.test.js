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
    ...overrides
});

beforeEach(() => {

    vi.clearAllMocks();

    TenantRepository.getBySlug.mockResolvedValue(tenant);

});

describe("AdminAuthService.login", () => {

    it("rejects a wrong password with the generic message - account lockout was deliberately removed, rate limiting is the substitute", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin());
        bcrypt.compare.mockResolvedValue(false);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "wrong");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Invalid email or password.");

    });

    it("logs in successfully with the correct password", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin());
        bcrypt.compare.mockResolvedValue(true);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "correct-password");

        expect(result.success).toBe(true);

    });

    it("never includes the password hash in the response", async () => {

        AdminRepository.getByTenantAndEmail.mockResolvedValue(buildAdmin());
        bcrypt.compare.mockResolvedValue(true);

        const result = await AdminAuthService.login("alpha-diner", "owner@alpha.test", "correct-password");

        expect(result.data.Password).toBeUndefined();

    });

});
