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

export const DINE_IN_SEQUENCE = [
    "Pending",
    "Accepted",
    "Preparing",
    "Ready",
    "Served"
];

export const TAKEAWAY_SEQUENCE = [
    "Pending",
    "Accepted",
    "Preparing",
    "Ready",
    "Picked Up"
];

export const getStatusSequence = (deliveryType) => {
    if (deliveryType === "Delivery") return DELIVERY_SEQUENCE;
    if (deliveryType === "Dine In") return DINE_IN_SEQUENCE;
    return TAKEAWAY_SEQUENCE;
};

// Each channel's terminal word is distinct, so a flat set-membership check
// (no DeliveryType needed) is unambiguous.
export const TERMINAL_STATUSES = ["Delivered", "Served", "Picked Up", "Cancelled"];

export const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

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

// Mirrors the backend's own hasStartedPreparing (OrderRepository.js) -
// duplicated deliberately rather than shared over the network, since this
// is a pure client-side check (used only to decide whether to disable the
// quick-advance button before ever making the request, not to enforce
// anything - the server's own gate is still what actually protects this).
export const hasStartedPreparing = (status, deliveryType) => {

    const sequence = getStatusSequence(deliveryType);
    const index = sequence.indexOf(status);

    return index !== -1 && index >= sequence.indexOf("Preparing");

};

export const STATUS_CHIP_COLORS = {
    Pending: "default",
    Accepted: "info",
    Preparing: "warning",
    Ready: "secondary",
    "Out For Delivery": "primary",
    Delivered: "success",
    Served: "success",
    "Picked Up": "success",
    Cancelled: "error"
};

export const getStatusChipColor = (status) => STATUS_CHIP_COLORS[status] || "default";

// en-IN grouping (1,00,000 rather than 100,000). Without separators a
// column of totals is genuinely hard to rank at a glance - ₹10500.00 and
// ₹1113.00 read as similar widths until you count digits.
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

export const formatCurrency = (amount) => CURRENCY_FORMATTER.format(Number(amount || 0));

// Dates render as "9 Aug 2026, 2:27 pm". toLocaleString() alone gave
// "8/9/2026, 2:27:48 PM": seconds are noise on an order list, and a
// numeric month is ambiguous for an India-based team, where 8/9 reads as
// 8 September rather than 9 August.
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
});

export const formatDateTime = (dateValue) => (
    dateValue ? DATE_TIME_FORMATTER.format(new Date(dateValue)) : "-"
);

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
