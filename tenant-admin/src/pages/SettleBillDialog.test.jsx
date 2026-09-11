import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import SettleBillDialog from "./SettleBillDialog";
import * as tableVisitService from "../services/tableVisitService";

vi.mock("../services/tableVisitService");

const TABLE = { TableId: 1, TableName: "A3" };

const OPEN_VISIT_HEADER = { VisitId: 5, TableNumber: "A3", Status: "Open" };

const VISIT_DETAILS = {
    VisitId: 5,
    TableNumber: "A3",
    Status: "Open",
    OrderCount: 1,
    SubTotal: 190,
    CgstAmount: 5,
    SgstAmount: 5,
    DiscountAmount: 0,
    TotalAmount: 200,
    AmountDue: 200,
    Items: [{ MenuItemId: 1, FirstOrderItemId: 1, ItemName: "Thali", Quantity: 1, TotalPrice: 200 }],
    Orders: [{ OrderId: 301, OrderStatus: "Served", OrderDate: "2026-01-01T10:00:00Z" }]
};

const BRANCH_ADMIN_WITH_DISCOUNT = {
    token: "t", admin: { AdminId: 1, BranchId: 5, Permissions: ["manage_orders", "apply_discounts"] }
};

const BRANCH_ADMIN_WITHOUT_DISCOUNT = {
    token: "t", admin: { AdminId: 1, BranchId: 5, Permissions: ["manage_orders"] }
};

const renderDialog = (onSettled = vi.fn()) => render(
    <SettleBillDialog open branchId={5} table={TABLE} onClose={vi.fn()} onSettled={onSettled} />
);

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.clear();

    tableVisitService.getOpenVisitForTable.mockResolvedValue({ success: true, data: OPEN_VISIT_HEADER });
    tableVisitService.getVisitDetails.mockResolvedValue({ success: true, data: VISIT_DETAILS });

});

describe("SettleBillDialog - bill discount visibility", () => {

    it("hides the discount fields for an admin without apply_discounts", async () => {

        localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_WITHOUT_DISCOUNT));

        renderDialog();

        await screen.findByText(/Total: /);

        expect(screen.queryByText("Bill Discount (optional)")).not.toBeInTheDocument();

    });

    it("shows the discount fields for an admin granted apply_discounts", async () => {

        localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_WITH_DISCOUNT));

        renderDialog();

        expect(await screen.findByText("Bill Discount (optional)")).toBeInTheDocument();

    });

});

describe("SettleBillDialog - applying a bill discount", () => {

    beforeEach(() => {
        localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_WITH_DISCOUNT));
    });

    it("blocks settling with an amount but no reason", async () => {

        const user = userEvent.setup();
        renderDialog();

        await screen.findByText("Bill Discount (optional)");

        await user.type(screen.getByLabelText("Amount"), "50");
        await user.click(screen.getByRole("button", { name: /pay & close table/i }));

        expect(tableVisitService.settleVisit).not.toHaveBeenCalled();

    });

    it("shows the live Amount Due once a discount is entered", async () => {

        const user = userEvent.setup();
        renderDialog();

        await screen.findByText("Bill Discount (optional)");

        await user.type(screen.getByLabelText("Amount"), "50");

        expect(await screen.findByText(/Amount Due: ₹150\.00/)).toBeInTheDocument();

    });

    it("settles with the discount amount and reason once both are filled in", async () => {

        tableVisitService.settleVisit.mockResolvedValue({ success: true, data: { ...VISIT_DETAILS, Status: "Closed" } });

        const onSettled = vi.fn();
        const user = userEvent.setup();
        renderDialog(onSettled);

        await screen.findByText("Bill Discount (optional)");

        await user.type(screen.getByLabelText("Amount"), "50");
        await user.type(screen.getByLabelText("Reason"), "Service delay");
        await user.click(screen.getByRole("button", { name: /pay & close table/i }));

        await waitFor(() => expect(tableVisitService.settleVisit).toHaveBeenCalledWith(5, {
            paymentMethod: "Cash", discountAmount: 50, discountReason: "Service delay", splits: undefined
        }));
        expect(onSettled).toHaveBeenCalled();

    });

    it("settles with zero discount when the fields are left blank", async () => {

        tableVisitService.settleVisit.mockResolvedValue({ success: true, data: { ...VISIT_DETAILS, Status: "Closed" } });

        const user = userEvent.setup();
        renderDialog();

        await screen.findByText("Bill Discount (optional)");
        await user.click(screen.getByRole("button", { name: /pay & close table/i }));

        await waitFor(() => expect(tableVisitService.settleVisit).toHaveBeenCalledWith(5, {
            paymentMethod: "Cash", discountAmount: 0, discountReason: undefined, splits: undefined
        }));

    });

});

describe("SettleBillDialog - split bill", () => {

    beforeEach(() => {
        localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_WITHOUT_DISCOUNT));
    });

    it("starts with two even shares once Split Bill is turned on", async () => {

        const user = userEvent.setup();
        renderDialog();

        await screen.findByText("Total: ₹200.00");
        await user.click(screen.getByRole("button", { name: "Split Bill" }));

        expect(screen.getByLabelText("Split 1")).toHaveValue(100);
        expect(screen.getByLabelText("Split 2")).toHaveValue(100);
        expect(screen.getByText("Splits match the amount due.")).toBeInTheDocument();

    });

    it("blocks settling while the splits don't add up to the amount due", async () => {

        const user = userEvent.setup();
        renderDialog();

        await screen.findByText("Total: ₹200.00");
        await user.click(screen.getByRole("button", { name: "Split Bill" }));

        const split1 = screen.getByLabelText("Split 1");
        await user.clear(split1);
        await user.type(split1, "50");

        expect(await screen.findByText(/Remaining: ₹50\.00/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /pay & close table/i })).toBeDisabled();

    });

    it("settles with a splits array once the shares add up", async () => {

        tableVisitService.settleVisit.mockResolvedValue({ success: true, data: { ...VISIT_DETAILS, Status: "Closed" } });

        const user = userEvent.setup();
        renderDialog();

        await screen.findByText("Total: ₹200.00");
        await user.click(screen.getByRole("button", { name: "Split Bill" }));

        // Second split defaults to Card/UPI selection stays Cash - change it
        // so the two rows aren't identical, closer to a real 2-way split.
        const selects = screen.getAllByRole("combobox");
        await user.click(selects[1]);
        await user.click(await screen.findByRole("option", { name: "Card" }));

        await user.click(screen.getByRole("button", { name: /pay & close table/i }));

        await waitFor(() => expect(tableVisitService.settleVisit).toHaveBeenCalledWith(5, expect.objectContaining({
            paymentMethod: undefined,
            splits: [{ amount: 100, paymentMethod: "Cash" }, { amount: 100, paymentMethod: "Card" }]
        })));

    });

    it("turning Split Bill back off restores the normal payment method selector", async () => {

        const user = userEvent.setup();
        renderDialog();

        await screen.findByText("Total: ₹200.00");
        await user.click(screen.getByRole("button", { name: "Split Bill" }));
        expect(screen.getByLabelText("Split 1")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Cancel Split" }));

        expect(screen.queryByLabelText("Split 1")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cash" })).toBeInTheDocument();

    });

});
