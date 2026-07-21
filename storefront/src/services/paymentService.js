import axiosClient from "../api/axiosClient";

// Records a payment for methods with no online gateway step (Cash on
// Delivery, or Card/UPI collected in person) - amount must exactly match
// the order's TotalAmount.
export const createPayment = async ({ orderId, paymentMethod, amount }) => {
    const response = await axiosClient.post("/payments", { orderId, paymentMethod, amount });
    return response.data;
};
