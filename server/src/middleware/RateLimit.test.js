import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";

import { authRateLimiter, generalRateLimiter } from "./RateLimit.js";

// A minimal standalone app per test, not the real app.js - app.js's other
// routes go through the migrations middleware (a real DB connection
// attempt), which has nothing to do with what's under test here: the
// limiter's own request-counting behavior.
const buildApp = (limiter) => {

    const app = express();
    app.post("/action", limiter, (req, res) => res.status(200).json({ success: true }));

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

describe("generalRateLimiter", () => {

    it("advertises its limit via standard rate-limit headers", async () => {

        const app = buildApp(generalRateLimiter);

        const response = await request(app).post("/action");

        expect(response.status).toBe(200);
        expect(response.headers["ratelimit-limit"]).toBe("120");

    });

});
