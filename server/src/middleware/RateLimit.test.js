import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

import * as upstash from "../config/upstash.js";

// Every test in this describe-free top section (and the two suites below
// that don't opt into a mocked Redis) exercises the in-memory fallback path
// deliberately - getUpstashRedis() returning null here is what makes that
// happen, matching a deployment with no Upstash configured. This also keeps
// the suite from making real network calls to an actual Redis instance on
// every run.
vi.mock("../config/upstash.js");

const { authRateLimiter, generalRateLimiter, loginRateLimiter } = await import("./RateLimit.js");

// A minimal standalone app per test, not the real app.js - app.js's other
// routes go through the migrations middleware (a real DB connection
// attempt), which has nothing to do with what's under test here: the
// limiter's own request-counting behavior.
const buildApp = (limiter) => {

    const app = express();
    app.post("/action", limiter, (req, res) => res.status(200).json({ success: true }));

    return app;

};

// loginRateLimiter is a module-level singleton, so its internal store
// persists across every test in this file, keyed by IP - and every
// supertest request otherwise comes from the same loopback address. Trusting
// X-Forwarded-For and giving each test its own fake IP keeps the tests
// isolated from each other while still exercising the real exported
// limiter, not a rebuilt copy of it.
let nextTestIp = 1;
const uniqueIp = () => `10.0.0.${(nextTestIp += 1)}`;

beforeEach(() => {

    vi.clearAllMocks();
    // Default every test to "Upstash not configured" so the existing
    // suites below keep exercising the in-memory fallback exactly as
    // before - the dedicated "distributed limiter" suite further down
    // overrides this per-test with a mocked Redis client instead.
    upstash.getUpstashRedis.mockReturnValue(null);

});

// loginRateLimiter's whole point is telling success from failure apart, so
// its app needs a route that can return either on request.
const buildLoginApp = () => {

    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.post("/action", loginRateLimiter, (req, res) => {

        if (req.body.fail) {
            return res.status(401).json({ success: false });
        }

        return res.status(200).json({ success: true });

    });

    return app;

};

describe("authRateLimiter", () => {

    it("allows requests under the limit", async () => {

        const app = buildApp(authRateLimiter);

        const response = await request(app).post("/action");

        expect(response.status).toBe(200);

    });

    it("blocks once the same IP exceeds the configured limit within the window", async () => {

        const app = buildApp(authRateLimiter);

        let lastResponse;

        for (let i = 0; i < 21; i += 1) {
            lastResponse = await request(app).post("/action");
        }

        expect(lastResponse.status).toBe(429);
        expect(lastResponse.body.message).toMatch(/too many attempts/i);

    });

});

describe("loginRateLimiter", () => {

    it("allows requests under the limit", async () => {

        const app = buildLoginApp();
        const ip = uniqueIp();

        const response = await request(app).post("/action").set("X-Forwarded-For", ip).send({ fail: false });

        expect(response.status).toBe(200);

    });

    it("blocks once failed attempts from the same IP exceed the configured limit", async () => {

        const app = buildLoginApp();
        const ip = uniqueIp();

        let lastResponse;

        for (let i = 0; i < 21; i += 1) {
            lastResponse = await request(app).post("/action").set("X-Forwarded-For", ip).send({ fail: true });
        }

        expect(lastResponse.status).toBe(429);
        expect(lastResponse.body.message).toMatch(/too many attempts/i);

    });

    it("does not block a long run of successful requests", async () => {

        const app = buildLoginApp();
        const ip = uniqueIp();

        let lastResponse;

        for (let i = 0; i < 25; i += 1) {
            lastResponse = await request(app).post("/action").set("X-Forwarded-For", ip).send({ fail: false });
        }

        expect(lastResponse.status).toBe(200);

    });

    it("still lets a correct password through after failed attempts under the cap", async () => {

        const app = buildLoginApp();
        const ip = uniqueIp();

        for (let i = 0; i < 19; i += 1) {
            await request(app).post("/action").set("X-Forwarded-For", ip).send({ fail: true });
        }

        const response = await request(app).post("/action").set("X-Forwarded-For", ip).send({ fail: false });

        expect(response.status).toBe(200);

    });

});

