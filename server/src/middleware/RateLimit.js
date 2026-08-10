import rateLimit from "express-rate-limit";

// NOTE: this app runs as a Vercel serverless function (see api/index.js) -
// express-rate-limit's default store is an in-memory Map, which only counts
// requests handled by one warm instance. That still slows down a sustained
// burst from one attacker hitting a warm instance, but it is not a hard,
// globally-enforced cap the way it would be on a long-lived server; a
// distributed attempt spread across many cold starts isn't fully stopped by
// this alone. A shared store (e.g. Upstash Redis via the `rate-limit-redis`
// package) closes that gap if this ever needs to be airtight.

// Applied only to login/register/bootstrap. This is now the ONLY brake on
// repeated login attempts: the DB-backed per-account lockout that used to
// back it up has been removed, so there is no longer anything that stops
// sustained guessing against one known email beyond the per-source limit
// below - and per the note above, that limit is per warm instance rather
// than global.
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
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
