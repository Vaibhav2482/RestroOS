import axiosClient from "../api/axiosClient";

export const getOwnTenant = async () => {
    const response = await axiosClient.get("/tenants/me");
    return response.data;
};

export const updateBranding = async (branding) => {
    const response = await axiosClient.put("/tenants/me/branding", branding);
    return response.data;
};

export const updateDeliveryStaffingMode = async (deliveryStaffingMode) => {
    const response = await axiosClient.put("/tenants/me/delivery-settings", { deliveryStaffingMode });
    return response.data;
};

export const updateDisabledFeatures = async (disabledFeatures) => {
    const response = await axiosClient.put("/tenants/me/features", { disabledFeatures });
    return response.data;
};
