import pool from "../config/db.js";

export const getAllByTenant = async (tenantId) => {

    const result = await pool.query(
        `SELECT * FROM "Coupons" WHERE "TenantId" = $1 ORDER BY "CreatedAt" DESC`,
        [tenantId]
    );

    return result.rows;

};

export const getById = async (couponId) => {

    const result = await pool.query(`SELECT * FROM "Coupons" WHERE "CouponId" = $1`, [couponId]);

    return result.rows[0];

};

export const getByTenantAndCode = async (tenantId, code) => {

    const result = await pool.query(
        `SELECT "CouponId" FROM "Coupons" WHERE "TenantId" = $1 AND "Code" = $2`,
        [tenantId, code]
    );

    return result.rows[0];

};

export const create = async (coupon) => {

    const result = await pool.query(
        `INSERT INTO "Coupons"
            ("TenantId", "Code", "DiscountType", "DiscountValue", "MinOrderValue", "MaxDiscountAmount",
             "UsageLimitTotal", "UsageLimitPerCustomer", "ValidFrom", "ValidUntil")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
            coupon.tenantId,
            coupon.code,
            coupon.discountType,
            coupon.discountValue,
            coupon.minOrderValue ?? null,
            coupon.maxDiscountAmount ?? null,
            coupon.usageLimitTotal ?? null,
            coupon.usageLimitPerCustomer ?? null,
            coupon.validFrom ?? null,
            coupon.validUntil ?? null
        ]
    );

    return result.rows[0];

};

// tenantId redundant with the service-layer check that already ran -
// defense-in-depth so a repository write fails closed on its own WHERE
// clause rather than relying solely on every call site checking first.
export const update = async (coupon, tenantId) => {

    const result = await pool.query(
        `UPDATE "Coupons"
         SET "DiscountType" = $1, "DiscountValue" = $2, "MinOrderValue" = $3, "MaxDiscountAmount" = $4,
             "UsageLimitTotal" = $5, "UsageLimitPerCustomer" = $6, "ValidFrom" = $7, "ValidUntil" = $8,
             "IsActive" = $9, "UpdatedAt" = NOW()
         WHERE "CouponId" = $10 AND "TenantId" = $11
         RETURNING *`,
        [
            coupon.discountType,
            coupon.discountValue,
            coupon.minOrderValue ?? null,
            coupon.maxDiscountAmount ?? null,
            coupon.usageLimitTotal ?? null,
            coupon.usageLimitPerCustomer ?? null,
            coupon.validFrom ?? null,
            coupon.validUntil ?? null,
            coupon.isActive ?? true,
            coupon.couponId,
            tenantId
        ]
    );

    return result.rows[0];

};

export const deactivate = async (couponId, tenantId) => {
    await pool.query(`UPDATE "Coupons" SET "IsActive" = FALSE, "UpdatedAt" = NOW() WHERE "CouponId" = $1 AND "TenantId" = $2`, [couponId, tenantId]);
};

export const recordRedemption = async (queryable, couponId, customerId, orderId, discountAmount) => {

    await queryable.query(
        `INSERT INTO "CouponRedemptions" ("CouponId", "CustomerId", "OrderId", "DiscountAmount")
         VALUES ($1, $2, $3, $4)`,
        [couponId, customerId, orderId, discountAmount]
    );

};
