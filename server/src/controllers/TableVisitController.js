import * as TableVisitService from "../services/TableVisitService.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { branchMismatch } from "../utils/branchScope.js";

const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};

// A visit's tenant boundary is its Branch's TenantId, same convention as
// Order (see OrderController.canAccessOrder) - Orders/TableVisits don't
// carry their own TenantId column, they're scoped through Branch.
const canAccessVisit = (req, visit) =>
    visit.TenantId === req.user.tenantId && !branchMismatch(req, visit.BranchId);

export const getOpenVisitForTable = asyncHandler(async (req, res) => {

    const { branchId, tableNumber } = req.params;

    if (!(await assertBranchBelongsToTenant(branchId, req.user.tenantId))) {
        return errorResponse(res, "Branch not found.", 404);
    }

    if (branchMismatch(req, branchId)) {
        return errorResponse(res, "Branch not found.", 404);
    }

    const result = await TableVisitService.getOpenVisitForTable(branchId, tableNumber);

    return successResponse(res, result.data, result.message);

});

export const getVisitDetails = asyncHandler(async (req, res) => {

    const { visitId } = req.params;

    const result = await TableVisitService.getVisitDetails(visitId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    if (!canAccessVisit(req, result.data)) {
        return errorResponse(res, "Table visit not found.", 404);
    }

    return successResponse(res, result.data, result.message);

});

export const updateGuestCount = asyncHandler(async (req, res) => {

    const { visitId } = req.params;
    const { guestCount } = req.body;

    const existing = await TableVisitService.getVisitDetails(visitId);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessVisit(req, existing.data)) {
        return errorResponse(res, "Table visit not found.", 404);
    }

    const result = await TableVisitService.updateGuestCount(visitId, guestCount);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const settleVisit = asyncHandler(async (req, res) => {

    const { visitId } = req.params;
    const { paymentMethod } = req.body;

    const existing = await TableVisitService.getVisitDetails(visitId);

    if (!existing.success) {
        return errorResponse(res, existing.message, 404);
    }

    if (!canAccessVisit(req, existing.data)) {
        return errorResponse(res, "Table visit not found.", 404);
    }

    const result = await TableVisitService.settleVisit(visitId, {
        paymentMethod,
        adminId: req.user.id,
        tenantId: req.user.tenantId
    });

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});
