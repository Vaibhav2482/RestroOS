import * as IntegrationService from "../services/IntegrationService.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse } from "../utils/ApiResponse.js";

export const getIntegrations = asyncHandler(async (req, res) => {

    const result = await IntegrationService.getIntegrations();

    return successResponse(res, result.data, result.message);

});
