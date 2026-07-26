import axiosClient from "../api/axiosClient";

export const getAllIngredients = async () => {
    const response = await axiosClient.get("/ingredients");
    return response.data;
};

export const createIngredient = async (ingredient) => {
    const response = await axiosClient.post("/ingredients", ingredient);
    return response.data;
};

export const updateIngredient = async (id, ingredient) => {
    const response = await axiosClient.put(`/ingredients/${id}`, ingredient);
    return response.data;
};
