import rateLimit from "express-rate-limit";

// NOTE: this app runs as a Vercel serverless function (see api/index.js) -
// express-rate-limit's default store is an in-memory Map, which only counts
// requests handled by one warm instance. That still slows down a sustained
// burst from one attacker hitting a warm instance, but it is not a hard,
// globally-enforced cap the way it would be on a long-lived server; a
// distributed attempt spread across many cold starts isn't fully stopped by
// this alone. A shared store (e.g. Upstash Redis via the `rate-limit-redis`
// package) closes that gap if this ever needs to be airtight.

// Guards customer register and platform-admin bootstrap - routes where
// counting every request (success or fail) is fine, since neither can lock
// someone out of an account they own.
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Please try again in a few minutes." }
});

// Guards all three /login routes. `skipSuccessfulRequests` means only FAILED
// attempts count against the cap, so a correct password always gets through
// no matter how many typos preceded it - this is what makes it safe to put
// back on login without reintroducing the owner-lockout problem that got the
// previous, unqualified limiter removed from these routes entirely.
//
// The DB-backed per-account lockout (MAX_FAILED_ATTEMPTS in
// config/lockoutPolicy.js) stays removed - this limiter is IP-based, not
// per-account, so it doesn't lock a legitimate user out of their own
// account the way that policy did. It's also still the in-memory,
// per-warm-instance store described above, so a distributed attempt spread
// across cold starts isn't fully stopped by this alone; Upstash Redis
// closes that gap if this ever needs to be airtight.
export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, message: "Too many attempts. Please try again in a few minutes." }
});

// A much looser baseline across every other API route - not aimed at
// stopping targeted abuse (the routes that need that get their own tighter
// limiter above), just a backstop against a single client accidentally or
// deliberately hammering the API.
export const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please slow down." }
});
