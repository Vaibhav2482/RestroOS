import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/LoyaltyRepository.js");

const LoyaltyRepository = await import("../repositories/LoyaltyRepository.js");
const { awardPointsForOrder, getCustomerLoyalty } = await import("./LoyaltyService.js");

beforeEach(() => {
    vi.clearAllMocks();
});

describe("LoyaltyService.awardPointsForOrder", () => {

    const client = {};

    it("awards nothing when the order hasn't reached a completed status", async () => {

        await awardPointsForOrder(client, { OrderId: 1, OrderStatus: "Preparing", CustomerId: 5, TotalAmount: 500 });

        expect(LoyaltyRepository.hasEarnedTransactionForOrder).not.toHaveBeenCalled();
        expect(LoyaltyRepository.addPoints).not.toHaveBeenCalled();

    });

    it.each(["Delivered", "Served", "Picked Up"])("awards points once the order reaches %s", async (status) => {

        LoyaltyRepository.hasEarnedTransactionForOrder.mockResolvedValue(false);

        await awardPointsForOrder(client, { OrderId: 1, OrderStatus: status, CustomerId: 5, TotalAmount: 500 });

        // 5 points per ₹100 - see LOYALTY_EARN_RATE_PER_100.
        expect(LoyaltyRepository.addPoints).toHaveBeenCalledWith(client, 5, 25, 1, "Earned");

    });

    it("never awards points on Cancelled - only genuine fulfillment counts", async () => {

        await awardPointsForOrder(client, { OrderId: 1, OrderStatus: "Cancelled", CustomerId: 5, TotalAmount: 500 });

        expect(LoyaltyRepository.addPoints).not.toHaveBeenCalled();

    });

    it("does not double-award an order that's already earned points", async () => {

        LoyaltyRepository.hasEarnedTransactionForOrder.mockResolvedValue(true);

        await awardPointsForOrder(client, { OrderId: 1, OrderStatus: "Delivered", CustomerId: 5, TotalAmount: 500 });

        expect(LoyaltyRepository.addPoints).not.toHaveBeenCalled();

    });

    it("awards nothing on a fully-discounted (₹0) order", async () => {

        LoyaltyRepository.hasEarnedTransactionForOrder.mockResolvedValue(false);

        await awardPointsForOrder(client, { OrderId: 1, OrderStatus: "Delivered", CustomerId: 5, TotalAmount: 0 });

        expect(LoyaltyRepository.addPoints).not.toHaveBeenCalled();

    });

});

describe("LoyaltyService.getCustomerLoyalty", () => {

    it("combines the balance and transaction history", async () => {

        LoyaltyRepository.getBalance.mockResolvedValue(75);
        LoyaltyRepository.getTransactions.mockResolvedValue([{ Points: 25, Type: "Earned" }]);

        const result = await getCustomerLoyalty(5);

        expect(result).toEqual({
            success: true,
            message: "Loyalty balance fetched successfully.",
            data: { balance: 75, transactions: [{ Points: 25, Type: "Earned" }] }
        });

    });

    it("reports not found for a customer with no balance row", async () => {

        LoyaltyRepository.getBalance.mockResolvedValue(null);

        const result = await getCustomerLoyalty(999);

        expect(result).toEqual({ success: false, message: "Customer not found." });

    });

});
