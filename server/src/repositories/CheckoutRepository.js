import * as CartRepository from "./CartRepository.js";
import * as OrderRepository from "./OrderRepository.js";

export const checkout = async (
    customerId,
    addressId,
    deliveryType,
    paymentMethod,
    notes
) => {

    const cartItems = await CartRepository.getCart(customerId);

    if (cartItems.length === 0) {
        throw new Error("Cart is empty.");
    }

    const items = cartItems.map((item) => ({
        menuItemId: item.MenuItemId,
        quantity: item.Quantity
    }));

    const order = await OrderRepository.createOrder({
        customerId,
        addressId,
        deliveryType,
        paymentMethod,
        notes,
        items
    });

    await CartRepository.clearCart(customerId);

    return order;

};
