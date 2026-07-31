// Shared across Admin/Customer/PlatformAdmin login - all three services
// apply the same threshold. No rate limiting existed before this (a
// security audit flagged unlimited login attempts as a real gap); a naive
// in-memory limiter wouldn't actually work here since this runs as
// stateless Vercel serverless functions with no shared memory between
// invocations, so the counter lives in the same row being authenticated
// against instead.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
