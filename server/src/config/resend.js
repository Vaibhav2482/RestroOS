import { Resend } from "resend";

let resendInstance = null;

// Lazy singleton, same reasoning as config/razorpay.js and config/pusher.js:
// never build this eagerly at import time, so a server with no Resend key
// configured yet still boots and runs (just without notifications) instead
// of crashing.
export const getResendClient = () => {

    if (!process.env.RESEND_API_KEY) {
        return null;
    }

    if (!resendInstance) {
        resendInstance = new Resend(process.env.RESEND_API_KEY);
    }

    return resendInstance;

};
