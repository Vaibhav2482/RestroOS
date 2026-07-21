import axiosClient from "../api/axiosClient";

export const getAllCategories = async () => {
    const response = await axiosClient.get("/categories");
    return response.data;
};

export const getCategoryById = async (id) => {
    const response = await axiosClient.get(`/categories/${id}`);
    return response.data;
};

export const createCategory = async (category) => {
    const response = await axiosClient.post("/categories", category);
    return response.data;
};

export const updateCategory = async (id, category) => {
    const response = await axiosClient.put(`/categories/${id}`, category);
    return response.data;
};

export const deleteCategory = async (id) => {
    const response = await axiosClient.delete(`/categories/${id}`);
    return response.data;
};
