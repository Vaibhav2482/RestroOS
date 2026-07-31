import axiosClient from "../api/axiosClient";

export const getLogs = async (filters = {}) => {
    const response = await axiosClient.get("/audit-logs", { params: filters });
    return response.data;
};
