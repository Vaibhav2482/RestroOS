import axiosClient from "../api/axiosClient";

export const getAllTenants = async () => {

    const response = await axiosClient.get("/platform-admin/tenants");

    return response.data;

};

export const createTenant = async (tenant) => {

    const response = await axiosClient.post("/platform-admin/tenants", tenant);

    return response.data;

};
