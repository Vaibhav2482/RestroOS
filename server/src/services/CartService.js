import * as CartRepository from "../repositories/CartRepository.js";

export const addToCart = async (cart) => {

    if (!cart.customerId) {
        return { success: false, message: "Customer Id is required." };
    }

    if (!cart.menuItemId) {
        return { success: false, message: "Menu Item Id is required." };
    }

    if (!cart.quantity || cart.quantity <= 0) {
        return { success: false, message: "Quantity must be greater than zero." };
    }

    const createdCart = await CartRepository.addToCart(cart);

    return { success: true, message: "Item added to cart successfully.", data: createdCart };

};

export const getCart = async (customerId) => {

    const cart = await CartRepository.getCart(customerId);

    return { success: true, message: "Cart fetched successfully.", data: cart };

};

export const getCartItemById = async (cartId) => {

    return CartRepository.getCartItemById(cartId);

};

export const updateCartQuantity = async (cartId, quantity) => {

    if (!quantity || quantity <= 0) {
        return { success: false, message: "Quantity must be greater than zero." };
    }

    const updatedCart = await CartRepository.updateCartQuantity(cartId, quantity);

    return { success: true, message: "Cart updated successfully.", data: updatedCart };

};

export const removeCartItem = async (cartId) => {

    const result = await CartRepository.removeCartItem(cartId);

    return { success: true, message: "Cart item removed successfully.", data: result };

};

export const clearCart = async (customerId) => {

    const result = await CartRepository.clearCart(customerId);

    return { success: true, message: "Cart cleared successfully.", data: result };

};
