import axiosClient from "../api/axiosClient";

export const getAllMenuItems = async (branchId) => {
    const response = await axiosClient.get("/menu", { params: branchId ? { branchId } : {} });
    return response.data;
};

export const getMenuItemById = async (id) => {
    const response = await axiosClient.get(`/menu/${id}`);
    return response.data;
};

export const createMenuItem = async (menuItem) => {
    const response = await axiosClient.post("/menu", menuItem);
    return response.data;
};

export const updateMenuItem = async (id, menuItem) => {
    const response = await axiosClient.put(`/menu/${id}`, menuItem);
    return response.data;
};

export const deleteMenuItem = async (id) => {
    const response = await axiosClient.delete(`/menu/${id}`);
    return response.data;
};
