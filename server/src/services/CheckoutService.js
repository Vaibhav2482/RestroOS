import * as CheckoutRepository from "../repositories/CheckoutRepository.js";
import * as RealtimeService from "./RealtimeService.js";

const VALID_DELIVERY_TYPES = ["Delivery", "Dine In"];

export const checkout = async (checkoutData) => {

    const { customerId, addressId, paymentMethod, notes, couponCode } = checkoutData;

    const deliveryType = checkoutData.deliveryType || "Delivery";

    if (!customerId) {
        return { success: false, message: "Customer Id is required." };
    }

    if (!VALID_DELIVERY_TYPES.includes(deliveryType)) {
        return { success: false, message: "Order type must be either Delivery or Dine In." };
    }

    if (deliveryType === "Delivery" && !addressId) {
        return { success: false, message: "Address Id is required for delivery orders." };
    }

    if (!paymentMethod) {
        return { success: false, message: "Payment Method is required." };
    }

    try {

        const order = await CheckoutRepository.checkout(
            customerId,
            deliveryType === "Delivery" ? addressId : null,
            deliveryType,
            paymentMethod,
            notes,
            couponCode
        );

        await RealtimeService.publishOrderCreated(order);

        return { success: true, message: "Checkout completed successfully.", data: order };

    } catch (error) {

        return { success: false, message: error.message };

    }

};
