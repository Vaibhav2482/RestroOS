import axiosClient from "../api/axiosClient";

export const getAllTenants = async () => {

    const response = await axiosClient.get("/platform-admin/tenants");

    return response.data;

};

export const createTenant = async (tenant) => {

    const response = await axiosClient.post("/platform-admin/tenants", tenant);

    return response.data;

};

export const resetOwnerPassword = async (tenantId) => {

    const response = await axiosClient.post(`/platform-admin/tenants/${tenantId}/reset-password`);

    return response.data;

};

export const suspendTenant = async (tenantId) => {

    const response = await axiosClient.post(`/platform-admin/tenants/${tenantId}/suspend`);

    return response.data;

};

export const reactivateTenant = async (tenantId) => {

    const response = await axiosClient.post(`/platform-admin/tenants/${tenantId}/reactivate`);

    return response.data;

};
