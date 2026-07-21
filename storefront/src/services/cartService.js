import axiosClient from "../api/axiosClient";

export const addToCart = async (cart) => {
    const response = await axiosClient.post("/cart", cart);
    return response.data;
};

export const getCart = async (customerId) => {
    const response = await axiosClient.get(`/cart/${customerId}`);
    return response.data;
};

export const updateCartQuantity = async (cartId, quantity) => {
    const response = await axiosClient.put(`/cart/${cartId}`, { quantity });
    return response.data;
};

export const removeCartItem = async (cartId) => {
    const response = await axiosClient.delete(`/cart/${cartId}`);
    return response.data;
};

export const clearCart = async (customerId) => {
    const response = await axiosClient.delete(`/cart/customer/${customerId}`);
    return response.data;
};
