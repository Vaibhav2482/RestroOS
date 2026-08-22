import { describe, it, expect } from "vitest";

import { buildKotTicket } from "./kotEscpos";

const baseOrder = {
    OrderId: 301,
    DeliveryType: "Dine In",
    TableNumber: "A3",
    OrderDate: "2026-08-22T15:30:00.000Z",
    Items: [
        { Quantity: 2, ItemName: "Tea", SelectedOptions: [] },
        { Quantity: 1, ItemName: "Butter Toast", SelectedOptions: [{ OptionName: "Extra Butter" }] }
    ]
};

describe("buildKotTicket", () => {

    it("leads with the table for a Dine In order", () => {

        const ticket = buildKotTicket({ order: baseOrder, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("TABLE A3");
        expect(ticket).toContain("Alpha Diner");

    });

    it("leads with the delivery type, not a table, for Takeaway", () => {

        const ticket = buildKotTicket({ order: { ...baseOrder, DeliveryType: "Takeaway", TableNumber: null }, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("TAKEAWAY");
        expect(ticket).not.toMatch(/TABLE (null|undefined)/);

    });

    it("lists every item with its quantity, and selected options indented under it", () => {

        const ticket = buildKotTicket({ order: baseOrder, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("2x  Tea");
        expect(ticket).toContain("1x  Butter Toast");
        expect(ticket).toContain("Extra Butter");

    });

    it("includes order notes when present, omits the section when absent", () => {

        const withNotes = buildKotTicket({ order: { ...baseOrder, OrderNotes: "No onions" }, restaurantName: "Alpha Diner" });
        const withoutNotes = buildKotTicket({ order: baseOrder, restaurantName: "Alpha Diner" });

        expect(withNotes).toContain("No onions");
        expect(withoutNotes).not.toContain("Note:");

    });

    it("uses the explicit kotNumber over the order's own Id when provided", () => {

        const ticket = buildKotTicket({ order: baseOrder, kotNumber: 999, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("KOT #999");
        expect(ticket).not.toContain("KOT #301");

    });

    it("falls back to the order Id when no kotNumber is given", () => {

        const ticket = buildKotTicket({ order: baseOrder, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("KOT #301");

    });

    it("shows the correct total item count, summed across quantities not line count", () => {

        const ticket = buildKotTicket({ order: baseOrder, restaurantName: "Alpha Diner" });

        // 2x Tea + 1x Butter Toast = 3 items across 2 lines.
        expect(ticket).toContain("3 items total");

    });

    it("ends with a cut command so the ticket doesn't need a manual tear", () => {

        const ticket = buildKotTicket({ order: baseOrder, restaurantName: "Alpha Diner" });

        expect(ticket.endsWith("\x1DV\x01")).toBe(true);

    });

});
