import * as CartService from "../services/CartService.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

const canActOnCustomer = async (req, customerId) => {

    if (String(req.user.id) === String(customerId) && req.user.role === "customer") {
        return true;
    }

    if (req.user.role !== "admin") {
        return false;
    }

    const customer = await CustomerRepository.getCustomerById(customerId);

    return Boolean(customer && customer.TenantId === req.user.tenantId);

};

export const addToCart = asyncHandler(async (req, res) => {

    if (!(await canActOnCustomer(req, req.body.customerId))) {
        return errorResponse(res, "You are not authorized to modify this cart.", 403);
    }

    const result = await CartService.addToCart(req.body);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message, 201);

});

export const getCart = asyncHandler(async (req, res) => {

    const { customerId } = req.params;

    if (!(await canActOnCustomer(req, customerId))) {
        return errorResponse(res, "You are not authorized to view this cart.", 403);
    }

    const result = await CartService.getCart(customerId);

    return successResponse(res, result.data, result.message);

});

export const updateCartQuantity = asyncHandler(async (req, res) => {

    const { cartId } = req.params;
    const { quantity } = req.body;

    const cartItem = await CartService.getCartItemById(cartId);

    if (!cartItem) {
        return errorResponse(res, "Cart item not found.", 404);
    }

    if (!(await canActOnCustomer(req, cartItem.CustomerId))) {
        return errorResponse(res, "You are not authorized to modify this cart.", 403);
    }

    const result = await CartService.updateCartQuantity(cartId, quantity);

    if (!result.success) {
        return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result.data, result.message);

});

export const removeCartItem = asyncHandler(async (req, res) => {

    const { cartId } = req.params;

    const cartItem = await CartService.getCartItemById(cartId);

    if (!cartItem) {
        return errorResponse(res, "Cart item not found.", 404);
    }

    if (!(await canActOnCustomer(req, cartItem.CustomerId))) {
        return errorResponse(res, "You are not authorized to modify this cart.", 403);
    }

    const result = await CartService.removeCartItem(cartId);

    return successResponse(res, result.data, result.message);

});

export const clearCart = asyncHandler(async (req, res) => {

    const { customerId } = req.params;

    if (!(await canActOnCustomer(req, customerId))) {
        return errorResponse(res, "You are not authorized to modify this cart.", 403);
    }

    const result = await CartService.clearCart(customerId);

    return successResponse(res, result.data, result.message);

});
