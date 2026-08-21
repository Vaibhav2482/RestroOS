import { describe, it, expect } from "vitest";

import { computeCheckoutEstimate } from "./checkoutTax";

const line = (totalPrice, taxRatePercent) => ({ TotalPrice: totalPrice, TaxRatePercent: taxRatePercent });

describe("computeCheckoutEstimate", () => {

    it("matches the old flat 5% behaviour for a single item at the default rate", () => {

        const result = computeCheckoutEstimate([line(100, 5)]);

        expect(result.cgstAmount).toBe(2.5);
        expect(result.sgstAmount).toBe(2.5);
        expect(result.grandTotal).toBe(105);

    });

    // The actual point of this fix - a cart mixing a standard item and a
    // higher-slab item must tax each at its own rate, not one blended rate.
    it("taxes each cart line at its own item's rate", () => {

        const result = computeCheckoutEstimate([line(100, 5), line(100, 18)]);

        expect(result.cgstAmount).toBe(11.5);
        expect(result.sgstAmount).toBe(11.5);
        expect(result.grandTotal).toBe(223);

    });

    it("apportions a coupon discount pro-rata across lines before taxing each one", () => {

        const result = computeCheckoutEstimate([line(100, 5), line(100, 18)], 100);

        // Each line absorbs half the discount (its 50/50 share of the
        // subtotal) - taxed on 50, not the full 100, at its own rate.
        expect(result.cgstAmount).toBe(5.75);
        expect(result.sgstAmount).toBe(5.75);
        expect(result.grandTotal).toBe(111.5);

    });

    it("stays exactly in sync with what OrderRepository.computeOrderTax will actually charge on the server", () => {

        // Same odd-paisa case as the server-side test: 5% of 33.33 rounds to
        // 1.67, which independently-rounded halves would land on 1.66.
        const result = computeCheckoutEstimate([line(33.33, 5)]);

        expect(result.cgstAmount + result.sgstAmount).toBe(1.67);

    });

    it("never estimates a negative tax when a discount exceeds the cart", () => {

        const result = computeCheckoutEstimate([line(10, 5)], 100);

        expect(result.cgstAmount).toBe(0);
        expect(result.sgstAmount).toBe(0);
        expect(result.grandTotal).toBe(0);

    });

});
