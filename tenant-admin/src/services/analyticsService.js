import axiosClient from "../api/axiosClient";

export const getOverview = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/overview", { params: { branchId, from, to } });
    return response.data;
};

export const getBranchComparison = async (from, to) => {
    const response = await axiosClient.get("/analytics/branch-comparison", { params: { from, to } });
    return response.data;
};
