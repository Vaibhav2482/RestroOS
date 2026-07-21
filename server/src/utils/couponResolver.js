// Shared by the customer-facing "preview a coupon at checkout" endpoint and
// actual order creation - both need to turn a code into a validated
// discount amount, and order creation must re-validate fresh inside its own
// transaction rather than trust whatever the preview call said (the coupon
// could hit its usage limit between preview and place-order).
export const resolveCoupon = async (queryable, tenantId, code, customerId, subtotal) => {

    if (!code) {
        return { discountAmount: 0, couponId: null };
    }

    const couponResult = await queryable.query(
        `SELECT * FROM "Coupons" WHERE "TenantId" = $1 AND "Code" = $2 AND "IsActive" = TRUE`,
        [tenantId, code.trim().toUpperCase()]
    );

    const coupon = couponResult.rows[0];

    if (!coupon) {
        throw new Error("Invalid coupon code.");
    }

    const now = new Date();

    if (coupon.ValidFrom && now < new Date(coupon.ValidFrom)) {
        throw new Error("This coupon isn't active yet.");
    }

    if (coupon.ValidUntil && now > new Date(coupon.ValidUntil)) {
        throw new Error("This coupon has expired.");
    }

    if (coupon.MinOrderValue && subtotal < Number(coupon.MinOrderValue)) {
        throw new Error(`This coupon needs a minimum order of ₹${coupon.MinOrderValue}.`);
    }

    if (coupon.UsageLimitTotal !== null) {

        const totalUsed = await queryable.query(
            `SELECT COUNT(*) FROM "CouponRedemptions" WHERE "CouponId" = $1`,
            [coupon.CouponId]
        );

        if (Number(totalUsed.rows[0].count) >= coupon.UsageLimitTotal) {
            throw new Error("This coupon has reached its usage limit.");
        }

    }

    if (coupon.UsageLimitPerCustomer !== null) {

        const customerUsed = await queryable.query(
            `SELECT COUNT(*) FROM "CouponRedemptions" WHERE "CouponId" = $1 AND "CustomerId" = $2`,
            [coupon.CouponId, customerId]
        );

        if (Number(customerUsed.rows[0].count) >= coupon.UsageLimitPerCustomer) {
            throw new Error("You've already used this coupon.");
        }

    }

    let discountAmount = coupon.DiscountType === "Percentage"
        ? subtotal * (Number(coupon.DiscountValue) / 100)
        : Number(coupon.DiscountValue);

    if (coupon.MaxDiscountAmount !== null) {
        discountAmount = Math.min(discountAmount, Number(coupon.MaxDiscountAmount));
    }

    discountAmount = Math.min(discountAmount, subtotal);
    discountAmount = Math.round(discountAmount * 100) / 100;

    return { discountAmount, couponId: coupon.CouponId };

};
