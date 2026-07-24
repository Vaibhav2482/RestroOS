import * as BranchRepository from "../repositories/BranchRepository.js";
import { getPusherClient } from "../config/pusher.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { errorResponse } from "../utils/ApiResponse.js";

const BRANCH_CHANNEL = /^private-branch-(\d+)$/;
const CUSTOMER_CHANNEL = /^private-customer-(\d+)$/;

// Pusher private channels require the server to vouch for a subscription
// before the client is allowed to join - this is that vouching endpoint.
// Same tenant/branch boundary as canAccessOrder in OrderController: a
// branch-scoped admin can only ever be handed a signature for their own
// branch's channel, and a customer only for their own.
const isAuthorized = async (req, channelName) => {

    const branchMatch = channelName.match(BRANCH_CHANNEL);

    if (branchMatch) {

        if (req.user.role !== "admin") {
            return false;
        }

        const branchId = Number(branchMatch[1]);
        const branch = await BranchRepository.getBranchById(branchId);

        if (!branch || branch.TenantId !== req.user.tenantId) {
            return false;
        }

        return !req.user.branchId || String(req.user.branchId) === String(branchId);

    }

    const customerMatch = channelName.match(CUSTOMER_CHANNEL);

    if (customerMatch) {
        return req.user.role === "customer" && String(req.user.id) === customerMatch[1];
    }

    return false;

};

export const authorizePusherChannel = asyncHandler(async (req, res) => {

    const { socketId, channelName } = req.body;

    if (!socketId || !channelName) {
        return errorResponse(res, "socketId and channelName are required.", 400);
    }

    if (!(await isAuthorized(req, channelName))) {
        return errorResponse(res, "You are not authorized to subscribe to this channel.", 403);
    }

    const pusher = getPusherClient();

    if (!pusher) {
        return errorResponse(res, "Realtime is not configured on this server yet.", 400);
    }

    const authResponse = pusher.authorizeChannel(socketId, channelName);

    return res.status(200).json(authResponse);

});
