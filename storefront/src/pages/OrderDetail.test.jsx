import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import OrderDetail from "./OrderDetail";
import * as orderService from "../services/orderService";
import { useStorefront } from "../context/StorefrontContext";

vi.mock("../services/orderService");
vi.mock("../context/StorefrontContext");

const ORDER = {
    OrderId: 42,
    OrderStatus: "Pending",
    DeliveryType: "Delivery",
    PaymentMethod: "Cash",
    TableNumber: null,
    OrderDate: "2026-07-25T10:00:00Z",
    SubTotal: 200,
    CgstAmount: 5,
    SgstAmount: 5,
    TotalAmount: 210,
    OrderNotes: null,
    BranchName: "Kondapur",
    BranchAddress: "123 Main Road",
    BranchCity: "Hyderabad",
    BranchPincode: "500084",
    BranchPhone: "9999999999",
    Items: [{ OrderItemId: 1, ItemName: "Veg Burger", Quantity: 1, Price: 200, TotalPrice: 200, SelectedOptions: [] }]
};

const renderOrderDetail = () => render(
    <MemoryRouter initialEntries={["/ccc/orders/42"]}>
        <Routes>
            <Route path="/:tenantSlug/orders/:orderId" element={<OrderDetail />} />
        </Routes>
    </MemoryRouter>
);

beforeEach(() => {

    vi.clearAllMocks();

    useStorefront.mockReturnValue({ tenantSlug: "ccc", tenant: { TenantName: "Chai Chakana" }, customer: { CustomerId: 1 } });
    orderService.getOrderById.mockResolvedValue({ success: true, data: ORDER });

});

describe("OrderDetail - cancel double-submit guard", () => {

    it("disables both confirm-dialog buttons while a cancel request is in flight", async () => {

        const user = userEvent.setup();

        // A promise that never resolves during the test - keeps the
        // component in its "cancelling" state so the disabled attribute
        // can actually be observed, the same way the other in-flight-guard
        // regression tests in this codebase hold a request open.
        orderService.cancelOrder.mockReturnValue(new Promise(() => {}));

        renderOrderDetail();

        await user.click(await screen.findByRole("button", { name: /^cancel order$/i }));
        await user.click(await screen.findByRole("button", { name: /^yes, cancel$/i }));

        expect(await screen.findByRole("button", { name: /cancelling/i })).toBeDisabled();
        expect(screen.getByRole("button", { name: /keep order/i })).toBeDisabled();

    });

    it("rejects a second click on the confirm button once it's disabled - userEvent enforces the same disabled-element rule a real browser does", async () => {

        const user = userEvent.setup();

        orderService.cancelOrder.mockReturnValue(new Promise(() => {}));

        renderOrderDetail();

        await user.click(await screen.findByRole("button", { name: /^cancel order$/i }));

        const confirmButton = await screen.findByRole("button", { name: /^yes, cancel$/i });

        await user.click(confirmButton);

        expect(orderService.cancelOrder).toHaveBeenCalledTimes(1);

        // Confirms the button that would need a second click is the exact
        // one now disabled - a second real click physically can't land.
        await expect(user.click(await screen.findByRole("button", { name: /cancelling/i }))).rejects.toThrow(/pointer-events/i);
        expect(orderService.cancelOrder).toHaveBeenCalledTimes(1);

    });

});

describe("OrderDetail - progress stepper", () => {

    it("marks the final step complete once the order reaches it, rather than leaving it as the active step", async () => {

        // MUI ticks steps *before* activeStep and renders activeStep itself
        // as its number, so a Delivered order used to show a bare "6"
        // against "Delivered" - reading as though the last stage still
        // hadn't happened on an order that was already complete.
        orderService.getOrderById.mockResolvedValue({
            success: true,
            data: { ...ORDER, OrderStatus: "Delivered" }
        });

        renderOrderDetail();

        const deliveredLabel = await screen.findByText("Delivered");
        const step = deliveredLabel.closest(".MuiStep-root");

        expect(step.querySelector(".MuiStepIcon-root.Mui-completed")).not.toBeNull();
        expect(step.textContent).not.toContain("6");

    });

});
