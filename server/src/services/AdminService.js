import bcrypt from "bcrypt";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import * as AuditService from "./AuditService.js";
import { sanitizePermissions } from "../config/permissions.js";

const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    if (!branchId) {
        return true;
    }

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};

export const getAllAdmins = async (tenantId, branchId) => {

    const admins = await AdminRepository.getAllByTenant(tenantId, branchId);

    return { success: true, message: "Admins fetched successfully.", data: admins };

};

export const getAdminById = async (adminId) => {

    const admin = await AdminRepository.getById(adminId);

    if (!admin) {
        return { success: false, message: "Admin not found." };
    }

    return { success: true, message: "Admin fetched successfully.", data: admin };

};

export const createAdmin = async (admin, tenantId, actorAdminId) => {

    if (!admin.fullName || admin.fullName.trim() === "") {
        return { success: false, message: "Full Name is required." };
    }

    if (!admin.email || admin.email.trim() === "") {
        return { success: false, message: "Email is required." };
    }

    if (!admin.password || admin.password.trim() === "") {
        return { success: false, message: "Password is required." };
    }

    if (!(await assertBranchBelongsToTenant(admin.branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    const existingAdmin = await AdminRepository.getByTenantAndEmail(tenantId, admin.email);

    if (existingAdmin) {
        return { success: false, message: "Email already registered for this restaurant." };
    }

    const hashedPassword = await bcrypt.hash(admin.password, 10);

    const createdAdmin = await AdminRepository.create({
        ...admin,
        tenantId,
        password: hashedPassword,
        permissions: sanitizePermissions(admin.permissions)
    });

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "ADMIN_CREATED",
        entityType: "Admin",
        entityId: createdAdmin.AdminId,
        summary: `Created staff account "${createdAdmin.FullName}" (${createdAdmin.Email})${createdAdmin.BranchId ? "" : " with Owner access"}`
    });

    return { success: true, message: "Admin created successfully.", data: createdAdmin };

};

export const updateAdmin = async (adminId, admin, requestingAdminId, tenantId) => {

    const existingAdmin = await AdminRepository.getById(adminId);

    if (!existingAdmin) {
        return { success: false, message: "Admin not found." };
    }

    if (!admin.fullName || admin.fullName.trim() === "") {
        return { success: false, message: "Full Name is required." };
    }

    if (!(await assertBranchBelongsToTenant(admin.branchId, tenantId))) {
        return { success: false, message: "Branch not found." };
    }

    if (String(adminId) === String(requestingAdminId) && admin.isActive === false) {
        return { success: false, message: "You cannot deactivate your own account." };
    }

    if (String(adminId) === String(requestingAdminId) && !existingAdmin.BranchId && admin.branchId) {
        return { success: false, message: "You cannot remove your own Owner access." };
    }

    const updatedAdmin = await AdminRepository.update({
        ...admin,
        adminId: Number(adminId),
        isActive: admin.isActive ?? existingAdmin.IsActive,
        permissions: sanitizePermissions(admin.permissions ?? existingAdmin.Permissions)
    }, tenantId);

    // Only reachable if a future caller skips the controller's own tenant
    // check - the WHERE clause above is the real defense-in-depth, this is
    // just turning "0 rows updated" into the same clean not-found response
    // every other failure path here already uses, instead of a crash.
    if (!updatedAdmin) {
        return { success: false, message: "Admin not found." };
    }

    const changeNotes = [];

    if (Boolean(existingAdmin.IsActive) !== Boolean(updatedAdmin.IsActive)) {
        changeNotes.push(updatedAdmin.IsActive ? "reactivated" : "deactivated");
    }

    if (String(existingAdmin.BranchId ?? "") !== String(updatedAdmin.BranchId ?? "")) {
        changeNotes.push(`branch access changed to ${updatedAdmin.BranchId ? `Branch #${updatedAdmin.BranchId}` : "Owner (all branches)"}`);
    }

    const existingPermissions = [...(existingAdmin.Permissions || [])].sort();
    const nextPermissions = [...(updatedAdmin.Permissions || [])].sort();

    if (JSON.stringify(existingPermissions) !== JSON.stringify(nextPermissions)) {
        changeNotes.push(`permissions changed to [${nextPermissions.join(", ") || "none"}]`);
    }

    AuditService.record({
        tenantId,
        actorAdminId: requestingAdminId,
        action: "ADMIN_UPDATED",
        entityType: "Admin",
        entityId: updatedAdmin.AdminId,
        summary: `Updated staff account "${updatedAdmin.FullName}"${changeNotes.length ? ` (${changeNotes.join(", ")})` : ""}`
    });

    return { success: true, message: "Admin updated successfully.", data: updatedAdmin };

};

// Self-service - the fields an admin can change about their own account
// without owner involvement. Deliberately narrower than updateAdmin
// above: no branch, no active status, no email (email is the login
// identity tied to auth lookups elsewhere - changing it here would be a
// bigger, separate piece of work involving re-verification).
export const updateOwnProfile = async (adminId, profile) => {

    const fullName = profile.fullName?.trim();

    if (!fullName) {
        return { success: false, message: "Full Name is required." };
    }

    const existingAdmin = await AdminRepository.getById(adminId);

    if (!existingAdmin) {
        return { success: false, message: "Admin not found." };
    }

    const updatedAdmin = await AdminRepository.updateOwnProfile(adminId, {
        fullName,
        avatarUrl: profile.avatarUrl ?? existingAdmin.AvatarUrl
    });

    AuditService.record({
        tenantId: existingAdmin.TenantId,
        actorAdminId: adminId,
        actorType: "User",
        action: "ADMIN_UPDATED",
        entityType: "Admin",
        entityId: updatedAdmin.AdminId,
        summary: `"${updatedAdmin.FullName}" updated their own profile`
    });

    return { success: true, message: "Profile updated successfully.", data: updatedAdmin };

};

const MIN_PASSWORD_LENGTH = 8;

export const changeOwnPassword = async (adminId, currentPassword, newPassword) => {

    if (!currentPassword) {
        return { success: false, message: "Current password is required." };
    }

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        return { success: false, message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }

    const existingAdmin = await AdminRepository.getById(adminId);

    if (!existingAdmin) {
        return { success: false, message: "Admin not found." };
    }

    const currentHash = await AdminRepository.getPasswordHash(adminId);
    const isCorrect = currentHash && await bcrypt.compare(currentPassword, currentHash);

    if (!isCorrect) {
        return { success: false, message: "Current password is incorrect." };
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await AdminRepository.updatePassword(adminId, newHash);

    // A stolen-but-still-valid token doesn't contain the password, so
    // changing it alone wouldn't stop anyone already holding one from
    // continuing to use it - bumping TokenVersion here closes that, at the
    // cost of the session that just made this request needing to log in
    // again too, same as any other "sign out everywhere" trigger.
    await AdminRepository.bumpTokenVersion(adminId);

    // A password change is exactly the kind of security-relevant event an
    // audit trail exists for, even though it's self-initiated - if an
    // account is ever compromised, "when did the password last change"
    // matters. Never logs the password itself, only that it changed.
    AuditService.record({
        tenantId: existingAdmin.TenantId,
        actorAdminId: adminId,
        actorType: "User",
        action: "ADMIN_PASSWORD_CHANGED",
        entityType: "Admin",
        entityId: Number(adminId),
        summary: `"${existingAdmin.FullName}" changed their own password`
    });

    return { success: true, message: "Password changed successfully." };

};

// Self-service session revocation for "I lost my phone" without needing to
// deactivate the account (which would also block the admin's own next
// login). Bumping TokenVersion invalidates every token already issued,
// including the one this very request is using - the caller is expected to
// treat a successful response as an instruction to log itself out too.
export const signOutEverywhere = async (adminId) => {

    const existingAdmin = await AdminRepository.getById(adminId);

    if (!existingAdmin) {
        return { success: false, message: "Admin not found." };
    }

    await AdminRepository.bumpTokenVersion(adminId);

    AuditService.record({
        tenantId: existingAdmin.TenantId,
        actorAdminId: adminId,
        actorType: "User",
        action: "ADMIN_SIGNED_OUT_EVERYWHERE",
        entityType: "Admin",
        entityId: Number(adminId),
        summary: `"${existingAdmin.FullName}" signed out of every session`
    });

    return { success: true, message: "Signed out of every session." };

};

export const deactivateAdmin = async (adminId, requestingAdminId, tenantId) => {

    if (String(adminId) === String(requestingAdminId)) {
        return { success: false, message: "You cannot deactivate your own account." };
    }

    const existingAdmin = await AdminRepository.getById(adminId);

    if (!existingAdmin) {
        return { success: false, message: "Admin not found." };
    }

    await AdminRepository.deactivate(adminId, tenantId);

    AuditService.record({
        tenantId: existingAdmin.TenantId,
        actorAdminId: requestingAdminId,
        action: "ADMIN_DEACTIVATED",
        entityType: "Admin",
        entityId: Number(adminId),
        summary: `Deactivated staff account "${existingAdmin.FullName}" (${existingAdmin.Email})`
    });

    return { success: true, message: "Admin deactivated successfully." };

};
