import Razorpay from "razorpay";

let razorpayInstance = null;

// Lazy singleton: the SDK throws at construction time if key_id/key_secret
// are missing, so building it eagerly at import time would crash the whole
// server for anyone who hasn't set up Razorpay yet. Returns null until both
// env vars are present.
export const getRazorpayClient = () => {

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return null;
    }

    if (!razorpayInstance) {

        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

    }

    return razorpayInstance;

};
