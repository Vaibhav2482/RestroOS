import axiosClient from "../api/axiosClient";

// A table's current dining session (see server migration
// 0024_table_visits) - every round/Order placed for an occupied table
// belongs to its one Open visit, and settling that visit (not any single
// order's status) is what frees the table.

export const getOpenVisitForTable = async (branchId, tableNumber) => {
    const response = await axiosClient.get(`/table-visits/branch/${branchId}/table/${encodeURIComponent(tableNumber)}`);
    return response.data;
};

export const getVisitDetails = async (visitId) => {
    const response = await axiosClient.get(`/table-visits/${visitId}`);
    return response.data;
};

export const settleVisit = async (visitId, paymentMethod) => {
    const response = await axiosClient.post(`/table-visits/${visitId}/settle`, { paymentMethod });
    return response.data;
};

export const updateGuestCount = async (visitId, guestCount) => {
    const response = await axiosClient.put(`/table-visits/${visitId}/guest-count`, { guestCount });
    return response.data;
};
