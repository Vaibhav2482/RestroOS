import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";

import { authRateLimiter, generalRateLimiter, loginRateLimiter } from "./RateLimit.js";

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
