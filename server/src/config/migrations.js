// Migration SQL lives here as plain JS strings, not as separate .sql files
// read at runtime - a previous version read database/migrations/*.sql via
// fs.readdirSync(), which Vercel's serverless bundler doesn't trace (it
// only bundles files reachable through static imports), so the directory
// never made it into the deployed function and every request 500'd with
// ENOENT. Keeping the SQL as an ordinary imported module sidesteps that
// entirely - it's just code, bundled the same way every other file here is.
export const MIGRATIONS = [
    {
        id: "0001_inventory_units",
        sql: `
            CREATE TABLE "Units" (
                "UnitCode" VARCHAR(10) NOT NULL,
                "UnitName" VARCHAR(30) NOT NULL,
                "UnitType" VARCHAR(20) NOT NULL,
                "BaseUnitCode" VARCHAR(10) NOT NULL,
                "ToBaseFactor" NUMERIC(12, 6) NOT NULL,
                PRIMARY KEY ("UnitCode")
            );

            INSERT INTO "Units" ("UnitCode", "UnitName", "UnitType", "BaseUnitCode", "ToBaseFactor") VALUES
                ('g', 'Gram', 'Weight', 'g', 1),
                ('kg', 'Kilogram', 'Weight', 'g', 1000),
                ('ml', 'Millilitre', 'Volume', 'ml', 1),
                ('l', 'Litre', 'Volume', 'ml', 1000),
                ('pc', 'Piece', 'Count', 'pc', 1);
        `
    },
    {
        id: "0002_inventory_ingredients",
        sql: `
            CREATE TABLE "Ingredients" (
                "IngredientId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "TenantId" INT NOT NULL,
                "Name" VARCHAR(150) NOT NULL,
                "SKU" VARCHAR(50) NULL,
                "Category" VARCHAR(100) NULL,
                "BaseUnit" VARCHAR(10) NOT NULL,
                "LowStockThreshold" NUMERIC(14, 3) NULL,
                "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "UpdatedAt" TIMESTAMP NULL,
                PRIMARY KEY ("IngredientId"),
                CONSTRAINT "UQ_Ingredients_Tenant_Name" UNIQUE ("TenantId", "Name")
            );

            ALTER TABLE "Ingredients" ADD CONSTRAINT "FK_Ingredients_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
            ALTER TABLE "Ingredients" ADD CONSTRAINT "FK_Ingredients_Units" FOREIGN KEY ("BaseUnit") REFERENCES "Units"("UnitCode");
        `
    },
    {
        id: "0003_inventory_ledger",
        sql: `
            CREATE TABLE "BranchInventory" (
                "BranchInventoryId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "BranchId" INT NOT NULL,
                "IngredientId" INT NOT NULL,
                "CurrentQuantityBase" NUMERIC(14, 3) NOT NULL DEFAULT 0,
                "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("BranchInventoryId"),
                CONSTRAINT "UQ_BranchInventory_Branch_Ingredient" UNIQUE ("BranchId", "IngredientId")
            );

            ALTER TABLE "BranchInventory" ADD CONSTRAINT "FK_BranchInventory_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");
            ALTER TABLE "BranchInventory" ADD CONSTRAINT "FK_BranchInventory_Ingredients" FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("IngredientId");

            CREATE TABLE "InventoryTransactions" (
                "TransactionId" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "TenantId" INT NOT NULL,
                "BranchId" INT NOT NULL,
                "IngredientId" INT NOT NULL,
                "TransactionType" VARCHAR(20) NOT NULL,
                "QuantityBase" NUMERIC(14, 3) NOT NULL,
                "EnteredUnit" VARCHAR(10) NOT NULL,
                "EnteredQuantity" NUMERIC(14, 3) NOT NULL,
                "ReferenceType" VARCHAR(30) NULL,
                "ReferenceId" INT NULL,
                "ReversalOfTransactionId" BIGINT NULL,
                "PriorQuantityBase" NUMERIC(14, 3) NULL,
                "PostQuantityBase" NUMERIC(14, 3) NULL,
                "ActorType" VARCHAR(10) NOT NULL,
                "ActorAdminId" INT NULL,
                "Reason" VARCHAR(300) NULL,
                "Notes" VARCHAR(500) NULL,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("TransactionId"),
                CONSTRAINT "CHK_InventoryTransactions_Type" CHECK ("TransactionType" IN (
                    'OPENING_STOCK', 'PURCHASE', 'CONSUMPTION', 'WASTAGE',
                    'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'REVERSAL'
                )),
                CONSTRAINT "CHK_InventoryTransactions_Actor" CHECK ("ActorType" IN ('User', 'System'))
            );

            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Ingredients" FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("IngredientId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Reversal" FOREIGN KEY ("ReversalOfTransactionId") REFERENCES "InventoryTransactions"("TransactionId");
            ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "FK_InvTxn_Admin" FOREIGN KEY ("ActorAdminId") REFERENCES "Admins"("AdminId");

            CREATE INDEX "IX_InvTxn_Branch_Ingredient_Date" ON "InventoryTransactions" ("BranchId", "IngredientId", "CreatedAt" DESC);
            CREATE INDEX "IX_InvTxn_Reference" ON "InventoryTransactions" ("ReferenceType", "ReferenceId");
        `
    },
    {
        id: "0004_inventory_recipes",
        sql: `
            CREATE TABLE "MenuItemRecipes" (
                "RecipeItemId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "MenuItemId" INT NOT NULL,
                "IngredientId" INT NOT NULL,
                "Quantity" NUMERIC(12, 3) NOT NULL,
                "Unit" VARCHAR(10) NOT NULL,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "UpdatedAt" TIMESTAMP NULL,
                PRIMARY KEY ("RecipeItemId"),
                CONSTRAINT "UQ_Recipe_MenuItem_Ingredient" UNIQUE ("MenuItemId", "IngredientId")
            );

            ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_MenuItems" FOREIGN KEY ("MenuItemId") REFERENCES "MenuItems"("MenuItemId") ON DELETE CASCADE;
            ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_Ingredients" FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("IngredientId");
            ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_Units" FOREIGN KEY ("Unit") REFERENCES "Units"("UnitCode");
        `
    },
    {
        id: "0005_payment_idempotency",
        sql: `
            CREATE UNIQUE INDEX "UQ_Payments_TransactionId" ON "Payments" ("TransactionId") WHERE "TransactionId" IS NOT NULL;
        `
    },
    {
        id: "0006_audit_log",
        sql: `
            CREATE TABLE "AuditLogs" (
                "AuditLogId" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "TenantId" INT NOT NULL,
                "ActorAdminId" INT NULL,
                "ActorType" VARCHAR(10) NOT NULL DEFAULT 'User',
                "Action" VARCHAR(50) NOT NULL,
                "EntityType" VARCHAR(30) NOT NULL,
                "EntityId" INT NULL,
                "Summary" VARCHAR(500) NOT NULL,
                "Metadata" JSONB NULL,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("AuditLogId"),
                CONSTRAINT "CHK_AuditLogs_ActorType" CHECK ("ActorType" IN ('User', 'System'))
            );

            ALTER TABLE "AuditLogs" ADD CONSTRAINT "FK_AuditLogs_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
            ALTER TABLE "AuditLogs" ADD CONSTRAINT "FK_AuditLogs_Admins" FOREIGN KEY ("ActorAdminId") REFERENCES "Admins"("AdminId");

            CREATE INDEX "IX_AuditLogs_Tenant_Date" ON "AuditLogs" ("TenantId", "CreatedAt" DESC);
            CREATE INDEX "IX_AuditLogs_Entity" ON "AuditLogs" ("EntityType", "EntityId");
        `
    },
    {
        id: "0007_ingredient_cost",
        sql: `
            ALTER TABLE "Ingredients" ADD COLUMN "CostPerBaseUnit" NUMERIC(12, 4) NULL;
        `
    },
    {
        id: "0008_admin_avatar",
        sql: `
            ALTER TABLE "Admins" ADD COLUMN "AvatarUrl" VARCHAR(500) NULL;
        `
    },
    {
        id: "0009_customer_avatar",
        sql: `
            ALTER TABLE "Customers" ADD COLUMN "AvatarUrl" VARCHAR(500) NULL;
        `
    },
    {
        id: "0010_admin_login_lockout",
        sql: `
            ALTER TABLE "Admins"
                ADD COLUMN "FailedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN "LockedUntil" TIMESTAMP NULL;
        `
    },
    {
        id: "0011_customer_login_lockout",
        sql: `
            ALTER TABLE "Customers"
                ADD COLUMN "FailedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN "LockedUntil" TIMESTAMP NULL;
        `
    },
    {
        id: "0012_platform_admin_login_lockout",
        sql: `
            ALTER TABLE "PlatformAdmins"
                ADD COLUMN "FailedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN "LockedUntil" TIMESTAMP NULL;
        `
    },
    {
        // 0005_payment_idempotency only de-duplicates Razorpay payments
        // (unique on TransactionId, which is always NULL for manual Cash/
        // Card/UPI payments) - this closes the same gap for those, so a
        // double-tapped "Mark Paid" can't record two Paid rows for one order.
        id: "0013_payment_paid_idempotency",
        sql: `
            CREATE UNIQUE INDEX "UQ_Payments_OrderId_Paid" ON "Payments" ("OrderId") WHERE "PaymentStatus" = 'Paid';
        `
    },
    {
        // bootstrapFirstAdmin's count()-then-create() check has a race: two
        // concurrent bootstrap requests can both read count() === 0 and both
        // insert. A unique index on a constant expression is the standard
        // "singleton table" trick - every row collides with every other row,
        // so Postgres itself rejects a second insert (surfaced as the same
        // friendly 23505 duplicate message every other unique violation gets
        // in ErrorHandler.js) instead of relying on an un-locked read.
        id: "0014_platform_admin_singleton",
        sql: `
            CREATE UNIQUE INDEX "UQ_PlatformAdmins_Singleton" ON "PlatformAdmins" ((TRUE));
        `
    },
    {
        // Lets an Owner grant a Branch Admin specific tenant-wide actions
        // (e.g. managing ingredients) without making them a full Owner.
        // See requirePermission in middleware/Auth.js.
        id: "0015_admin_permissions",
        sql: `
            ALTER TABLE "Admins" ADD COLUMN "Permissions" TEXT[] NOT NULL DEFAULT '{}';
        `
    },
    {
        // The permission list grew from 5 owner-only actions to 13 keys
        // covering every tenant-admin screen (Orders/POS/Kitchen, Tables,
        // Menu, Categories, Inventory, Customers, Analytics, Reports on top
        // of the original 5) - every one of those screens was already
        // unconditionally open to any Branch Admin. Without this backfill,
        // every already-existing Branch Admin would suddenly lose access to
        // all of them the moment requirePermission starts checking those
        // routes. Only appends the new "core" keys (see
        // config/permissions.js CORE_PERMISSION_KEYS) - never touches the
        // original 5, which stay exactly as an Owner had already set them.
        id: "0016_admin_permissions_core_backfill",
        sql: `
            UPDATE "Admins"
            SET "Permissions" = ARRAY(
                SELECT DISTINCT unnest("Permissions" || ARRAY[
                    'manage_orders', 'manage_tables', 'manage_menu', 'manage_categories',
                    'manage_inventory', 'view_customers', 'view_analytics', 'view_reports'
                ])
            )
            WHERE "BranchId" IS NOT NULL;
        `
    },
    {
        // A tenant-wide kill switch, distinct from Admins.Permissions - an
        // Owner can turn a whole module off for their restaurant (e.g. a
        // single-location tenant hiding Branches, or one that doesn't track
        // stock hiding Inventory) so it disappears for EVERYONE in that
        // tenant, themselves included, not just specific staff. Defaults to
        // empty - nothing disabled, identical behavior to today - so this
        // needs no backfill. See requirePermission/requireFeatureEnabled in
        // middleware/Auth.js.
        id: "0017_tenant_disabled_features",
        sql: `
            ALTER TABLE "Tenants" ADD COLUMN "DisabledFeatures" TEXT[] NOT NULL DEFAULT '{}';
        `
    },
    {
        // Lets a session be revoked without deactivating the account. Baked
        // into the JWT at login and re-checked against this column on every
        // request (middleware/Auth.js) - bumping it makes every token minted
        // before the bump stop working immediately, even though it's not
        // due to expire for up to another JWT_EXPIRES_IN. Deactivating an
        // admin already cuts off access (Auth.js checks IsActive fresh on
        // every request), but that's the wrong tool for "my phone was lost,
        // I'm still employed" - this is the same, more surgical action a
        // password change or a "sign out everywhere" button should trigger.
        id: "0018_admin_token_version",
        sql: `
            ALTER TABLE "Admins" ADD COLUMN "TokenVersion" INTEGER NOT NULL DEFAULT 0;
        `
    },
    {
        // Every counter order was attributed only to the customer (often
        // "Walk-in Guest"), with no record of which staff member actually
        // rang it up - so a discount, a suspicious cancellation, or a later
        // dispute could never be traced back to a person. NULL for orders a
        // customer places themselves through the storefront (POST /checkout,
        // a different code path from admin-created orders entirely) - there
        // is no admin to attribute those to, and none should be invented.
        // ON DELETE SET NULL rather than a hard FK failure: a departed
        // staff member's Admins row is deactivated, never deleted, but this
        // is the safer default if that ever changes - the order record and
        // its history must survive regardless of what happens to the admin.
        id: "0019_order_created_by_admin",
        sql: `
            ALTER TABLE "Orders" ADD COLUMN "CreatedByAdminId" INT NULL;
            ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_CreatedByAdmin" FOREIGN KEY ("CreatedByAdminId") REFERENCES "Admins"("AdminId") ON DELETE SET NULL;
        `
    },
    {
        // GST was a single hardcoded 2.5%+2.5% applied to the whole order
        // regardless of what was in it - real F&B has multiple slabs (a
        // plain non-AC-restaurant item and a liquor/AC-premium item are not
        // taxed the same), and packaging/service charges differ too. This is
        // the schema gap that made that unconfigurable. Defaults every
        // existing item to 5% (2.5 + 2.5), the exact combined rate already
        // in effect everywhere today - this migration changes nothing about
        // what any order is charged until an owner deliberately sets a
        // different rate on a specific item.
        id: "0020_menu_item_tax_rate",
        sql: `
            ALTER TABLE "MenuItems" ADD COLUMN "TaxRatePercent" NUMERIC(5, 2) NOT NULL DEFAULT 5.00;
        `
    },
    {
        // An order could already be cancelled, but with no reason, no record
        // of who authorised it, and no way to give money back without
        // cancelling the whole order. Same append-only shape as
        // InventoryTransactions (0003_inventory_ledger): every void/refund is
        // a new row here, nothing on the Orders/Payments row itself is ever
        // rewritten to reflect it - the original order stays exactly as it
        // was placed, and this is the separate trail of what was done to it
        // afterwards, by whom, and why. Reason and ActorAdminId are NOT NULL
        // - unlike a customer's own self-service cancellation (still bare,
        // unreasoned, unauthorised-by-anyone-else - that's the point of it
        // being self-service), a VOID or REFUND is always a staff action and
        // always needs both.
        id: "0021_order_adjustments",
        sql: `
            CREATE TABLE "OrderAdjustments" (
                "AdjustmentId" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "TenantId" INT NOT NULL,
                "OrderId" INT NOT NULL,
                "AdjustmentType" VARCHAR(10) NOT NULL,
                "Amount" NUMERIC(10, 2) NULL,
                "Reason" VARCHAR(300) NOT NULL,
                "ActorAdminId" INT NOT NULL,
                "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("AdjustmentId"),
                CONSTRAINT "CHK_OrderAdjustments_Type" CHECK ("AdjustmentType" IN ('VOID', 'REFUND'))
            );

            ALTER TABLE "OrderAdjustments" ADD CONSTRAINT "FK_OrderAdjustments_Tenants" FOREIGN KEY ("TenantId") REFERENCES "Tenants"("TenantId");
            ALTER TABLE "OrderAdjustments" ADD CONSTRAINT "FK_OrderAdjustments_Orders" FOREIGN KEY ("OrderId") REFERENCES "Orders"("OrderId");
            ALTER TABLE "OrderAdjustments" ADD CONSTRAINT "FK_OrderAdjustments_Admin" FOREIGN KEY ("ActorAdminId") REFERENCES "Admins"("AdminId");

            CREATE INDEX "IX_OrderAdjustments_Order" ON "OrderAdjustments" ("OrderId", "CreatedAt" DESC);
        `
    },
    {
        // Postgres never auto-indexes a foreign key (only PK/UNIQUE get one) -
        // every FK added across the 5 baseline schema.sql files was left
        // unindexed since day one. Harmless at seed-data volume, but
        // OrderItems/Payments are joined on every single order fetch and
        // Orders is filtered+sorted by BranchId/CustomerId on every order
        // list and POS table-grid load, so this is the query pattern that
        // degrades first as real order history accumulates - a production
        // readiness audit flagged it as the top database-scalability risk.
        // Plain CREATE INDEX (not CONCURRENTLY, which can't run inside the
        // per-migration transaction this runner wraps every statement in) is
        // fine at current table sizes; it would need to move to a manual
        // CONCURRENTLY run outside this migration system if it's ever applied
        // against tables large enough for the lock to matter.
        id: "0022_foreign_key_indexes",
        sql: `
            CREATE INDEX "IX_Orders_Branch_Date" ON "Orders" ("BranchId", "OrderDate" DESC);
            CREATE INDEX "IX_Orders_Customer_Date" ON "Orders" ("CustomerId", "OrderDate" DESC);
            CREATE INDEX "IX_Orders_Address" ON "Orders" ("AddressId");
            CREATE INDEX "IX_Orders_Coupon" ON "Orders" ("CouponId");
            CREATE INDEX "IX_Orders_CreatedByAdmin" ON "Orders" ("CreatedByAdminId");

            CREATE INDEX "IX_OrderItems_Order" ON "OrderItems" ("OrderId");
            CREATE INDEX "IX_OrderItems_MenuItem" ON "OrderItems" ("MenuItemId");

            CREATE INDEX "IX_Payments_Order" ON "Payments" ("OrderId");

            CREATE INDEX "IX_Cart_Customer" ON "Cart" ("CustomerId");
            CREATE INDEX "IX_Cart_MenuItem" ON "Cart" ("MenuItemId");

            CREATE INDEX "IX_MenuItems_Branch" ON "MenuItems" ("BranchId");
            CREATE INDEX "IX_MenuItems_Category" ON "MenuItems" ("CategoryId");

            CREATE INDEX "IX_Admins_Tenant" ON "Admins" ("TenantId");
            CREATE INDEX "IX_Admins_Branch" ON "Admins" ("BranchId");

            CREATE INDEX "IX_Branches_Tenant" ON "Branches" ("TenantId");
            CREATE INDEX "IX_Categories_Tenant" ON "Categories" ("TenantId");
            CREATE INDEX "IX_Customers_Tenant" ON "Customers" ("TenantId");
            CREATE INDEX "IX_CustomerAddresses_Customer" ON "CustomerAddresses" ("CustomerId");
            CREATE INDEX "IX_Tables_Branch" ON "Tables" ("BranchId");

            CREATE INDEX "IX_Coupons_Tenant" ON "Coupons" ("TenantId");
            CREATE INDEX "IX_CouponRedemptions_Coupon" ON "CouponRedemptions" ("CouponId");
            CREATE INDEX "IX_CouponRedemptions_Customer" ON "CouponRedemptions" ("CustomerId");
            CREATE INDEX "IX_CouponRedemptions_Order" ON "CouponRedemptions" ("OrderId");

            CREATE INDEX "IX_Ingredients_Tenant" ON "Ingredients" ("TenantId");

            -- These two tables already have a UNIQUE(leadingCol, otherCol)
            -- index from their creating migration, which serves lookups by
            -- the leading column alone but not the second column alone.
            CREATE INDEX "IX_MenuItemRecipes_Ingredient" ON "MenuItemRecipes" ("IngredientId");
            CREATE INDEX "IX_BranchInventory_Ingredient" ON "BranchInventory" ("IngredientId");
        `
    },
    {
        // Platform-admin actions (onboard/suspend/reactivate a tenant, reset
        // an owner's password, toggle tenant features) were never recorded
        // anywhere - the most privileged role in the system had no
        // accountability trail. AuditLogs already supported a nullable actor
        // for a "System" action; this reuses the same table (TenantId is
        // always the tenant being acted on, which is exactly what a tenant's
        // own audit log would want to show too) rather than standing up a
        // parallel table, and adds a third actor lane alongside the existing
        // Admin one. ActorPlatformAdminId has no ON DELETE behavior specified
        // - deliberately the same default-RESTRICT posture as every other FK
        // on this table, since a platform admin account is deactivated, not
        // deleted, matching the Admins table's own lifecycle convention.
        id: "0023_audit_log_platform_admin_actor",
        sql: `
            ALTER TABLE "AuditLogs" ADD COLUMN "ActorPlatformAdminId" INT NULL;
            ALTER TABLE "AuditLogs" ADD CONSTRAINT "FK_AuditLogs_PlatformAdmins" FOREIGN KEY ("ActorPlatformAdminId") REFERENCES "PlatformAdmins"("PlatformAdminId");

            ALTER TABLE "AuditLogs" DROP CONSTRAINT "CHK_AuditLogs_ActorType";
            ALTER TABLE "AuditLogs" ADD CONSTRAINT "CHK_AuditLogs_ActorType" CHECK ("ActorType" IN ('User', 'System', 'PlatformAdmin'));
        `
    },
    {
        // A dine-in table needed a concept bigger than "an order" - a guest
        // orders across several rounds (tea, then later a sweet, then
        // another tea), each round is its own Order/KOT so the kitchen only
        // ever sees what's actually new, but the guest expects ONE bill for
        // everything at the end. TableVisits is that grouping: every Order
        // placed for a table while it's occupied belongs to the table's
        // current Open visit, and settling the visit (not any individual
        // order's status) is what actually frees the table.
        //
        // No TenantId column here, same as Orders itself - scoped via
        // BranchId -> Branches -> TenantId, not denormalized redundantly.
        id: "0024_table_visits",
        sql: `
            CREATE TABLE "TableVisits" (
                "VisitId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
                "BranchId" INT NOT NULL,
                "TableNumber" VARCHAR(20) NOT NULL,
                "Status" VARCHAR(10) NOT NULL DEFAULT 'Open',
                "OpenedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "ClosedAt" TIMESTAMP NULL,
                "PaymentMethod" VARCHAR(20) NULL,
                "ClosedByAdminId" INT NULL,
                PRIMARY KEY ("VisitId"),
                CONSTRAINT "FK_TableVisits_Branches" FOREIGN KEY ("BranchId") REFERENCES "Branches"("BranchId"),
                CONSTRAINT "FK_TableVisits_ClosedByAdmin" FOREIGN KEY ("ClosedByAdminId") REFERENCES "Admins"("AdminId"),
                CONSTRAINT "CHK_TableVisits_Status" CHECK ("Status" IN ('Open', 'Closed'))
            );

            -- One open visit per table at a time, enforced by the database,
            -- not just application code - a partial unique index (only over
            -- rows where Status = 'Open') is what makes this conditional
            -- instead of a plain UNIQUE constraint blocking a table from
            -- ever being reused once its first visit closes.
            CREATE UNIQUE INDEX "UQ_TableVisits_OneOpenPerTable" ON "TableVisits" ("BranchId", "TableNumber") WHERE "Status" = 'Open';
            CREATE INDEX "IX_TableVisits_Branch_Status" ON "TableVisits" ("BranchId", "Status");

            ALTER TABLE "Orders" ADD COLUMN "VisitId" INT NULL;
            ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_TableVisits" FOREIGN KEY ("VisitId") REFERENCES "TableVisits"("VisitId");
            CREATE INDEX "IX_Orders_VisitId" ON "Orders" ("VisitId");

            -- Backfill: group every currently in-flight Dine In order (not
            -- yet Delivered/Cancelled) into one Open visit per table, so an
            -- occupied table doesn't vanish from the floor grid the moment
            -- this deploys, once the grid's occupancy check moves from "has
            -- a non-terminal order" to "has an open visit" in this same
            -- release. A table's already-Delivered round from before this
            -- migration (if any) is intentionally left without a VisitId -
            -- there is no in-flight visit left to attach it to, and this is
            -- a one-time cutover backfill, not an attempt to reconstruct
            -- pre-migration billing history.
            INSERT INTO "TableVisits" ("BranchId", "TableNumber", "Status", "OpenedAt")
            SELECT "BranchId", "TableNumber", 'Open', MIN("OrderDate")
            FROM "Orders"
            WHERE "DeliveryType" = 'Dine In' AND "TableNumber" IS NOT NULL AND "OrderStatus" NOT IN ('Delivered', 'Cancelled')
            GROUP BY "BranchId", "TableNumber";

            UPDATE "Orders" O
            SET "VisitId" = V."VisitId"
            FROM "TableVisits" V
            WHERE O."BranchId" = V."BranchId" AND O."TableNumber" = V."TableNumber" AND V."Status" = 'Open'
              AND O."DeliveryType" = 'Dine In' AND O."OrderStatus" NOT IN ('Delivered', 'Cancelled');
        `
    },
    {
        // Guest count belongs to the visit (the whole sitting), not any one
        // round - a table seated for 4 doesn't become a table of 4 again on
        // every later round, it's captured once when the visit opens.
        // Nullable and optional throughout: nothing before this migration
        // ever collected it, and it's informational (reporting/context),
        // never a value business logic branches on.
        id: "0025_table_visit_guest_count",
        sql: `
            ALTER TABLE "TableVisits" ADD COLUMN "GuestCount" INT NULL;
            ALTER TABLE "TableVisits" ADD CONSTRAINT "CHK_TableVisits_GuestCount" CHECK ("GuestCount" IS NULL OR "GuestCount" > 0);
        `
    },
    {
        // Guest count is removed - captured but never actually visible
        // anywhere staff would see it during service (not the floor grid),
        // and never fed into anything (no report used it), so it was just
        // a field nobody could rely on being filled in for no payoff.
        // Migrations are never edited after the fact (0025 stays, as the
        // historical record of what ran), this is the migration that
        // undoes its effect instead.
        id: "0026_drop_table_visit_guest_count",
        sql: `
            ALTER TABLE "TableVisits" DROP COLUMN "GuestCount";
        `
    },
    {
        // Account lockout was deliberately removed (per commit history)
        // in favor of rate limiting, but FailedLoginAttempts/LockedUntil
        // kept being written on every login across all three account
        // types, with nothing ever reading them back to actually block
        // one - a production-readiness audit flagged this as confusing,
        // write-only bookkeeping. The application code no longer writes
        // to them (config/lockoutPolicy.js and every recordFailedLogin/
        // resetFailedLogins call site were removed in the same change);
        // this drops the now-orphaned columns themselves.
        id: "0027_drop_dead_lockout_columns",
        sql: `
            ALTER TABLE "Admins" DROP COLUMN "FailedLoginAttempts", DROP COLUMN "LockedUntil";
            ALTER TABLE "Customers" DROP COLUMN "FailedLoginAttempts", DROP COLUMN "LockedUntil";
            ALTER TABLE "PlatformAdmins" DROP COLUMN "FailedLoginAttempts", DROP COLUMN "LockedUntil";
        `
    },
    {
        // TenantRepository used to add these two columns itself, lazily, on
        // first use (IF NOT EXISTS, guarded by a module-level flag) instead
        // of through this migration runner - a second, untracked schema-
        // evolution path that a production-readiness audit flagged as
        // having no single source of truth. Both columns already exist in
        // every real environment (the lazy path already ran there), so
        // IF NOT EXISTS here is a safe no-op that just brings them under
        // the tracked migration history where every other column lives.
        id: "0028_tenant_branding_columns",
        sql: `
            ALTER TABLE "Tenants"
            ADD COLUMN IF NOT EXISTS "LogoUrl" VARCHAR(500),
            ADD COLUMN IF NOT EXISTS "PrimaryColor" VARCHAR(7) DEFAULT '#4F46E5';
        `
    }
];
