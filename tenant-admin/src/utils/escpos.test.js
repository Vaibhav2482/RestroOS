import { describe, it, expect } from "vitest";

import { twoColumn, centered, formatMoney, PAPER_WIDTH_CHARS } from "./escpos";

describe("twoColumn - the building block every label/value receipt row uses", () => {

    it("pads the gap so left+gap+right fills exactly the target width", () => {

        const line = twoColumn("Subtotal", "Rs. 100.00", 20);

        expect(line).toBe("Subtotal  Rs. 100.00\n");
        expect(line.length - 1).toBe(20); // -1 for the trailing newline

    });

    it("never truncates the right (value) side, even when the line runs long", () => {

        const line = twoColumn("A very long item name that will not fit", "Rs. 1,234.00", 20);

        expect(line).toContain("Rs. 1,234.00");
        expect(line.endsWith("Rs. 1,234.00\n")).toBe(true);

    });

    it("truncates the left side instead when both can't fit", () => {

        const line = twoColumn("A very long item name that will not fit", "Rs. 1,234.00", 20);

        expect(line.length - 1).toBeLessThanOrEqual(20 + "Rs. 1,234.00".length); // sane upper bound
        expect(line).not.toContain("that will not fit");

    });

    it("defaults to PAPER_WIDTH_CHARS when no width is given", () => {

        const line = twoColumn("Left", "Right");

        expect(line.length - 1).toBe(PAPER_WIDTH_CHARS);

    });

});

describe("centered", () => {

    it("pads evenly on the left to roughly center short text", () => {

        const line = centered("HELLO", 11);

        expect(line).toBe("   HELLO\n");

    });

    it("never goes negative when the text is wider than the target width", () => {

        expect(() => centered("a very very very long line of text indeed", 10)).not.toThrow();

    });

});

describe("formatMoney - Rs. prefix, not the Rupee glyph", () => {

    it("formats to two decimals with an Rs. prefix", () => {

        expect(formatMoney(417.9)).toBe("Rs. 417.90");
        expect(formatMoney(0)).toBe("Rs. 0.00");
        expect(formatMoney(undefined)).toBe("Rs. 0.00");

    });

});
