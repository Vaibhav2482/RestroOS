import axiosClient from "../api/axiosClient";

// Records a payment for methods with no online gateway step (Cash on
// Delivery, or Card/UPI collected in person) - amount must exactly match
// the order's TotalAmount.
export const createPayment = async ({ orderId, paymentMethod, amount }) => {
    const response = await axiosClient.post("/payments", { orderId, paymentMethod, amount });
    return response.data;
};

// Razorpay test-mode demo flow for Card/UPI: create a Razorpay order for the
// order's total, then verify the signature Checkout.js returns before the
// server records a Payment row.
export const createRazorpayOrder = async (orderId) => {
    const response = await axiosClient.post("/payments/razorpay/order", { orderId });
    return response.data;
};

export const verifyRazorpayPayment = async (payload) => {
    const response = await axiosClient.post("/payments/razorpay/verify", payload);
    return response.data;
};

// Called when the checkout widget reports payment.failed or the customer
// dismisses it without paying - marks that specific attempt Failed so the
// order isn't left silently indistinguishable from "never attempted".
export const recordFailedPayment = async (orderId, razorpayOrderId) => {
    const response = await axiosClient.post("/payments/razorpay/failed", { orderId, razorpayOrderId });
    return response.data;
};

export const getPaymentByOrderId = async (orderId) => {
    const response = await axiosClient.get(`/payments/order/${orderId}`);
    return response.data;
};
