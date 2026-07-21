-- Coupons are tenant-owned discount codes, redeemable at checkout. Kept
-- simple deliberately: a flat or percentage discount off the pre-tax
-- subtotal, with optional minimum-order and per-customer/total usage caps.
CREATE TABLE "Coupons" (
    "CouponId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "TenantId" INT NOT NULL,
    "Code" VARCHAR(30) NOT NULL,
    "DiscountType" VARCHAR(20) NOT NULL, -- 'Percentage' | 'Flat'
    "DiscountValue" NUMERIC(10, 2) NOT NULL,
    "MinOrderValue" NUMERIC(10, 2) NULL,
    "MaxDiscountAmount" NUMERIC(10, 2) NULL, -- caps a Percentage discount's rupee value
    "UsageLimitTotal" INT NULL, -- NULL = unlimited redemptions across all customers
    "UsageLimitPerCustomer" INT NULL, -- NULL = unlimited redemptions per customer
    "ValidFrom" TIMESTAMP NULL,
    "ValidUntil" TIMESTAMP NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("CouponId"),
    CONSTRAINT "UQ_Coupons_Tenant_Code" UNIQUE ("TenantId", "Code")
);

ALTER TABLE "Coupons" ADD CONSTRAINT "FK_Coupons_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");

CREATE TABLE "CouponRedemptions" (
    "RedemptionId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "CouponId" INT NOT NULL,
    "CustomerId" INT NOT NULL,
    "OrderId" INT NOT NULL,
    "DiscountAmount" NUMERIC(10, 2) NOT NULL,
    "RedeemedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("RedemptionId")
);

ALTER TABLE "CouponRedemptions" ADD CONSTRAINT "FK_Redemptions_Coupons" FOREIGN KEY ("CouponId") REFERENCES "Coupons"("CouponId");
ALTER TABLE "CouponRedemptions" ADD CONSTRAINT "FK_Redemptions_Customers" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("CustomerId");
ALTER TABLE "CouponRedemptions" ADD CONSTRAINT "FK_Redemptions_Orders" FOREIGN KEY ("OrderId") REFERENCES "Orders"("OrderId");

-- Discount is applied to the subtotal before GST, same as the reference
-- screenshots ("Total: X, Savings: Y" shown pre-tax) - GST is then computed
-- on the discounted subtotal, not the original one.
ALTER TABLE "Orders" ADD COLUMN "CouponId" INT NULL;
ALTER TABLE "Orders" ADD COLUMN "DiscountAmount" NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_Coupons" FOREIGN KEY ("CouponId") REFERENCES "Coupons"("CouponId");
