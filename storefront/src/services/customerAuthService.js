import axiosClient from "../api/axiosClient";

export const register = async (tenantSlug, customer) => {
    const response = await axiosClient.post("/customer/auth/register", { tenantSlug, ...customer });
    return response.data;
};

export const login = async (tenantSlug, email, password) => {
    const response = await axiosClient.post("/customer/auth/login", { tenantSlug, email, password });
    return response.data;
};

export const createGuestSession = async (tenantSlug) => {
    const response = await axiosClient.post("/customer/auth/guest-session", { tenantSlug });
    return response.data;
};
