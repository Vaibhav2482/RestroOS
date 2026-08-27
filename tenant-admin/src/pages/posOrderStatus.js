// Status progression for Dine In / Takeaway orders taken from this POS
// screen (Delivery orders use an extra "Out For Delivery" step and are never
// created here). The two channels share every step except the last one -
// a Dine In order is "Served" at the table, a Takeaway order is "Picked Up"
// at the counter, so they can't share one terminal word.
export const POS_STATUS_STEPS_BY_TYPE = {
    "Dine In": ["Pending", "Accepted", "Preparing", "Ready", "Served"],
    "Takeaway": ["Pending", "Accepted", "Preparing", "Ready", "Picked Up"]
};

export const getPosStatusSteps = (deliveryType) =>
    POS_STATUS_STEPS_BY_TYPE[deliveryType] ?? POS_STATUS_STEPS_BY_TYPE["Takeaway"];

export const POS_CANCELLABLE_STATUSES = ["Pending", "Accepted", "Preparing"];

export const POS_STATUS_COLOR = {
    Pending: "warning",
    Accepted: "info",
    Preparing: "primary",
    Ready: "secondary",
    Served: "success",
    "Picked Up": "success",
    Cancelled: "error"
};

export const isPosCancellable = (status) => POS_CANCELLABLE_STATUSES.includes(status);

export const isPosTerminal = (status) => status === "Served" || status === "Picked Up" || status === "Cancelled";

// Every status ahead of the current one, in order - lets staff jump straight
// to (say) Served instead of clicking through every intermediate step.
// The server still enforces forward-only moves; this is just for the button list.
export const getPosForwardStatuses = (currentStatus, deliveryType) => {

    const steps = getPosStatusSteps(deliveryType);
    const currentIndex = steps.indexOf(currentStatus);

    if (currentIndex === -1) {
        return [];
    }

    return steps.slice(currentIndex + 1);

};
