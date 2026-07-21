import axiosClient from "../api/axiosClient";

// Cash/manual payment recording only - amount must exactly match the
// order's TotalAmount (enforced server-side).
export const createPayment = async (payment) => {
    const response = await axiosClient.post("/payments", payment);
    return response.data;
};

export const getPaymentByOrderId = async (orderId) => {
    const response = await axiosClient.get(`/payments/order/${orderId}`);
    return response.data;
};
