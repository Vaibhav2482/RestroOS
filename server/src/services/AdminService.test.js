import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as AdminService from "./AdminService.js";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as AuditService from "./AuditService.js";

vi.mock("../repositories/AdminRepository.js");
vi.mock("./AuditService.js");
vi.mock("bcrypt");

const ADMIN_ID = 5;

const existingAdmin = {
    AdminId: ADMIN_ID,
    TenantId: 9,
    FullName: "Priya Sharma",
    Email: "priya@example.com",
    BranchId: 1,
    AvatarUrl: null,
    IsActive: true
};

beforeEach(() => {

    vi.clearAllMocks();

    AdminRepository.getById.mockResolvedValue(existingAdmin);
    AuditService.record.mockResolvedValue();

});

describe("AdminService.updateOwnProfile", () => {

    it("rejects an empty name", async () => {

        const result = await AdminService.updateOwnProfile(ADMIN_ID, { fullName: "   " });

        expect(result.success).toBe(false);
        expect(AdminRepository.updateOwnProfile).not.toHaveBeenCalled();

    });

    it("updates name and avatar, and records an audit entry", async () => {

        AdminRepository.updateOwnProfile.mockResolvedValue({ ...existingAdmin, FullName: "Priya S.", AvatarUrl: "https://cdn/img.jpg" });

        const result = await AdminService.updateOwnProfile(ADMIN_ID, { fullName: "Priya S.", avatarUrl: "https://cdn/img.jpg" });

        expect(result.success).toBe(true);
        expect(AdminRepository.updateOwnProfile).toHaveBeenCalledWith(ADMIN_ID, { fullName: "Priya S.", avatarUrl: "https://cdn/img.jpg" });
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({ action: "ADMIN_UPDATED", actorAdminId: ADMIN_ID, tenantId: 9 })
        );

    });

    it("keeps the existing avatar when none is supplied - editing your name shouldn't clear your photo", async () => {

        AdminRepository.updateOwnProfile.mockResolvedValue(existingAdmin);

        await AdminService.updateOwnProfile(ADMIN_ID, { fullName: "Priya Sharma" });

        expect(AdminRepository.updateOwnProfile).toHaveBeenCalledWith(ADMIN_ID, expect.objectContaining({ avatarUrl: null }));

    });

});

describe("AdminService.changeOwnPassword", () => {

    it("rejects a new password shorter than 8 characters", async () => {

        const result = await AdminService.changeOwnPassword(ADMIN_ID, "oldpass123", "short");

        expect(result.success).toBe(false);
        expect(AdminRepository.getPasswordHash).not.toHaveBeenCalled();

    });

    it("rejects when the current password doesn't match", async () => {

        AdminRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(false);

        const result = await AdminService.changeOwnPassword(ADMIN_ID, "wrong-current", "brandnewpassword");

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/incorrect/i);
        expect(AdminRepository.updatePassword).not.toHaveBeenCalled();

    });

    it("changes the password and audits it when the current password is correct", async () => {

        AdminRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(true);
        bcrypt.hash.mockResolvedValue("hashed-new-password");

        const result = await AdminService.changeOwnPassword(ADMIN_ID, "correct-current", "brandnewpassword");

        expect(result.success).toBe(true);
        expect(AdminRepository.updatePassword).toHaveBeenCalledWith(ADMIN_ID, "hashed-new-password");
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({ action: "ADMIN_PASSWORD_CHANGED", actorAdminId: ADMIN_ID })
        );

    });

    it("never includes the password itself in the audit summary", async () => {

        AdminRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(true);
        bcrypt.hash.mockResolvedValue("hashed-new-password");

        await AdminService.changeOwnPassword(ADMIN_ID, "correct-current", "brandnewpassword");

        const auditCall = AuditService.record.mock.calls[0][0];
        expect(auditCall.summary).not.toContain("brandnewpassword");
        expect(JSON.stringify(auditCall)).not.toContain("brandnewpassword");

    });

});
