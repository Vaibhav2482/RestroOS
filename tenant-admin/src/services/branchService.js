import axiosClient from "../api/axiosClient";

export const getAllBranches = async () => {
    const response = await axiosClient.get("/branches");
    return response.data;
};

export const getBranchById = async (id) => {
    const response = await axiosClient.get(`/branches/${id}`);
    return response.data;
};

export const createBranch = async (branch) => {
    const response = await axiosClient.post("/branches", branch);
    return response.data;
};

export const updateBranch = async (id, branch) => {
    const response = await axiosClient.put(`/branches/${id}`, branch);
    return response.data;
};

export const deactivateBranch = async (id) => {
    const response = await axiosClient.delete(`/branches/${id}`);
    return response.data;
};
