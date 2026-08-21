import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as AdminService from "./AdminService.js";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as AuditService from "./AuditService.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

vi.mock("../repositories/AdminRepository.js");
vi.mock("./AuditService.js");
vi.mock("../repositories/BranchRepository.js");
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
    BranchRepository.getBranchById.mockResolvedValue({ BranchId: 1, TenantId: 9 });

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

    it("also revokes every other session, so a stolen token can't outlive the password it was issued under", async () => {

        AdminRepository.getPasswordHash.mockResolvedValue("hashed-old-password");
        bcrypt.compare.mockResolvedValue(true);
        bcrypt.hash.mockResolvedValue("hashed-new-password");

        await AdminService.changeOwnPassword(ADMIN_ID, "correct-current", "brandnewpassword");

        expect(AdminRepository.bumpTokenVersion).toHaveBeenCalledWith(ADMIN_ID);

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

describe("AdminService.signOutEverywhere", () => {

    it("rejects when the admin no longer exists", async () => {

        AdminRepository.getById.mockResolvedValue(undefined);

        const result = await AdminService.signOutEverywhere(ADMIN_ID);

        expect(result.success).toBe(false);
        expect(AdminRepository.bumpTokenVersion).not.toHaveBeenCalled();

    });

    it("bumps the token version and audits it", async () => {

        const result = await AdminService.signOutEverywhere(ADMIN_ID);

        expect(result.success).toBe(true);
        expect(AdminRepository.bumpTokenVersion).toHaveBeenCalledWith(ADMIN_ID);
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({ action: "ADMIN_SIGNED_OUT_EVERYWHERE", actorAdminId: ADMIN_ID, tenantId: 9 })
        );

    });

});

describe("AdminService.updateAdmin - repository-level tenant defense-in-depth", () => {

    it("passes the caller's tenantId down to the repository write", async () => {

        AdminRepository.getById.mockResolvedValue(existingAdmin);
        AdminRepository.update.mockResolvedValue({ ...existingAdmin, FullName: "Priya S." });

        await AdminService.updateAdmin(ADMIN_ID, { fullName: "Priya S.", branchId: 1 }, 99, 9);

        expect(AdminRepository.update).toHaveBeenCalledWith(expect.anything(), 9);

    });

    // The repository's own WHERE clause is the real defense - this proves
    // the service degrades to a clean "not found" instead of crashing if
    // that clause ever legitimately returns 0 rows (e.g. a caller upstream
    // that skipped its own tenant check).
    it("returns a not-found failure instead of throwing when the repository write matches no row", async () => {

        AdminRepository.getById.mockResolvedValue(existingAdmin);
        AdminRepository.update.mockResolvedValue(undefined);

        const result = await AdminService.updateAdmin(ADMIN_ID, { fullName: "Priya S.", branchId: 1 }, 99, 9);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Admin not found.");

    });

});

describe("AdminService.deactivateAdmin - repository-level tenant defense-in-depth", () => {

    it("passes the caller's tenantId down to the repository write", async () => {

        AdminRepository.getById.mockResolvedValue(existingAdmin);

        await AdminService.deactivateAdmin(ADMIN_ID, 99, 9);

        expect(AdminRepository.deactivate).toHaveBeenCalledWith(ADMIN_ID, 9);

    });

});
