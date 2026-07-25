import twilio from "twilio";

let twilioInstance = null;

// Lazy singleton, same reasoning as config/resend.js and config/pusher.js:
// never build this eagerly at import time, so a server with no Twilio
// credentials configured yet still boots and runs (just without SMS/WhatsApp)
// instead of crashing. One client serves both channels - Twilio's API
// distinguishes SMS from WhatsApp by the "from"/"to" number prefix, not by
// a separate client.
export const getTwilioClient = () => {

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return null;
    }

    if (!twilioInstance) {
        twilioInstance = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }

    return twilioInstance;

};
