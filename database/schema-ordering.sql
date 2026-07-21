-- RestroOS Phase 2b: the ordering flow (Customers, Cart, Orders, Payments).
-- Ported from ChaiChakhna's Postgres schema with Customers gaining TenantId
-- (same convention as Admins: email/phone unique per-tenant, not platform-
-- wide - a customer signing up at Alpha Diner is a separate account from
-- the same email signing up at Beta Bistro). Everything below Customers
-- (CustomerAddresses, Cart, Orders, OrderItems, Payments) stays scoped via
-- CustomerId/BranchId exactly as in ChaiChakhna - their tenant is implied.

CREATE TABLE "Customers" (
    "CustomerId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "TenantId" INT NOT NULL,
    "FullName" VARCHAR(100) NOT NULL,
    "Email" VARCHAR(150) NOT NULL,
    "Phone" VARCHAR(15) NOT NULL,
    "Password" VARCHAR(255) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("CustomerId"),
    CONSTRAINT "UQ_Customers_Tenant_Email" UNIQUE ("TenantId", "Email")
);

ALTER TABLE "Customers" ADD CONSTRAINT "FK_Customers_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");

CREATE TABLE "CustomerAddresses" (
    "AddressId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "CustomerId" INT NOT NULL,
    "AddressTitle" VARCHAR(50) NOT NULL,
    "FullAddress" VARCHAR(500) NOT NULL,
    "City" VARCHAR(100) NOT NULL,
    "State" VARCHAR(100) NOT NULL,
    "Pincode" VARCHAR(10) NOT NULL,
    "Landmark" VARCHAR(150) NULL,
    "IsDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("AddressId")
);

ALTER TABLE "CustomerAddresses" ADD CONSTRAINT "FK_CustomerAddresses_Customers" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("CustomerId");

CREATE TABLE "Cart" (
    "CartId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "CustomerId" INT NOT NULL,
    "MenuItemId" INT NOT NULL,
    "Quantity" INT NOT NULL DEFAULT 1,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("CartId")
);

ALTER TABLE "Cart" ADD CONSTRAINT "FK_Cart_Customers" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("CustomerId");
ALTER TABLE "Cart" ADD CONSTRAINT "FK_Cart_MenuItems" FOREIGN KEY ("MenuItemId") REFERENCES "MenuItems"("MenuItemId");

CREATE TABLE "Orders" (
    "OrderId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "BranchId" INT NOT NULL,
    "CustomerId" INT NOT NULL,
    "AddressId" INT NULL,
    "DeliveryType" VARCHAR(20) NOT NULL,
    "PaymentMethod" VARCHAR(20) NOT NULL,
    "SubTotal" NUMERIC(10, 2) NULL,
    "CgstAmount" NUMERIC(10, 2) NULL,
    "SgstAmount" NUMERIC(10, 2) NULL,
    "TotalAmount" NUMERIC(10, 2) NOT NULL,
    "OrderStatus" VARCHAR(30) NOT NULL DEFAULT 'Pending',
    "OrderNotes" VARCHAR(500) NULL,
    "OrderDate" TIMESTAMP NOT NULL DEFAULT NOW(),
    "TableNumber" VARCHAR(20) NULL,
    PRIMARY KEY ("OrderId")
);

ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_Customers" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("CustomerId");
ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");
ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_CustomerAddresses" FOREIGN KEY ("AddressId") REFERENCES "CustomerAddresses"("AddressId");

CREATE TABLE "OrderItems" (
    "OrderItemId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "OrderId" INT NOT NULL,
    "MenuItemId" INT NOT NULL,
    "ItemName" VARCHAR(150) NOT NULL,
    "Price" NUMERIC(10, 2) NOT NULL,
    "Quantity" INT NOT NULL,
    "TotalPrice" NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY ("OrderItemId")
);

ALTER TABLE "OrderItems" ADD CONSTRAINT "FK_OrderItems_MenuItems" FOREIGN KEY ("MenuItemId") REFERENCES "MenuItems"("MenuItemId");
ALTER TABLE "OrderItems" ADD CONSTRAINT "FK_OrderItems_Orders" FOREIGN KEY ("OrderId") REFERENCES "Orders"("OrderId");

CREATE TABLE "Payments" (
    "PaymentId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "OrderId" INT NOT NULL,
    "PaymentMethod" VARCHAR(20) NOT NULL,
    "Amount" NUMERIC(10, 2) NOT NULL,
    "PaymentStatus" VARCHAR(20) NOT NULL,
    "TransactionId" VARCHAR(150) NULL,
    "PaymentDate" TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("PaymentId")
);

ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Orders" FOREIGN KEY ("OrderId") REFERENCES "Orders"("OrderId");
