import { describe, it, expect, vi, beforeEach } from "vitest";

import { addToCart, getCart, updateCartQuantity, removeCartItem, clearCart } from "./CartController.js";
import * as CartService from "../services/CartService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

vi.mock("../services/CartService.js");
vi.mock("../repositories/CustomerRepository.js");

const buildRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

const OWN_CUSTOMER_ID = 42;
const OTHER_TENANT_CUSTOMER_ID = 99;

beforeEach(() => {

    vi.clearAllMocks();

    CartService.addToCart.mockResolvedValue({ success: true, message: "Item added to cart successfully.", data: { CartId: 1 } });
    CartService.getCart.mockResolvedValue({ success: true, message: "Cart fetched successfully.", data: [] });
    CartService.updateCartQuantity.mockResolvedValue({ success: true, message: "Cart updated successfully.", data: { CartId: 1, Quantity: 3 } });
    CartService.removeCartItem.mockResolvedValue({ success: true, message: "Cart item removed successfully.", data: {} });
    CartService.clearCart.mockResolvedValue({ success: true, message: "Cart cleared successfully.", data: {} });

    // canActOnCustomer's admin branch: a customer belonging to the caller's
    // own tenant (3) unless a test overrides this.
    CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: OWN_CUSTOMER_ID, TenantId: 3 });

});

describe("CartController.addToCart", () => {

    it("allows a customer adding to their own cart", async () => {

        const req = { body: { customerId: OWN_CUSTOMER_ID, menuItemId: 5, quantity: 1 }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        addToCart(req, res, vi.fn());

        await vi.waitFor(() => expect(CartService.addToCart).toHaveBeenCalled());

    });

    it("rejects a customer adding to a different customer's cart, before the service is ever called", async () => {

        const req = { body: { customerId: OTHER_TENANT_CUSTOMER_ID, menuItemId: 5, quantity: 1 }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        addToCart(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CartService.addToCart).not.toHaveBeenCalled();

    });

    it("allows an admin adding on behalf of a customer in their own tenant", async () => {

        const req = { body: { customerId: OWN_CUSTOMER_ID, menuItemId: 5, quantity: 1 }, user: { id: 7, role: "admin", tenantId: 3 } };
        const res = buildRes();

        addToCart(req, res, vi.fn());

        await vi.waitFor(() => expect(CartService.addToCart).toHaveBeenCalled());

    });

    it("rejects an admin adding on behalf of a customer in another tenant", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: OTHER_TENANT_CUSTOMER_ID, TenantId: 999 });

        const req = { body: { customerId: OTHER_TENANT_CUSTOMER_ID, menuItemId: 5, quantity: 1 }, user: { id: 7, role: "admin", tenantId: 3 } };
        const res = buildRes();

        addToCart(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CartService.addToCart).not.toHaveBeenCalled();

    });

});

describe("CartController.getCart", () => {

    it("allows a customer viewing their own cart", async () => {

        const req = { params: { customerId: String(OWN_CUSTOMER_ID) }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        getCart(req, res, vi.fn());

        await vi.waitFor(() => expect(CartService.getCart).toHaveBeenCalledWith(String(OWN_CUSTOMER_ID)));

    });

    it("rejects a customer viewing a different customer's cart", async () => {

        const req = { params: { customerId: String(OTHER_TENANT_CUSTOMER_ID) }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        getCart(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CartService.getCart).not.toHaveBeenCalled();

    });

});

describe("CartController.updateCartQuantity / removeCartItem - ownership resolved via the cart item itself", () => {

    it("allows updating a cart item that belongs to the caller", async () => {

        CartService.getCartItemById.mockResolvedValue({ CartId: 1, CustomerId: OWN_CUSTOMER_ID });

        const req = { params: { cartId: 1 }, body: { quantity: 2 }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        updateCartQuantity(req, res, vi.fn());

        await vi.waitFor(() => expect(CartService.updateCartQuantity).toHaveBeenCalledWith(1, 2));

    });

    it("rejects updating a cart item that belongs to a different customer", async () => {

        CartService.getCartItemById.mockResolvedValue({ CartId: 1, CustomerId: OTHER_TENANT_CUSTOMER_ID });

        const req = { params: { cartId: 1 }, body: { quantity: 2 }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        updateCartQuantity(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CartService.updateCartQuantity).not.toHaveBeenCalled();

    });

    it("returns 404 without calling the service when the cart item doesn't exist", async () => {

        CartService.getCartItemById.mockResolvedValue(undefined);

        const req = { params: { cartId: 999 }, body: { quantity: 2 }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        updateCartQuantity(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));
        expect(CartService.updateCartQuantity).not.toHaveBeenCalled();

    });

    it("allows removing a cart item that belongs to the caller", async () => {

        CartService.getCartItemById.mockResolvedValue({ CartId: 1, CustomerId: OWN_CUSTOMER_ID });

        const req = { params: { cartId: 1 }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        removeCartItem(req, res, vi.fn());

        await vi.waitFor(() => expect(CartService.removeCartItem).toHaveBeenCalledWith(1));

    });

    it("rejects removing a cart item that belongs to a different customer", async () => {

        CartService.getCartItemById.mockResolvedValue({ CartId: 1, CustomerId: OTHER_TENANT_CUSTOMER_ID });

        const req = { params: { cartId: 1 }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        removeCartItem(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CartService.removeCartItem).not.toHaveBeenCalled();

    });

});

describe("CartController.clearCart", () => {

    it("allows a customer clearing their own cart", async () => {

        const req = { params: { customerId: String(OWN_CUSTOMER_ID) }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        clearCart(req, res, vi.fn());

        await vi.waitFor(() => expect(CartService.clearCart).toHaveBeenCalledWith(String(OWN_CUSTOMER_ID)));

    });

    it("rejects clearing a different customer's cart", async () => {

        const req = { params: { customerId: String(OTHER_TENANT_CUSTOMER_ID) }, user: { id: OWN_CUSTOMER_ID, role: "customer" } };
        const res = buildRes();

        clearCart(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CartService.clearCart).not.toHaveBeenCalled();

    });

    it("rejects a non-admin, non-owning role entirely", async () => {

        const req = { params: { customerId: String(OWN_CUSTOMER_ID) }, user: { id: 7, role: "kitchen-display" } };
        const res = buildRes();

        clearCart(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CartService.clearCart).not.toHaveBeenCalled();

    });

});
