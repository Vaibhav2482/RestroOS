import axiosClient from "../api/axiosClient";

export const getAllAdmins = async () => {
    const response = await axiosClient.get("/admins");
    return response.data;
};

export const getAdminById = async (id) => {
    const response = await axiosClient.get(`/admins/${id}`);
    return response.data;
};

export const getOwnProfile = async () => {
    const response = await axiosClient.get("/admins/me");
    return response.data;
};

export const updateOwnProfile = async (profile) => {
    const response = await axiosClient.put("/admins/me", profile);
    return response.data;
};

export const changeOwnPassword = async (currentPassword, newPassword) => {
    const response = await axiosClient.put("/admins/me/password", { currentPassword, newPassword });
    return response.data;
};

export const createAdmin = async (admin) => {
    const response = await axiosClient.post("/admins", admin);
    return response.data;
};

export const updateAdmin = async (id, admin) => {
    const response = await axiosClient.put(`/admins/${id}`, admin);
    return response.data;
};

export const deactivateAdmin = async (id) => {
    const response = await axiosClient.delete(`/admins/${id}`);
    return response.data;
};
