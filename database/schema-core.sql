-- RestroOS Phase 2: tenant-scoped core entities (Branches, Admins,
-- Categories, MenuItems, Tables). Ported from ChaiChakhna's proven Postgres
-- schema (database/postgres/schema.sql in that project) with one structural
-- change: everything that used to be global now hangs off "Tenants" -
-- Branches and Admins and Categories carry a TenantId directly; MenuItems
-- and Tables stay Branch-scoped exactly as before (their tenant is implied
-- through the Branch).
--
-- Identifiers are double-quoted throughout, same reasoning as ChaiChakhna:
-- every query in this codebase expects exact PascalCase field names on
-- returned rows (row.BranchName, not row.branchname).

CREATE TABLE "Branches" (
    "BranchId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "TenantId" INT NOT NULL,
    "BranchName" VARCHAR(150) NOT NULL,
    "Address" VARCHAR(500) NULL,
    "City" VARCHAR(100) NULL,
    "State" VARCHAR(100) NULL,
    "Pincode" VARCHAR(10) NULL,
    "Phone" VARCHAR(20) NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("BranchId")
);

ALTER TABLE "Branches" ADD CONSTRAINT "FK_Branches_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");

CREATE TABLE "Admins" (
    "AdminId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "TenantId" INT NOT NULL,
    "FullName" VARCHAR(100) NOT NULL,
    "Email" VARCHAR(150) NOT NULL,
    "Password" VARCHAR(255) NOT NULL,
    "BranchId" INT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("AdminId"),
    -- Same email can exist for admins at different restaurants; must be
    -- unique only within one tenant, not platform-wide.
    CONSTRAINT "UQ_Admins_Tenant_Email" UNIQUE ("TenantId", "Email")
);

ALTER TABLE "Admins" ADD CONSTRAINT "FK_Admins_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
ALTER TABLE "Admins" ADD CONSTRAINT "FK_Admins_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");

CREATE TABLE "Categories" (
    "CategoryId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "TenantId" INT NOT NULL,
    "CategoryName" VARCHAR(100) NOT NULL,
    "Description" VARCHAR(300) NULL,
    "ImageUrl" VARCHAR(500) NULL,
    "DisplayOrder" INT NOT NULL DEFAULT 1,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("CategoryId")
);

ALTER TABLE "Categories" ADD CONSTRAINT "FK_Categories_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");

CREATE TABLE "MenuItems" (
    "MenuItemId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "BranchId" INT NOT NULL,
    "CategoryId" INT NOT NULL,
    "ItemName" VARCHAR(150) NOT NULL,
    "Description" VARCHAR(500) NULL,
    "Price" NUMERIC(10, 2) NOT NULL,
    "ImageUrl" VARCHAR(500) NULL,
    "IsAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
    "IsPopular" BOOLEAN NOT NULL DEFAULT FALSE,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("MenuItemId")
);

ALTER TABLE "MenuItems" ADD CONSTRAINT "FK_MenuItems_Categories" FOREIGN KEY ("CategoryId") REFERENCES "Categories"("CategoryId");
ALTER TABLE "MenuItems" ADD CONSTRAINT "FK_MenuItems_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");

CREATE TABLE "Tables" (
    "TableId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "BranchId" INT NOT NULL,
    "TableName" VARCHAR(20) NOT NULL,
    "Capacity" INT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("TableId")
);

ALTER TABLE "Tables" ADD CONSTRAINT "FK_Tables_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");
