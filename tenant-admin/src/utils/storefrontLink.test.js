import { describe, it, expect, afterEach } from "vitest";

import { buildTableOrderUrl } from "./storefrontLink.js";

describe("buildTableOrderUrl", () => {

    afterEach(() => {
        delete import.meta.env.VITE_STOREFRONT_URL;
    });

    it("falls back to the local dev storefront port when the env var is unset", () => {

        expect(buildTableOrderUrl("alpha-diner", "A3")).toBe("http://localhost:5177/alpha-diner?table=A3");

    });

    it("uses VITE_STOREFRONT_URL when set", () => {

        import.meta.env.VITE_STOREFRONT_URL = "https://storefront-liard-ten.vercel.app";

        expect(buildTableOrderUrl("alpha-diner", "A3")).toBe("https://storefront-liard-ten.vercel.app/alpha-diner?table=A3");

    });

    it("URL-encodes a table name with spaces or special characters", () => {

        expect(buildTableOrderUrl("alpha-diner", "Patio 1")).toBe("http://localhost:5177/alpha-diner?table=Patio%201");

    });

});
