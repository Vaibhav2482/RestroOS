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

// payload: { paymentMethod, discountAmount, discountReason, splits }. splits
// (when present) is [{ amount, paymentMethod }, ...] for a split bill - the
// top-level paymentMethod is only used for an ordinary, unsplit settle.
export const settleVisit = async (visitId, payload) => {
    const response = await axiosClient.post(`/table-visits/${visitId}/settle`, payload);
    return response.data;
};
