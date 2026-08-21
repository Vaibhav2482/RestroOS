import rateLimit from "express-rate-limit";

import { getUpstashRedis } from "../config/upstash.js";

// Vercel serverless: express-rate-limit's default in-memory Map only counts
// requests handled by one warm instance, not a hard, globally-enforced cap -
// a distributed attempt spread across many cold starts isn't fully stopped
// by it alone. buildDistributedLimiter below closes that gap for the two
// auth-sensitive limiters when Upstash is configured (UPSTASH_REDIS_REST_URL
// / UPSTASH_REDIS_REST_TOKEN); every other route keeps the in-memory
// backstop, same as before.

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 20;
const LIMIT_MESSAGE = { success: false, message: "Too many attempts. Please try again in a few minutes." };

// A plain fixed-window counter (INCR + EXPIRE-on-first-hit), not
// @upstash/ratelimit's higher-level sliding-window helper - that library
// has no built-in "only count failed attempts" mode, and skipSuccessfulRequests
// is the whole reason this can safely guard login without reintroducing the
// owner-lockout problem that got the original, unqualified limiter removed
// (see the routes that use loginRateLimiter). Implemented as increment-then-
// decrement-on-success: pessimistic (a request that turns out to succeed
// briefly counts against the window for the few ms until its response
// finishes), which can very rarely over-count for a moment under real
// concurrency - an accepted, self-correcting tradeoff, not a correctness bug,
// for a security backstop rather than a precise accounting system.
const buildDistributedLimiter = ({ keyPrefix, skipSuccessfulRequests }) => {

    const fallback = rateLimit({
        windowMs: WINDOW_SECONDS * 1000,
        limit: MAX_ATTEMPTS,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        message: LIMIT_MESSAGE
    });

    return async (req, res, next) => {

        const redis = getUpstashRedis();

        if (!redis) {
            return fallback(req, res, next);
        }

        const key = `ratelimit:${keyPrefix}:${req.ip}`;

        let count;

        try {

            count = await redis.incr(key);

            if (count === 1) {
                await redis.expire(key, WINDOW_SECONDS);
            }

        } catch (error) {

            // Fail open - a Redis hiccup must never be the reason a real
            // login/register request gets blocked. Falls back to the
            // in-memory limiter for this one request rather than skipping
            // rate limiting entirely.
            console.error(`Rate limit check failed for "${keyPrefix}", falling back to in-memory: ${error.message}`);
            return fallback(req, res, next);

        }

        if (count > MAX_ATTEMPTS) {
            return res.status(429).json(LIMIT_MESSAGE);
        }

        if (!skipSuccessfulRequests) {
            return next();
        }

        res.on("finish", () => {

            if (res.statusCode < 400) {
                redis.decr(key).catch((error) => {
                    console.error(`Rate limit decrement failed for "${keyPrefix}": ${error.message}`);
                });
            }

        });

        next();

    };

};

// Guards customer register and platform-admin bootstrap - routes where
// counting every request (success or fail) is fine, since neither can lock
// someone out of an account they own.
export const authRateLimiter = buildDistributedLimiter({ keyPrefix: "auth", skipSuccessfulRequests: false });

// Guards all three /login routes. skipSuccessfulRequests means only FAILED
// attempts count against the cap, so a correct password always gets through
// no matter how many typos preceded it - this is what makes it safe to put
// back on login without reintroducing the owner-lockout problem that got the
// previous, unqualified limiter removed from these routes entirely.
//
// The DB-backed per-account lockout (MAX_FAILED_ATTEMPTS in
// config/lockoutPolicy.js) stays removed - this limiter is IP-based, not
// per-account, so it doesn't lock a legitimate user out of their own
// account the way that policy did.
export const loginRateLimiter = buildDistributedLimiter({ keyPrefix: "login", skipSuccessfulRequests: true });

// A much looser baseline across every other API route - not aimed at
// stopping targeted abuse (the routes that need that get their own tighter
// limiter above), just a backstop against a single client accidentally or
// deliberately hammering the API. Stays in-memory-only: adding a Redis round
// trip to every single API request for a non-security backstop isn't worth
// the added latency.
export const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please slow down." }
});
