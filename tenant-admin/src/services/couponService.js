import axiosClient from "../api/axiosClient";

export const getAllCoupons = async () => {
    const response = await axiosClient.get("/coupons");
    return response.data;
};

export const createCoupon = async (coupon) => {
    const response = await axiosClient.post("/coupons", coupon);
    return response.data;
};

export const updateCoupon = async (id, coupon) => {
    const response = await axiosClient.put(`/coupons/${id}`, coupon);
    return response.data;
};

export const deactivateCoupon = async (id) => {
    const response = await axiosClient.delete(`/coupons/${id}`);
    return response.data;
};
