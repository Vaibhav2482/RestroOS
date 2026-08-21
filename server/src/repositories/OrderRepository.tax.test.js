import { describe, it, expect, vi } from "vitest";

// Same reasoning as OrderRepository.statusGate.test.js - computeOrderTax is a
// pure function, and stubbing the pool it's imported alongside keeps this a
// unit test with no database anywhere near it.
vi.mock("../config/db.js", () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const { computeOrderTax } = await import("./OrderRepository.js");

const line = (unitPrice, quantity, taxRatePercent) => ({
    unitPrice, quantity, menuItem: { TaxRatePercent: taxRatePercent }
});

describe("computeOrderTax", () => {

    it("matches the old flat 2.5%+2.5% behaviour for a single item at the default 5% rate", () => {

        const result = computeOrderTax([line(100, 1, 5)], 100, 0);

        expect(result.cgstAmount).toBe(2.5);
        expect(result.sgstAmount).toBe(2.5);
        expect(result.totalAmount).toBe(105);

    });

    // The actual point of this fix - two items can't be taxed the same way
    // under a single order-level rate, because real F&B has multiple slabs.
    it("taxes each line at its own item's rate, not one rate for the whole order", () => {

        const items = [line(100, 1, 5), line(100, 1, 18)];
        const result = computeOrderTax(items, 200, 0);

        // 5% of 100 = 5 (2.5/2.5). 18% of 100 = 18 (9/9).
        expect(result.cgstAmount).toBe(11.5);
        expect(result.sgstAmount).toBe(11.5);
        expect(result.totalAmount).toBe(223);

    });

    it("apportions a discount pro-rata across lines before taxing each one at its own rate", () => {

        // Two equal-price lines at different rates, half the order discounted -
        // each line absorbs half the discount (its 50/50 share of the 200
        // subtotal), so each is taxed on 50, not the full 100.
        const items = [line(100, 1, 5), line(100, 1, 18)];
        const result = computeOrderTax(items, 200, 100);

        // 5% of 50 = 2.5 (1.25/1.25). 18% of 50 = 9 (4.5/4.5).
        expect(result.cgstAmount).toBe(5.75);
        expect(result.sgstAmount).toBe(5.75);
        expect(result.totalAmount).toBe(111.5);

    });

    // The exact bug the original flat-rate code had: rounding CGST and SGST
    // independently can land a paisa off the line's true combined rate.
    it("splits CGST/SGST from one rounded line total, so the two always sum to it exactly", () => {

        // 5% of 33.33 = 1.6665, which rounds to 1.67. Rounding each half
        // independently (round(1.6665 / 2), twice) lands on 0.83 + 0.83 =
        // 1.66 - a paisa short of the real 5%.
        const result = computeOrderTax([line(33.33, 1, 5)], 33.33, 0);

        expect(result.cgstAmount + result.sgstAmount).toBe(1.67);

    });

    it("never taxes a negative amount when a discount exceeds a line's own share of the subtotal", () => {

        const result = computeOrderTax([line(10, 1, 5)], 10, 100);

        expect(result.cgstAmount).toBe(0);
        expect(result.sgstAmount).toBe(0);
        expect(result.totalAmount).toBe(0);

    });

    it("treats a missing tax rate as untaxed rather than throwing", () => {

        const result = computeOrderTax([line(100, 1, undefined)], 100, 0);

        expect(result.cgstAmount).toBe(0);
        expect(result.sgstAmount).toBe(0);
        expect(result.totalAmount).toBe(100);

    });

});
