-- RestroOS core schema, Phase 1: platform-level tables only.
-- Every future tenant-scoped table (Branches, MenuItems, Orders, ...) will
-- carry a "TenantId" foreign key to "Tenants" - the isolation boundary
-- every query in the system filters by, once tenant-scoped modules exist.

CREATE TABLE "Tenants" (
    "TenantId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "TenantName" VARCHAR(150) NOT NULL,
    "Slug" VARCHAR(80) NOT NULL,
    "OwnerEmail" VARCHAR(150) NOT NULL,
    "OwnerPhone" VARCHAR(15) NULL,
    "PlanType" VARCHAR(30) NOT NULL DEFAULT 'trial',
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("TenantId"),
    CONSTRAINT "UQ_Tenants_Slug" UNIQUE ("Slug")
);

-- Platform staff (you) - deliberately a separate table from any future
-- tenant-scoped "Admins" table. A platform admin manages every tenant;
-- a tenant admin (later phase) only ever sees their own tenant's data.
-- Keeping them as different tables makes that boundary a schema fact,
-- not just an application-level check that could be forgotten somewhere.
CREATE TABLE "PlatformAdmins" (
    "PlatformAdminId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "FullName" VARCHAR(100) NOT NULL,
    "Email" VARCHAR(150) NOT NULL,
    "Password" VARCHAR(255) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("PlatformAdminId"),
    CONSTRAINT "UQ_PlatformAdmins_Email" UNIQUE ("Email")
);