describe("generalRateLimiter", () => {

    it("advertises its limit via standard rate-limit headers", async () => {

        const app = buildApp(generalRateLimiter);

        const response = await request(app).post("/action");

        expect(response.status).toBe(200);
        expect(response.headers["ratelimit-limit"]).toBe("120");

    });

});

// A minimal fake implementing just the 3 Redis commands the distributed
// limiter actually calls - deterministic and network-free, but real enough
// (a genuine Map, real TTL bookkeeping) to exercise the real increment/
// expire/decrement logic in RateLimit.js rather than a rebuilt copy of it.
const buildFakeRedis = () => {

    const store = new Map();

    return {

        incr: vi.fn(async (key) => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return next;
        }),

        expire: vi.fn(async () => 1),

        decr: vi.fn(async (key) => {
            const next = (store.get(key) ?? 0) - 1;
            store.set(key, next);
            return next;
        })

    };

};

describe("Distributed rate limiting (Upstash configured)", () => {

    it("uses the Redis-backed path instead of the in-memory fallback when Upstash is configured", async () => {

        const fakeRedis = buildFakeRedis();
        upstash.getUpstashRedis.mockReturnValue(fakeRedis);

        const app = buildApp(authRateLimiter);

        const response = await request(app).post("/action");

        expect(response.status).toBe(200);
        expect(fakeRedis.incr).toHaveBeenCalledTimes(1);

    });

    it("blocks once the same key exceeds the limit via Redis, not the in-memory store", async () => {

        const fakeRedis = buildFakeRedis();
        upstash.getUpstashRedis.mockReturnValue(fakeRedis);

        const app = buildApp(authRateLimiter);

        let lastResponse;

        for (let i = 0; i < 21; i += 1) {
            lastResponse = await request(app).post("/action");
        }

        expect(lastResponse.status).toBe(429);
        expect(fakeRedis.incr).toHaveBeenCalledTimes(21);

    });

    it("decrements on a successful login instead of counting it against the cap", async () => {

        const fakeRedis = buildFakeRedis();
        upstash.getUpstashRedis.mockReturnValue(fakeRedis);

        const app = buildLoginApp();

        await request(app).post("/action").send({ fail: false });

        // res.on("finish") fires asynchronously after the response is sent -
        // give it a tick before asserting the decrement actually ran.
        await vi.waitFor(() => expect(fakeRedis.decr).toHaveBeenCalledTimes(1));

    });

    it("does not decrement on a failed login attempt", async () => {

        const fakeRedis = buildFakeRedis();
        upstash.getUpstashRedis.mockReturnValue(fakeRedis);

        const app = buildLoginApp();

        await request(app).post("/action").send({ fail: true });

        // Give any (incorrect, in this case) decrement a chance to fire
        // before asserting it didn't.
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(fakeRedis.decr).not.toHaveBeenCalled();

    });

    it("fails open to the in-memory limiter for that request when Redis errors", async () => {

        const fakeRedis = buildFakeRedis();
        fakeRedis.incr.mockRejectedValueOnce(new Error("ECONNRESET"));
        upstash.getUpstashRedis.mockReturnValue(fakeRedis);

        // authRateLimiter's in-memory fallback is a module-level singleton
        // shared with the plain "authRateLimiter" suite above (which
        // deliberately exhausts it for the default test IP) - a fresh,
        // never-before-used IP keeps this test's fallback hit isolated from
        // that accumulated state instead of colliding with it.
        const app = express();
        app.set("trust proxy", true);
        app.post("/action", authRateLimiter, (req, res) => res.status(200).json({ success: true }));

        const response = await request(app).post("/action").set("X-Forwarded-For", uniqueIp());

        // A single Redis hiccup must never itself block a real request.
        expect(response.status).toBe(200);

    });

});
