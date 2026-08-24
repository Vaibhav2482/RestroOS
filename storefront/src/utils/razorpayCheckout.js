import * as paymentService from "../services/paymentService";

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

// Loaded lazily, only when a Card/UPI order actually needs the widget.
export function loadRazorpayScript() {

    return new Promise((resolve) => {

        if (window.Razorpay) {
            resolve(true);
            return;
        }

        const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);

        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(true));
            existingScript.addEventListener("error", () => resolve(false));
            return;
        }

        const script = document.createElement("script");
        script.src = RAZORPAY_SCRIPT_SRC;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);

    });

}

// Best-effort - if this call itself fails, the caller's own onFailure still
// fires from the widget event that triggered it, so the customer isn't left
// without feedback either way. razorpayOrderId may be undefined if the
// order-creation step itself never got far enough to have one - nothing to
// record in that case.
async function recordFailedAttempt(orderId, razorpayOrderId) {

    if (!razorpayOrderId) {
        return;
    }

    try {
        await paymentService.recordFailedPayment(orderId, razorpayOrderId);
    } catch {
        // swallowed - see comment above
    }

}

// Shared between Checkout.jsx (first payment attempt) and OrderDetail.jsx
// (retry) - same createRazorpayOrder -> widget -> verify sequence either
// way, just against an order that may already exist with a prior Failed
// attempt on it. onSuccess/onFailure let each caller own its own toast
// wording and navigation; this only orchestrates the Razorpay/API calls.
export async function openRazorpayCheckout({ order, customer, paymentMethod, themeColor, onSuccess, onFailure }) {

    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded) {
        onFailure({ reason: "script-load-failed" });
        return;
    }

    const razorpayOrderResponse = await paymentService.createRazorpayOrder(order.OrderId);

    if (!razorpayOrderResponse.success) {
        onFailure({ reason: "create-order-failed", message: razorpayOrderResponse.message });
        return;
    }

    const { razorpayOrderId, amount, currency, keyId } = razorpayOrderResponse.data;

    const razorpayCheckout = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        order_id: razorpayOrderId,
        name: "RestroOS",
        description: `Order #${order.OrderId}`,
        prefill: {
            name: customer.FullName,
            email: customer.Email,
            contact: customer.Phone
        },
        theme: { color: themeColor },
        handler: async (response) => {

            try {

                const verifyResponse = await paymentService.verifyRazorpayPayment({
                    orderId: order.OrderId,
                    paymentMethod,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature
                });

                if (!verifyResponse.success) {
                    onFailure({ reason: "verify-failed", message: verifyResponse.message });
                } else {
                    onSuccess();
                }

            } catch (verifyError) {

                onFailure({ reason: "verify-error", message: verifyError.response?.data?.message });

            }

        },
        modal: {
            ondismiss: async () => {
                await recordFailedAttempt(order.OrderId, razorpayOrderId);
                onFailure({ reason: "dismissed" });
            }
        }
    });

    razorpayCheckout.on("payment.failed", async (response) => {
        await recordFailedAttempt(order.OrderId, razorpayOrderId);
        onFailure({ reason: "payment-failed", message: response.error?.description });
    });

    razorpayCheckout.open();

}
