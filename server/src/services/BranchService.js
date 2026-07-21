import * as BranchRepository from "../repositories/BranchRepository.js";

export const getActiveBranchesByTenantSlug = async (tenantSlug) => {

    if (!tenantSlug) {
        return { success: false, message: "Restaurant is required." };
    }

    const branches = await BranchRepository.getActiveBranchesByTenantSlug(tenantSlug);

    return { success: true, message: "Branches fetched successfully.", data: branches };

};

export const getAllBranches = async (tenantId) => {

    const branches = await BranchRepository.getAllBranches(tenantId);

    return { success: true, message: "Branches fetched successfully.", data: branches };

};

// Every read/write below takes tenantId from the caller's JWT and checks it
// against the fetched row - not just "does this branch exist" but "does it
// belong to the tenant asking about it." Skipping that check is exactly how
// a tenant admin could read or edit another restaurant's data.
export const getBranchById = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    if (!branch || branch.TenantId !== tenantId) {
        return { success: false, message: "Branch not found." };
    }

    return { success: true, message: "Branch fetched successfully.", data: branch };

};

export const createBranch = async (branch, tenantId) => {

    if (!branch.branchName || branch.branchName.trim() === "") {
        return { success: false, message: "Branch Name is required." };
    }

    const createdBranch = await BranchRepository.createBranch({ ...branch, tenantId });

    return { success: true, message: "Branch created successfully.", data: createdBranch };

};

export const updateBranch = async (branchId, branch, tenantId) => {

    const existingBranch = await BranchRepository.getBranchById(branchId);

    if (!existingBranch || existingBranch.TenantId !== tenantId) {
        return { success: false, message: "Branch not found." };
    }

    if (!branch.branchName || branch.branchName.trim() === "") {
        return { success: false, message: "Branch Name is required." };
    }

    const updatedBranch = await BranchRepository.updateBranch({ ...branch, branchId: Number(branchId) });

    return { success: true, message: "Branch updated successfully.", data: updatedBranch };

};

export const deactivateBranch = async (branchId, tenantId) => {

    const existingBranch = await BranchRepository.getBranchById(branchId);

    if (!existingBranch || existingBranch.TenantId !== tenantId) {
        return { success: false, message: "Branch not found." };
    }

    await BranchRepository.deactivateBranch(branchId);

    return { success: true, message: "Branch deactivated successfully." };

};
