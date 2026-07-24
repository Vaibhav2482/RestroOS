import axiosClient from "../api/axiosClient";

export const getAllOrders = async (branchId) => {
    const response = await axiosClient.get("/orders", { params: branchId ? { branchId } : {} });
    return response.data;
};

export const getActiveTableOrders = async (branchId) => {
    const response = await axiosClient.get("/orders/active-by-table", { params: branchId ? { branchId } : {} });
    return response.data;
};

export const getKitchenOrders = async (branchId) => {
    const response = await axiosClient.get("/orders/kitchen/active", { params: branchId ? { branchId } : {} });
    return response.data;
};

export const getOrderById = async (id) => {
    const response = await axiosClient.get(`/orders/${id}`);
    return response.data;
};

// Admin/POS order creation - bypasses the customer cart entirely and posts
// explicit items, unlike /checkout which only works off the caller's own cart.
export const createOrder = async (order) => {
    const response = await axiosClient.post("/orders", order);
    return response.data;
};

export const updateOrderStatus = async (id, orderStatus) => {
    const response = await axiosClient.put(`/orders/${id}/status`, { orderStatus });
    return response.data;
};

export const updateOrderItems = async (id, items) => {
    const response = await axiosClient.put(`/orders/${id}/items`, { items });
    return response.data;
};

export const cancelOrder = async (id) => {
    const response = await axiosClient.put(`/orders/${id}/cancel`);
    return response.data;
};
