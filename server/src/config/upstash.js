import { Redis } from "@upstash/redis";

let redisInstance = null;

// Lazy singleton, same reasoning as config/razorpay.js and config/pusher.js:
// never build this eagerly at import time, or a server with no Upstash
// database configured yet would crash on boot instead of just falling back
// to the in-memory rate limiter (see middleware/RateLimit.js). The REST
// client (not ioredis) is the deliberate choice here - it talks HTTPS, no
// persistent TCP connection to keep alive across serverless cold starts.
export const getUpstashRedis = () => {

    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null;
    }

    if (!redisInstance) {

        redisInstance = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN
        });

    }

    return redisInstance;

};
