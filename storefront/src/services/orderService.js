import axiosClient from "../api/axiosClient";

export const getOrdersByCustomer = async (customerId) => {
    const response = await axiosClient.get(`/orders/customer/${customerId}`);
    return response.data;
};

export const getOrderById = async (id) => {
    const response = await axiosClient.get(`/orders/${id}`);
    return response.data;
};

// Only succeeds while the order is Pending/Accepted/Preparing - the server
// rejects it once the order is further along (or already Delivered/Cancelled).
export const cancelOrder = async (id) => {
    const response = await axiosClient.put(`/orders/${id}/cancel`);
    return response.data;
};
