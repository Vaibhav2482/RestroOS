import axiosClient from "../api/axiosClient";

// branchId is only actually used for a Branch Admin's token-derived branch
// on the server - passed here as a query param for the Owner case, where
// the caller picks which branch to view (mirrors Menu.jsx's branch selector).
export const getBranchStock = async (branchId) => {
    const response = await axiosClient.get("/inventory/branch-stock", { params: { branchId } });
    return response.data;
};

export const getValuation = async (branchId) => {
    const response = await axiosClient.get("/inventory/valuation", { params: { branchId } });
    return response.data;
};

export const getTransactions = async (branchId, filters = {}) => {
    const response = await axiosClient.get("/inventory/transactions", { params: { branchId, ...filters } });
    return response.data;
};

export const getDashboard = async (branchId) => {
    const response = await axiosClient.get("/inventory/dashboard", { params: { branchId } });
    return response.data;
};

export const recordOpeningStock = async (payload) => {
    const response = await axiosClient.post("/inventory/opening-stock", payload);
    return response.data;
};

export const recordWastage = async (payload) => {
    const response = await axiosClient.post("/inventory/wastage", payload);
    return response.data;
};

export const recordAdjustment = async (payload) => {
    const response = await axiosClient.post("/inventory/adjustment", payload);
    return response.data;
};
