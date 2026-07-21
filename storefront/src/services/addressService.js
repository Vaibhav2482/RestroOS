import axiosClient from "../api/axiosClient";

export const createAddress = async (address) => {
    const response = await axiosClient.post("/customer-addresses", address);
    return response.data;
};

export const getAddresses = async (customerId) => {
    const response = await axiosClient.get(`/customer-addresses/${customerId}`);
    return response.data;
};

export const updateAddress = async (id, address) => {
    const response = await axiosClient.put(`/customer-addresses/${id}`, address);
    return response.data;
};

export const deleteAddress = async (id) => {
    const response = await axiosClient.delete(`/customer-addresses/${id}`);
    return response.data;
};
