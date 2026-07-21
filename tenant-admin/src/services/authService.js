import axiosClient from "../api/axiosClient";

export const login = async (tenantSlug, email, password) => {

    const response = await axiosClient.post("/admin/auth/login", { tenantSlug, email, password });

    return response.data;

};
