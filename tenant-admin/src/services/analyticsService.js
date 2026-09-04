import axiosClient from "../api/axiosClient";

export const getOverview = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/overview", { params: { branchId, from, to } });
    return response.data;
};

export const getBranchComparison = async (from, to) => {
    const response = await axiosClient.get("/analytics/branch-comparison", { params: { from, to } });
    return response.data;
};

export const getMenuProfitability = async (branchId) => {
    const response = await axiosClient.get("/analytics/menu-profitability", { params: { branchId } });
    return response.data;
};

export const getTaxSummary = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/tax-summary", { params: { branchId, from, to } });
    return response.data;
};

export const getPaymentBreakdown = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/payment-breakdown", { params: { branchId, from, to } });
    return response.data;
};

export const getSalesSummary = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/sales-summary", { params: { branchId, from, to } });
    return response.data;
};

export const getCategorySales = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/category-sales", { params: { branchId, from, to } });
    return response.data;
};

export const getStaffSales = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/staff-sales", { params: { branchId, from, to } });
    return response.data;
};

export const getCouponUsage = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/coupon-usage", { params: { branchId, from, to } });
    return response.data;
};

export const getCancelledOrders = async (branchId, from, to) => {
    const response = await axiosClient.get("/analytics/cancelled-orders", { params: { branchId, from, to } });
    return response.data;
};

export const getDayEndSummary = async (branchId, date) => {
    const response = await axiosClient.get("/analytics/day-end", { params: { branchId, date } });
    return response.data;
};
