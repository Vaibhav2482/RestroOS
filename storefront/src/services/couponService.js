import axiosClient from "../api/axiosClient";

// Preview-only: tells us what discount a coupon code WOULD apply, without
// actually applying it. The real discount is only ever applied server-side
// at checkout time, by passing the same couponCode through to /checkout.
export const previewCoupon = async ({ code, customerId, subtotal }) => {
    const response = await axiosClient.post("/coupons/preview", { code, customerId, subtotal });
    return response.data;
};
