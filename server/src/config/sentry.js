import * as Sentry from "@sentry/node";

let initialized = false;

// Lazy, same reasoning as config/resend.js/twilio.js/razorpay.js - a server
// with no SENTRY_DSN configured yet still boots and runs (just without error
// reporting) instead of crashing or silently sending events nowhere. Safe to
// call more than once per warm instance (idempotent no-op after the first
// call) - app.js calls this unconditionally on every cold start.
export const initSentry = () => {

    if (initialized || !process.env.SENTRY_DSN) {
        return;
    }

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0
    });

    initialized = true;

};

// ErrorHandler.js only calls this for 500s it's about to report - checking
// here too keeps this module safe to import/call even where SENTRY_DSN was
// never set, rather than pushing that check onto every call site.
export const captureException = (error) => {

    if (!initialized) {
        return;
    }

    Sentry.captureException(error);

};
