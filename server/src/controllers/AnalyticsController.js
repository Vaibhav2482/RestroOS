import * as AnalyticsService from "../services/AnalyticsService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";
import { resolveBranchId } from "../utils/branchScope.js";

export const getOverview = asyncHandler(async (req, res) => {

    const branchId = resolveBranchId(req);
    const { from, to } = req.query;

    const result = await AnalyticsService.getOverview(req.user.tenantId, branchId, from, to);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const getBranchComparison = asyncHandler(async (req, res) => {

    const { from, to } = req.query;

    const result = await AnalyticsService.getBranchComparison(req.user.tenantId, from, to);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});
