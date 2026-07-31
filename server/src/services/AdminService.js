import bcrypt from "bcrypt";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import * as AuditService from "./AuditService.js";

const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    if (!branchId) {
        return true;
    }

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};

export const getAllAdmins = async (tenantId) => {

    const admins = await AdminRepository.getAllByTenant(tenantId);

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
        password: hashedPassword
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
        isActive: admin.isActive ?? existingAdmin.IsActive
    });

    const changeNotes = [];

    if (Boolean(existingAdmin.IsActive) !== Boolean(updatedAdmin.IsActive)) {
        changeNotes.push(updatedAdmin.IsActive ? "reactivated" : "deactivated");
    }

    if (String(existingAdmin.BranchId ?? "") !== String(updatedAdmin.BranchId ?? "")) {
        changeNotes.push(`branch access changed to ${updatedAdmin.BranchId ? `Branch #${updatedAdmin.BranchId}` : "Owner (all branches)"}`);
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

export const deactivateAdmin = async (adminId, requestingAdminId) => {

    if (String(adminId) === String(requestingAdminId)) {
        return { success: false, message: "You cannot deactivate your own account." };
    }

    const existingAdmin = await AdminRepository.getById(adminId);

    if (!existingAdmin) {
        return { success: false, message: "Admin not found." };
    }

    await AdminRepository.deactivate(adminId);

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
