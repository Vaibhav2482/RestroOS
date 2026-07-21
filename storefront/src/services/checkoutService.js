import axiosClient from "../api/axiosClient";

// Builds an order directly from the caller's own cart (server-side) and
// clears it on success. deliveryType is "Delivery" (addressId required) or
// "Dine In" (no address).
export const checkout = async (checkoutData) => {
    const response = await axiosClient.post("/checkout", checkoutData);
    return response.data;
};
