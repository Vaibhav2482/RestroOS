// Status progression for Dine In / Takeaway orders taken from this POS screen.
// (Delivery orders use an extra "Out For Delivery" step, but this screen never
// creates Delivery orders, so it's left out here.)
export const POS_STATUS_STEPS = ["Pending", "Accepted", "Preparing", "Ready", "Delivered"];

export const POS_CANCELLABLE_STATUSES = ["Pending", "Accepted", "Preparing"];

export const POS_STATUS_COLOR = {
    Pending: "warning",
    Accepted: "info",
    Preparing: "primary",
    Ready: "secondary",
    Delivered: "success",
    Cancelled: "error"
};

export const isPosCancellable = (status) => POS_CANCELLABLE_STATUSES.includes(status);

export const isPosTerminal = (status) => status === "Delivered" || status === "Cancelled";

// Every status ahead of the current one, in order - lets staff jump straight
// to (say) Delivered instead of clicking through every intermediate step.
// The server still enforces forward-only moves; this is just for the button list.
export const getPosForwardStatuses = (currentStatus) => {

    const currentIndex = POS_STATUS_STEPS.indexOf(currentStatus);

    if (currentIndex === -1) {
        return [];
    }

    return POS_STATUS_STEPS.slice(currentIndex + 1);

};
