import bcrypt from "bcrypt";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";

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

export const createAdmin = async (admin, tenantId) => {

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

    return { success: true, message: "Admin updated successfully.", data: updatedAdmin };

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

    return { success: true, message: "Admin deactivated successfully." };

};
