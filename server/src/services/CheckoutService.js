import { waitUntil } from "@vercel/functions";

import * as CheckoutRepository from "../repositories/CheckoutRepository.js";
import * as RealtimeService from "./RealtimeService.js";
import * as NotificationService from "./NotificationService.js";

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

        // Not awaited - a slow WhatsApp/SMS/email provider must never make
        // the customer's checkout click hang. waitUntil (not a bare
        // un-awaited call) is what actually matters here: this runs as a
        // Vercel serverless function, which can freeze right after the
        // response is sent, so the platform needs an explicit signal to
        // keep the invocation alive until this finishes. The .catch is a
        // safety net for errors outside NotificationService's own per-channel
        // try/catch (e.g. the customer/order lookups it does internally).
        waitUntil(
            NotificationService.notifyOrderCreated(order)
                .catch((error) => console.error(`notifyOrderCreated failed for order #${order.OrderId}: ${error.message}`))
        );

        return { success: true, message: "Checkout completed successfully.", data: order };

    } catch (error) {

        return { success: false, message: error.message };

    }

};
