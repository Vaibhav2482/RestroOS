import Pusher from "pusher";

let pusherInstance = null;

// Lazy singleton, same reasoning as config/razorpay.js: never build this
// eagerly at import time, or a server with no Pusher app configured yet
// would crash on boot instead of just running without realtime updates.
export const getPusherClient = () => {

    if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET || !process.env.PUSHER_CLUSTER) {
        return null;
    }

    if (!pusherInstance) {

        pusherInstance = new Pusher({
            appId: process.env.PUSHER_APP_ID,
            key: process.env.PUSHER_KEY,
            secret: process.env.PUSHER_SECRET,
            cluster: process.env.PUSHER_CLUSTER,
            useTLS: true
        });

    }

    return pusherInstance;

};
