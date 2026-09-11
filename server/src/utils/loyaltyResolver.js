// Shared by order creation (redemption) and OrderService's status-update
// hook (earning) - kept as plain constants rather than a per-tenant setting
// for this first version, same way the tax/GST defaults elsewhere in this
// app started as constants before ever needing to be configurable.
export const LOYALTY_EARN_RATE_PER_100 = 5; // points earned per ₹100 actually paid
export const LOYALTY_POINT_VALUE = 1; // ₹ knocked off per point redeemed

export const pointsEarnedFor = (amountPaid) => Math.max(0, Math.floor((Number(amountPaid) || 0) / 100 * LOYALTY_EARN_RATE_PER_100));

// Validated fresh inside order creation's own transaction, same reasoning
// as couponResolver.resolveCoupon - a balance checked before the
// transaction opened could be stale by the time this actually runs (two
// tabs open, or points already spent on another order placed a moment
// earlier). `client` must support FOR UPDATE (a transaction client, not
// the bare pool) so this locks the customer's balance against a
// concurrent redemption.
export const resolvePointsRedemption = async (client, tenantId, customerId, requestedPoints, subtotalAfterCoupon) => {

    const points = Math.floor(Number(requestedPoints) || 0);

    if (points <= 0) {
        return { discountAmount: 0, pointsUsed: 0 };
    }

    const tenantResult = await client.query(
        `SELECT "DisabledFeatures", "PlatformRestrictedFeatures" FROM "Tenants" WHERE "TenantId" = $1`,
        [tenantId]
    );

    const tenant = tenantResult.rows[0];
    const disabled = [...(tenant?.DisabledFeatures || []), ...(tenant?.PlatformRestrictedFeatures || [])];

    // Silently resolves to "no discount" rather than throwing - a
    // storefront tab left open from before an Owner (or a platform admin)
    // turned the feature off shouldn't hard-fail someone's checkout over a
    // field they can no longer even see the point of.
    if (disabled.includes("loyalty_points")) {
        return { discountAmount: 0, pointsUsed: 0 };
    }

    const balanceResult = await client.query(
        `SELECT "LoyaltyPoints" FROM "Customers" WHERE "CustomerId" = $1 FOR UPDATE`,
        [customerId]
    );

    const balance = balanceResult.rows[0]?.LoyaltyPoints ?? 0;

    if (points > balance) {
        throw new Error(`You only have ${balance} loyalty point${balance === 1 ? "" : "s"}.`);
    }

    // Using fewer points than asked for (because the order doesn't need
    // that many) is a silent, harmless adjustment - unlike asking to spend
    // more than the balance holds, there's nothing wrong for the customer
    // to be told about here.
    const maxAffordablePoints = Math.floor(subtotalAfterCoupon / LOYALTY_POINT_VALUE);
    const pointsUsed = Math.min(points, maxAffordablePoints);
    const discountAmount = Math.round(pointsUsed * LOYALTY_POINT_VALUE * 100) / 100;

    return { discountAmount, pointsUsed };

};
