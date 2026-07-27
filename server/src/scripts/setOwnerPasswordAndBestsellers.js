import bcrypt from "bcrypt";
import pool from "../config/db.js";

// One-time operational task, run once from a real deployed request the
// same way the earlier menu/image seed scripts were (see
// seedChaiChakhnaMenu.js) - explicitly requested by the tenant's own
// owner (via the person operating this session on their behalf) to (a)
// set a known password so they can log into their own account, and (b)
// mark a first pass of bestsellers now that the storefront surfaces them
// in a dedicated "Recommended" section. Both writes are idempotent
// (re-running just sets the same values again), so no "already run"
// guard is needed the way the create-based menu seed needed one.
const TENANT_SLUG = "ccc";
const NEW_PASSWORD = "Admin@123";

const BESTSELLER_ITEM_NAMES = [
    "Masala Tea",
    "Special Coffee",
    "Samosa",
    "Vadapav",
    "ice cream",
    "Kesar Thandai",
    "Pani Puri",
    "Veg Momo",
    "Poori - Aloo Curry",
    "Dilli Chole Bhature",
    "Veg Fried Rice",
    "Aloo Paratha"
];

export const setOwnerPasswordAndBestsellers = async () => {

    const tenantResult = await pool.query(`SELECT "TenantId" FROM "Tenants" WHERE "Slug" = $1`, [TENANT_SLUG]);
    const tenantId = tenantResult.rows[0]?.TenantId;

    if (!tenantId) {
        return;
    }

    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

    await pool.query(
        `UPDATE "Admins" SET "Password" = $1, "IsActive" = TRUE, "UpdatedAt" = NOW()
         WHERE "TenantId" = $2 AND "BranchId" IS NULL`,
        [hashedPassword, tenantId]
    );

    await pool.query(
        `UPDATE "MenuItems" SET "IsPopular" = TRUE, "UpdatedAt" = NOW()
         WHERE "BranchId" IN (SELECT "BranchId" FROM "Branches" WHERE "TenantId" = $1)
           AND "ItemName" = ANY($2::text[])`,
        [tenantId, BESTSELLER_ITEM_NAMES]
    );

};
