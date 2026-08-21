import pool from "../config/db.js";
import * as CouponRepository from "../repositories/CouponRepository.js";
import { resolveCoupon } from "../utils/couponResolver.js";
import * as AuditService from "./AuditService.js";

const VALID_DISCOUNT_TYPES = ["Percentage", "Flat"];

export const getAllCoupons = async (tenantId) => {

    const coupons = await CouponRepository.getAllByTenant(tenantId);

    return { success: true, message: "Coupons fetched successfully.", data: coupons };

};

export const createCoupon = async (coupon, tenantId, actorAdminId) => {

    const code = coupon.code?.trim().toUpperCase();

    if (!code) {
        return { success: false, message: "Coupon code is required." };
    }

    if (!VALID_DISCOUNT_TYPES.includes(coupon.discountType)) {
        return { success: false, message: "Discount type must be Percentage or Flat." };
    }

    if (!coupon.discountValue || coupon.discountValue <= 0) {
        return { success: false, message: "Discount value must be greater than 0." };
    }

    if (coupon.discountType === "Percentage" && coupon.discountValue > 100) {
        return { success: false, message: "A percentage discount can't exceed 100." };
    }

    const existing = await CouponRepository.getByTenantAndCode(tenantId, code);

    if (existing) {
        return { success: false, message: "A coupon with this code already exists." };
    }

    const created = await CouponRepository.create({ ...coupon, code, tenantId });

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "COUPON_CREATED",
        entityType: "Coupon",
        entityId: created.CouponId,
        summary: `Created coupon "${created.Code}" (${created.DiscountType === "Percentage" ? `${created.DiscountValue}% off` : `₹${created.DiscountValue} off`})`
    });

    return { success: true, message: "Coupon created successfully.", data: created };

};

export const updateCoupon = async (couponId, coupon, tenantId, actorAdminId) => {

    const existing = await CouponRepository.getById(couponId);

    if (!existing || existing.TenantId !== tenantId) {
        return { success: false, message: "Coupon not found." };
    }

    if (!VALID_DISCOUNT_TYPES.includes(coupon.discountType)) {
        return { success: false, message: "Discount type must be Percentage or Flat." };
    }

    if (!coupon.discountValue || coupon.discountValue <= 0) {
        return { success: false, message: "Discount value must be greater than 0." };
    }

    if (coupon.discountType === "Percentage" && coupon.discountValue > 100) {
        return { success: false, message: "A percentage discount can't exceed 100." };
    }

    const updated = await CouponRepository.update({ ...coupon, couponId: Number(couponId) }, tenantId);

    const changeNotes = [];

    if (Number(existing.DiscountValue) !== Number(updated.DiscountValue) || existing.DiscountType !== updated.DiscountType) {
        const oldValue = existing.DiscountType === "Percentage" ? `${existing.DiscountValue}%` : `₹${existing.DiscountValue}`;
        const newValue = updated.DiscountType === "Percentage" ? `${updated.DiscountValue}%` : `₹${updated.DiscountValue}`;
        changeNotes.push(`discount changed from ${oldValue} to ${newValue}`);
    }

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "COUPON_UPDATED",
        entityType: "Coupon",
        entityId: updated.CouponId,
        summary: `Updated coupon "${updated.Code}"${changeNotes.length ? ` (${changeNotes.join(", ")})` : ""}`
    });

    return { success: true, message: "Coupon updated successfully.", data: updated };

};

export const deactivateCoupon = async (couponId, tenantId, actorAdminId) => {

    const existing = await CouponRepository.getById(couponId);

    if (!existing || existing.TenantId !== tenantId) {
        return { success: false, message: "Coupon not found." };
    }

    await CouponRepository.deactivate(couponId, tenantId);

    AuditService.record({
        tenantId,
        actorAdminId,
        action: "COUPON_DEACTIVATED",
        entityType: "Coupon",
        entityId: Number(couponId),
        summary: `Deactivated coupon "${existing.Code}"`
    });

    return { success: true, message: "Coupon deactivated successfully." };

};

// Customer-facing preview at checkout - re-validated fresh (never trusted)
// the moment an order is actually placed.
export const previewCoupon = async (tenantId, code, customerId, subtotal) => {

    try {

        const { discountAmount, couponId } = await resolveCoupon(pool, tenantId, code, customerId, subtotal);

        return { success: true, message: "Coupon applied.", data: { discountAmount, couponId } };

    } catch (error) {

        return { success: false, message: error.message };

    }

};
