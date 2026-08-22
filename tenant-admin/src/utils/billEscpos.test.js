import { describe, it, expect } from "vitest";

import { buildBillTicket } from "./billEscpos";

const baseVisit = {
    VisitId: 5,
    TableNumber: "A3",
    OpenedAt: "2026-08-22T15:00:00.000Z",
    ClosedAt: "2026-08-22T16:30:00.000Z",
    PaymentMethod: "Cash",
    OrderCount: 2,
    SubTotal: 398,
    CgstAmount: 9.94,
    SgstAmount: 9.96,
    DiscountAmount: 0,
    TotalAmount: 417.9,
    Items: [
        { MenuItemId: 1, ItemName: "Alpha Special Soup", Quantity: 2, TotalPrice: 398 }
    ]
};

describe("buildBillTicket", () => {

    it("includes the table number, restaurant name, and every consolidated item", () => {

        const ticket = buildBillTicket({ visit: baseVisit, restaurantName: "Alpha Diner", branchName: "Main Branch" });

        expect(ticket).toContain("TABLE A3");
        expect(ticket).toContain("Alpha Diner");
        expect(ticket).toContain("Main Branch");
        expect(ticket).toContain("Alpha Special Soup");

    });

    it("uses Rs. for money, never the Rupee glyph (codepage support varies across generic printers)", () => {

        const ticket = buildBillTicket({ visit: baseVisit, restaurantName: "Alpha Diner" });

        expect(ticket).not.toContain("₹");
        expect(ticket).toContain("Rs.");

    });

    it("shows the payment method and how many orders the visit consolidated", () => {

        const ticket = buildBillTicket({ visit: baseVisit, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("Paid via: Cash");
        expect(ticket).toContain("Orders on this visit: 2");

    });

    it("omits the discount line entirely when there is no discount", () => {

        const ticket = buildBillTicket({ visit: baseVisit, restaurantName: "Alpha Diner" });

        expect(ticket).not.toContain("Discount");

    });

    it("includes the discount line when a discount was applied", () => {

        const ticket = buildBillTicket({ visit: { ...baseVisit, DiscountAmount: 20 }, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("Discount");
        expect(ticket).toContain("-Rs. 20.00");

    });

    it("prints the true consolidated total, not any single order's own total", () => {

        const ticket = buildBillTicket({ visit: baseVisit, restaurantName: "Alpha Diner" });

        expect(ticket).toContain("417.90");

    });

});
