import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import OrderDetailsDialog from "./OrderDetailsDialog";
import * as orderService from "../services/orderService";
import * as menuService from "../services/menuService";
import * as paymentService from "../services/paymentService";

vi.mock("../services/orderService");
vi.mock("../services/menuService");
vi.mock("../services/paymentService");

const BRANCH_ADMIN_AUTH = {
    token: "test-token",
    admin: { AdminId: 1, BranchId: 5, Email: "staff@test.com" }
};

const pendingOrder = {
    OrderId: 70,
    BranchId: 5,
    BranchName: "Main Branch",
    CustomerName: "New Guest",
    DeliveryType: "Dine In",
    PaymentMethod: "Cash",
    OrderDate: "2026-07-25T22:00:00",
    OrderStatus: "Pending",
    TotalAmount: 200,
    Items: [
        { OrderItemId: 1, MenuItemId: 11, ItemName: "Paneer Tikka", Price: 150, Quantity: 1, TotalPrice: 150, SelectedOptions: [] },
        { OrderItemId: 2, MenuItemId: 12, ItemName: "Butter Naan", Price: 50, Quantity: 1, TotalPrice: 50, SelectedOptions: [] }
    ]
};

const readyOrder = { ...pendingOrder, OrderStatus: "Ready", Items: pendingOrder.Items };

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(BRANCH_ADMIN_AUTH));

    menuService.getAllMenuItems.mockResolvedValue({
        success: true,
        data: [
            { MenuItemId: 11, ItemName: "Paneer Tikka", Price: 150, IsAvailable: true, IsActive: true, HasOptions: false },
            { MenuItemId: 12, ItemName: "Butter Naan", Price: 50, IsAvailable: true, IsActive: true, HasOptions: false },
            { MenuItemId: 13, ItemName: "Gulab Jamun", Price: 60, IsAvailable: true, IsActive: true, HasOptions: false }
        ]
    });

    paymentService.getPaymentByOrderId.mockResolvedValue({ success: true, data: [] });
    orderService.getOrderAdjustments.mockResolvedValue({ success: true, data: [] });

});

describe("OrderDetailsDialog - staff attribution", () => {

    it("shows who took the order when it was staff-placed", async () => {

        orderService.getOrderById.mockResolvedValue({
            success: true,
            data: { ...pendingOrder, CreatedByAdminName: "Priya Sharma" }
        });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        expect(screen.getByText("Taken By")).toBeInTheDocument();
        expect(screen.getByText("Priya Sharma")).toBeInTheDocument();

    });

    it("omits the field entirely for a customer's own online order", async () => {

        orderService.getOrderById.mockResolvedValue({ success: true, data: pendingOrder });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        expect(screen.queryByText("Taken By")).not.toBeInTheDocument();

    });

});

describe("OrderDetailsDialog - item editing", () => {

    it("only shows Edit Items for a Pending order", async () => {

        orderService.getOrderById.mockResolvedValue({ success: true, data: readyOrder });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        expect(screen.queryByRole("button", { name: /edit items/i })).not.toBeInTheDocument();

    });

    it("increments a line's quantity and saves the updated items", async () => {

        const user = userEvent.setup();

        orderService.getOrderById.mockResolvedValue({ success: true, data: pendingOrder });
        orderService.updateOrderItems.mockResolvedValue({ success: true, message: "Order items updated successfully.", data: pendingOrder });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        await user.click(screen.getByRole("button", { name: /edit items/i }));

        // Both quantities start at 1 - grab the increment (+) button on the
        // first row (Paneer Tikka) specifically, not the picker's controls.
        const incrementButtons = screen.getAllByTestId("AddRoundedIcon");
        await user.click(incrementButtons[0]);

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => expect(orderService.updateOrderItems).toHaveBeenCalledWith(70, [
            { menuItemId: 11, quantity: 2, selectedOptionIds: [] },
            { menuItemId: 12, quantity: 1, selectedOptionIds: [] }
        ]));

    });

    it("removes a line item before saving", async () => {

        const user = userEvent.setup();

        orderService.getOrderById.mockResolvedValue({ success: true, data: pendingOrder });
        orderService.updateOrderItems.mockResolvedValue({ success: true, message: "Order items updated successfully.", data: pendingOrder });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        await user.click(screen.getByRole("button", { name: /edit items/i }));

        const deleteButtons = screen.getAllByTestId("DeleteOutlineRoundedIcon");
        await user.click(deleteButtons[1]);

        expect(screen.queryByText("Butter Naan")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => expect(orderService.updateOrderItems).toHaveBeenCalledWith(70, [
            { menuItemId: 11, quantity: 1, selectedOptionIds: [] }
        ]));

    });

    it("adds a plain menu item to the order via the picker", async () => {

        const user = userEvent.setup();

        orderService.getOrderById.mockResolvedValue({ success: true, data: pendingOrder });
        orderService.updateOrderItems.mockResolvedValue({ success: true, message: "Order items updated successfully.", data: pendingOrder });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        await user.click(screen.getByRole("button", { name: /edit items/i }));

        const picker = await screen.findByLabelText(/add item to order/i);
        await user.type(picker, "Gulab");

        const option = await screen.findByText("Gulab Jamun");
        await user.click(option);

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => expect(orderService.updateOrderItems).toHaveBeenCalledWith(70, [
            { menuItemId: 11, quantity: 1, selectedOptionIds: [] },
            { menuItemId: 12, quantity: 1, selectedOptionIds: [] },
            { menuItemId: 13, quantity: 1, selectedOptionIds: [] }
        ]));

    });

});

