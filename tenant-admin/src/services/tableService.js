import axiosClient from "../api/axiosClient";

export const getAllTables = async (branchId) => {
    const response = await axiosClient.get("/tables", { params: branchId ? { branchId } : {} });
    return response.data;
};

export const getActiveTables = async (branchId) => {
    const response = await axiosClient.get("/tables/active", { params: branchId ? { branchId } : {} });
    return response.data;
};

export const getTableById = async (id) => {
    const response = await axiosClient.get(`/tables/${id}`);
    return response.data;
};

export const createTable = async (table) => {
    const response = await axiosClient.post("/tables", table);
    return response.data;
};

export const updateTable = async (id, table) => {
    const response = await axiosClient.put(`/tables/${id}`, table);
    return response.data;
};

export const deactivateTable = async (id) => {
    const response = await axiosClient.delete(`/tables/${id}`);
    return response.data;
};
