import * as LoyaltyRepository from "../repositories/LoyaltyRepository.js";
import { pointsEarnedFor } from "../utils/loyaltyResolver.js";

// A customer only ever earns once an order is genuinely fulfilled, not the
// moment it's placed - a Delivery/Takeaway/Dine In order can still be
// cancelled right up until the kitchen's finished it, and awarding points
// up front would mean walking them back on every cancellation instead of
// simply never having granted them. Called from inside OrderService.
// updateOrderStatus's own transaction (the same client, the same "order"
// row `RETURNING *` already handed back), so this either commits alongside
// the status change or rolls back with it - never a status change that
// silently failed to award, or an award for a status change that itself
// then failed.
const COMPLETED_STATUSES = ["Delivered", "Served", "Picked Up"];

export const awardPointsForOrder = async (client, order) => {

    if (!COMPLETED_STATUSES.includes(order.OrderStatus)) {
        return;
    }

    const alreadyAwarded = await LoyaltyRepository.hasEarnedTransactionForOrder(client, order.OrderId);

    if (alreadyAwarded) {
        return;
    }

    const points = pointsEarnedFor(order.TotalAmount);

    if (points <= 0) {
        return;
    }

    await LoyaltyRepository.addPoints(client, order.CustomerId, points, order.OrderId, "Earned");

};

export const getCustomerLoyalty = async (customerId) => {

    const [balance, transactions] = await Promise.all([
        LoyaltyRepository.getBalance(customerId),
        LoyaltyRepository.getTransactions(customerId)
    ]);

    if (balance === null) {
        return { success: false, message: "Customer not found." };
    }

    return { success: true, message: "Loyalty balance fetched successfully.", data: { balance, transactions } };

};