describe("OrderDetailsDialog - void with reason", () => {

    it("keeps the cancel confirmation disabled until a reason is typed, then sends it", async () => {

        const user = userEvent.setup();

        orderService.getOrderById.mockResolvedValue({ success: true, data: readyOrder });
        orderService.cancelOrder.mockResolvedValue({ success: true, message: "Order cancelled successfully." });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        await user.click(screen.getByRole("button", { name: /cancel order/i }));

        const confirmButton = await screen.findByRole("button", { name: /^cancel order$/i });
        expect(confirmButton).toBeDisabled();

        await user.type(screen.getByLabelText(/reason/i), "Kitchen out of an ingredient");
        expect(confirmButton).toBeEnabled();

        await user.click(confirmButton);

        await waitFor(() => expect(orderService.cancelOrder).toHaveBeenCalledWith(70, "Kitchen out of an ingredient"));

    });

});

describe("OrderDetailsDialog - refund", () => {

    it("offers a Refund action pre-filled with the remaining balance when a payment exists", async () => {

        const user = userEvent.setup();

        orderService.getOrderById.mockResolvedValue({ success: true, data: readyOrder });
        paymentService.getPaymentByOrderId.mockResolvedValue({
            success: true,
            data: [{ PaymentId: 1, PaymentMethod: "Cash", Amount: 200, PaymentStatus: "Paid" }]
        });
        orderService.refundOrder.mockResolvedValue({ success: true, message: "₹200.00 recorded - hand the cash back to the customer." });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        const refundButton = await screen.findByRole("button", { name: /^refund$/i });
        await user.click(refundButton);

        expect(screen.getByLabelText(/amount/i)).toHaveValue(200);

        await user.type(screen.getByLabelText(/reason/i), "Order arrived cold");
        await user.click(screen.getByRole("button", { name: /^refund$/i }));

        await waitFor(() => expect(orderService.refundOrder).toHaveBeenCalledWith(70, 200, "Order arrived cold"));

    });

    it("does not offer a Refund action when nothing has been paid yet", async () => {

        orderService.getOrderById.mockResolvedValue({ success: true, data: readyOrder });
        paymentService.getPaymentByOrderId.mockResolvedValue({ success: true, data: [] });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        expect(screen.queryByRole("button", { name: /^refund$/i })).not.toBeInTheDocument();

    });

    it("shows prior void/refund history when present", async () => {

        orderService.getOrderById.mockResolvedValue({ success: true, data: readyOrder });
        orderService.getOrderAdjustments.mockResolvedValue({
            success: true,
            data: [{
                AdjustmentId: 1,
                AdjustmentType: "REFUND",
                Amount: 50,
                Reason: "Order arrived cold",
                ActorAdminName: "Priya Sharma",
                CreatedAt: "2026-07-25T22:10:00"
            }]
        });

        render(<OrderDetailsDialog open orderId={70} onClose={() => {}} />);

        await screen.findByText("Paneer Tikka");

        expect(await screen.findByText(/order arrived cold/i)).toBeInTheDocument();
        expect(screen.getByText(/priya sharma/i)).toBeInTheDocument();

    });

});
