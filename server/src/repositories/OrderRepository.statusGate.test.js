import { describe, it, expect, vi } from "vitest";

// The pool is imported at module load but never queried by the pure helper
// under test, so a stub keeps this a unit test with no database anywhere
// near it.
vi.mock("../config/db.js", () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const { hasStartedPreparing } = await import("./OrderRepository.js");

describe("hasStartedPreparing - the gate on stock consumption", () => {

    it("is true at Preparing itself, for both status sequences", () => {

        expect(hasStartedPreparing("Preparing", "Delivery")).toBe(true);
        expect(hasStartedPreparing("Preparing", "Dine In")).toBe(true);

    });

    // The regression this exists for: status may jump several steps forward
    // in one move, so a Pending order marked straight to Ready never passed
    // through Preparing. Gating on equality meant it deducted nothing and
    // could reach Delivered having never touched stock.
    it("is true for every status past Preparing, not only an exact match", () => {

        expect(hasStartedPreparing("Ready", "Dine In")).toBe(true);
        expect(hasStartedPreparing("Served", "Dine In")).toBe(true);
        expect(hasStartedPreparing("Ready", "Takeaway")).toBe(true);
        expect(hasStartedPreparing("Picked Up", "Takeaway")).toBe(true);
        expect(hasStartedPreparing("Ready", "Delivery")).toBe(true);
        expect(hasStartedPreparing("Out For Delivery", "Delivery")).toBe(true);
        expect(hasStartedPreparing("Delivered", "Delivery")).toBe(true);

    });

    it("is false before the kitchen has started", () => {

        expect(hasStartedPreparing("Pending", "Dine In")).toBe(false);
        expect(hasStartedPreparing("Accepted", "Dine In")).toBe(false);
        expect(hasStartedPreparing("Accepted", "Delivery")).toBe(false);

    });

    it("is false for Cancelled, which sits in neither sequence", () => {

        expect(hasStartedPreparing("Cancelled", "Dine In")).toBe(false);
        expect(hasStartedPreparing("Cancelled", "Delivery")).toBe(false);

    });

    it("does not treat Out For Delivery as reached on a dine-in order", () => {

        // Not part of the dine-in/takeaway sequence at all - it should read as
        // unknown rather than silently ranking against the wrong list.
        expect(hasStartedPreparing("Out For Delivery", "Dine In")).toBe(false);

    });

});
