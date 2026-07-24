import Pusher from "pusher-js";

import axiosClient from "../api/axiosClient";

let pusherInstance = null;

// Lazy singleton, and returns null (never throws) when the app isn't
// configured with Pusher keys yet - callers fall back to their existing
// polling in that case instead of realtime push.
export const getPusherClient = () => {

    const key = import.meta.env.VITE_PUSHER_KEY;
    const cluster = import.meta.env.VITE_PUSHER_CLUSTER;

    if (!key || !cluster) {
        return null;
    }

    if (!pusherInstance) {

        pusherInstance = new Pusher(key, {
            cluster,
            channelAuthorization: {
                customHandler: async ({ socketId, channelName }, callback) => {

                    try {

                        const response = await axiosClient.post("/realtime/pusher/auth", {
                            socketId,
                            channelName
                        });

                        callback(null, response.data);

                    } catch (error) {

                        callback(error, null);

                    }

                }
            }
        });

    }

    return pusherInstance;

};
