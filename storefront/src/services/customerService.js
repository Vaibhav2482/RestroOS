import axiosClient from "../api/axiosClient";

export const updateCustomer = async (id, customer) => {
    const response = await axiosClient.put(`/customers/${id}`, customer);
    return response.data;
};

export const changePassword = async (id, currentPassword, newPassword) => {
    const response = await axiosClient.put(`/customers/${id}/password`, { currentPassword, newPassword });
    return response.data;
};
