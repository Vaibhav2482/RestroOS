// Shared order-status helpers used by Orders.jsx, OrderDetailsDialog.jsx and
// Dashboard.jsx. Kept in one place so the two valid status sequences (which
// mirror the backend's forward-only guard) aren't duplicated across files.

export const DELIVERY_SEQUENCE = [
    "Pending",
    "Accepted",
    "Preparing",
    "Ready",
    "Out For Delivery",
    "Delivered"
];

export const DINE_IN_TAKEAWAY_SEQUENCE = [
    "Pending",
    "Accepted",
    "Preparing",
    "Ready",
    "Delivered"
];

export const getStatusSequence = (deliveryType) =>
    deliveryType === "Delivery" ? DELIVERY_SEQUENCE : DINE_IN_TAKEAWAY_SEQUENCE;

export const isTerminalStatus = (status) =>
    status === "Delivered" || status === "Cancelled";

// The backend allows jumping ahead in the sequence but never backward, so
// every status after the current one in the sequence is a valid next step.
export const getNextStatuses = (currentStatus, deliveryType) => {

    if (isTerminalStatus(currentStatus)) {
        return [];
    }

    const sequence = getStatusSequence(deliveryType);
    const currentIndex = sequence.indexOf(currentStatus);

    if (currentIndex === -1) {
        return [];
    }

    return sequence.slice(currentIndex + 1);

};

export const STATUS_CHIP_COLORS = {
    Pending: "default",
    Accepted: "info",
    Preparing: "warning",
    Ready: "secondary",
    "Out For Delivery": "primary",
    Delivered: "success",
    Cancelled: "error"
};

export const getStatusChipColor = (status) => STATUS_CHIP_COLORS[status] || "default";

export const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

export const isToday = (dateValue) => {

    if (!dateValue) {
        return false;
    }

    const date = new Date(dateValue);
    const today = new Date();

    return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    );

};
