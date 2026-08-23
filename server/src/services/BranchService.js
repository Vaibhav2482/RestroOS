import * as BranchRepository from "../repositories/BranchRepository.js";
import * as AuditService from "./AuditService.js";

export const getActiveBranchesByTenantSlug = async (tenantSlug) => {

    if (!tenantSlug) {
        return { success: false, message: "Restaurant is required." };
    }

    const branches = await BranchRepository.getActiveBranchesByTenantSlug(tenantSlug);

    return { success: true, message: "Branches fetched successfully.", data: branches };

};

export const getAllBranches = async (tenantId, branchId) => {

    const branches = await BranchRepository.getAllBranches(tenantId, branchId);

    return { success: true, message: "Branches fetched successfully.", data: branches };

};

// Every read/write below takes tenantId from the caller's JWT and checks it
// against the fetched row - not just "does this branch exist" but "does it
// belong to the tenant asking about it." Skipping that check is exactly how
// a tenant admin could read or edit another restaurant's data. The caller
// (BranchController) additionally applies branchMismatch() on top of this
// for a Branch Admin, the same way every other branch-scoped resource does.
export const getBranchById = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    if (!branch || branch.TenantId !== tenantId) {
        return { success: false, message: "Branch not found." };
    }

    return { success: true, message: "Branch fetched successfully.", data: branch };

};

const DELIVERY_STAFFING_MODES = new Set(["branch_staff", "dedicated_riders"]);

// Blank/undefined is valid (falls back to the tenant's default) - only an
// actual, wrong value is rejected.
const invalidDeliveryStaffingMode = (branch) =>
    branch.deliveryStaffingMode && !DELIVERY_STAFFING_MODES.has(branch.deliveryStaffingMode);

export const createBranch = async (branch, tenantId, actorAdminId) => {

    if (!branch.branchName || branch.branchName.trim() === "") {
        return { success: false, message: "Branch Name is required." };
    }

    if (invalidDeliveryStaffingMode(branch)) {
        return { success: false, message: "Delivery staffing mode must be 'branch_staff' or 'dedicated_riders'." };
    }

    const createdBranch = await BranchRepository.createBranch({ ...branch, tenantId });

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "BRANCH_CREATED",
        entityType: "Branch",
        entityId: createdBranch.BranchId,
        summary: `Created branch "${createdBranch.BranchName}"`
    });

    return { success: true, message: "Branch created successfully.", data: createdBranch };

};

export const updateBranch = async (branchId, branch, tenantId, actorAdminId) => {

    const existingBranch = await BranchRepository.getBranchById(branchId);

    if (!existingBranch || existingBranch.TenantId !== tenantId) {
        return { success: false, message: "Branch not found." };
    }

    if (!branch.branchName || branch.branchName.trim() === "") {
        return { success: false, message: "Branch Name is required." };
    }

    if (invalidDeliveryStaffingMode(branch)) {
        return { success: false, message: "Delivery staffing mode must be 'branch_staff' or 'dedicated_riders'." };
    }

    const updatedBranch = await BranchRepository.updateBranch({ ...branch, branchId: Number(branchId) });

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "BRANCH_UPDATED",
        entityType: "Branch",
        entityId: updatedBranch.BranchId,
        summary: `Updated branch "${updatedBranch.BranchName}"`
    });

    return { success: true, message: "Branch updated successfully.", data: updatedBranch };

};

export const deactivateBranch = async (branchId, tenantId, actorAdminId) => {

    const existingBranch = await BranchRepository.getBranchById(branchId);

    if (!existingBranch || existingBranch.TenantId !== tenantId) {
        return { success: false, message: "Branch not found." };
    }

    await BranchRepository.deactivateBranch(branchId);

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "BRANCH_DEACTIVATED",
        entityType: "Branch",
        entityId: Number(branchId),
        summary: `Deactivated branch "${existingBranch.BranchName}"`
    });

    return { success: true, message: "Branch deactivated successfully." };

};
