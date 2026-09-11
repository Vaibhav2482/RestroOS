import * as CartRepository from "./CartRepository.js";
import * as OrderRepository from "./OrderRepository.js";

export const checkout = async (
    customerId,
    addressId,
    deliveryType,
    paymentMethod,
    notes,
    couponCode,
    tableNumber,
    redeemPoints
) => {

    const cartItems = await CartRepository.getCart(customerId);

    if (cartItems.length === 0) {
        throw new Error("Cart is empty.");
    }

    const items = cartItems.map((item) => ({
        menuItemId: item.MenuItemId,
        quantity: item.Quantity,
        selectedOptionIds: (item.SelectedOptions ?? []).map((option) => option.OptionId)
    }));

    const order = await OrderRepository.createOrder({
        customerId,
        addressId,
        deliveryType,
        paymentMethod,
        notes,
        couponCode,
        tableNumber,
        redeemPoints,
        items
    });

    await CartRepository.clearCart(customerId);

    return order;

};
