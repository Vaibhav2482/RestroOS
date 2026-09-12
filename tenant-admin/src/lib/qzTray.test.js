import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("qz-tray", () => ({
    default: {
        websocket: { isActive: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn() },
        printers: { find: vi.fn() },
        configs: { create: vi.fn() },
        print: vi.fn()
    }
}));

beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
});

describe("qzTray printer settings - kot/bill are independent slots", () => {

    it("saves and reads the KOT and Bill printers under separate keys", async () => {

        const qzTray = await import("./qzTray.js");

        qzTray.saveSelectedPrinter("Kitchen-80mm", "kot");
        qzTray.saveSelectedPrinter("Counter-58mm", "bill");

        expect(qzTray.getSavedPrinter("kot")).toBe("Kitchen-80mm");
        expect(qzTray.getSavedPrinter("bill")).toBe("Counter-58mm");

    });

    it("defaults getSavedPrinter/saveSelectedPrinter to the kot role when none is given", async () => {

        const qzTray = await import("./qzTray.js");

        qzTray.saveSelectedPrinter("Kitchen-80mm");

        expect(qzTray.getSavedPrinter()).toBe("Kitchen-80mm");
        expect(qzTray.getSavedPrinter("kot")).toBe("Kitchen-80mm");

    });

    it("returns an empty string for a role that's never been set", async () => {

        const qzTray = await import("./qzTray.js");

        expect(qzTray.getSavedPrinter("bill")).toBe("");

    });

    // Regression coverage for the migration itself: before "bill" existed,
    // every till printed bills to whatever was configured as the single
    // "KOT" printer - this is what keeps that till working unchanged
    // instead of silently reverting to browser-print the moment this
    // shipped.
    it("migrates an existing KOT printer into the Bill slot on first load, once", async () => {

        localStorage.setItem("restroos_kot_printer", "Kitchen-80mm");

        const qzTray = await import("./qzTray.js");

        expect(qzTray.getSavedPrinter("bill")).toBe("Kitchen-80mm");
        expect(qzTray.getSavedPrinter("kot")).toBe("Kitchen-80mm");

    });

    it("does not overwrite a deliberately-cleared Bill printer on a later load", async () => {

        localStorage.setItem("restroos_kot_printer", "Kitchen-80mm");
        localStorage.setItem("restroos_bill_printer", "");

        const qzTray = await import("./qzTray.js");

        expect(qzTray.getSavedPrinter("bill")).toBe("");

    });

    it("does not migrate anything when there was never a KOT printer set either", async () => {

        const qzTray = await import("./qzTray.js");

        expect(qzTray.getSavedPrinter("bill")).toBe("");
        expect(localStorage.getItem("restroos_bill_printer")).toBeNull();

    });

});

describe("qzTray.printRaw", () => {

    it("throws a role-agnostic error when no printer name is given", async () => {

        const qzTray = await import("./qzTray.js");

        await expect(qzTray.printRaw("", "TICKET")).rejects.toThrow(/no printer is configured/i);

    });

});
