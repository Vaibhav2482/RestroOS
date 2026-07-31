import * as InventoryService from "../services/InventoryService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { resolveBranchId } from "../utils/branchScope.js";

export const getBranchInventory = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (!branchId) {
        return errorResponse(res, "Branch Id is required.", 400);
    }

    const result = await InventoryService.getBranchInventory(branchId, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getValuation = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (!branchId) {
        return errorResponse(res, "Branch Id is required.", 400);
    }

    const result = await InventoryService.getValuation(branchId, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getTransactions = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (!branchId) {
        return errorResponse(res, "Branch Id is required.", 400);
    }

    const { ingredientId, transactionType, from, to } = req.query;

    const result = await InventoryService.getTransactions(branchId, req.user.tenantId, { ingredientId, transactionType, from, to });

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const getDashboard = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);

    if (!branchId) {
        return errorResponse(res, "Branch Id is required.", 400);
    }

    const result = await InventoryService.getDashboard(branchId, req.user.tenantId);

    if (!result.success) {
        return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, result.message);

});

export const recordOpeningStock = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req) || req.body.branchId;

    const result = await InventoryService.recordOpeningStock({ ...req.body, branchId }, req.user.tenantId, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const recordWastage = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req) || req.body.branchId;

    const result = await InventoryService.recordWastage({ ...req.body, branchId }, req.user.tenantId, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const recordAdjustment = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req) || req.body.branchId;

    const result = await InventoryService.recordAdjustment({ ...req.body, branchId }, req.user.tenantId, req.user.id);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});
