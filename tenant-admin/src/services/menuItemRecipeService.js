import axiosClient from "../api/axiosClient";

export const getRecipe = async (menuItemId) => {
    const response = await axiosClient.get(`/menu-item-recipes/${menuItemId}`);
    return response.data;
};

export const saveRecipe = async (menuItemId, lines) => {
    const response = await axiosClient.put(`/menu-item-recipes/${menuItemId}`, { lines });
    return response.data;
};
