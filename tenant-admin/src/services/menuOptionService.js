import axiosClient from "../api/axiosClient";

export const getOptionGroupsByMenuItem = async (menuItemId) => {
    const response = await axiosClient.get(`/menu-options/menu-item/${menuItemId}`);
    return response.data;
};

export const createOptionGroup = async (group) => {
    const response = await axiosClient.post("/menu-options/groups", group);
    return response.data;
};

export const updateOptionGroup = async (id, group) => {
    const response = await axiosClient.put(`/menu-options/groups/${id}`, group);
    return response.data;
};

export const deleteOptionGroup = async (id) => {
    const response = await axiosClient.delete(`/menu-options/groups/${id}`);
    return response.data;
};

export const createOption = async (groupId, option) => {
    const response = await axiosClient.post(`/menu-options/groups/${groupId}/options`, option);
    return response.data;
};

export const updateOption = async (id, option) => {
    const response = await axiosClient.put(`/menu-options/options/${id}`, option);
    return response.data;
};

export const deleteOption = async (id) => {
    const response = await axiosClient.delete(`/menu-options/options/${id}`);
    return response.data;
};
