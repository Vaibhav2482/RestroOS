import * as AuditService from "../services/AuditService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse } from "../utils/ApiResponse.js";

export const getLogs = asyncHandler(async (req, res) => {

    const { entityType, actorAdminId, from, to } = req.query;

    const result = await AuditService.getLogs(req.user.tenantId, { entityType, actorAdminId, from, to });

    return successResponse(res, result.data, result.message);

});
