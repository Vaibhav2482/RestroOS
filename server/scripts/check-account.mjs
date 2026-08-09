import pool from "../src/config/db.js";

const email = process.argv[2] || "avinashj387@gmail.com";

const platformAdmin = await pool.query(`SELECT "PlatformAdminId", "Email", "FullName", "CreatedAt" FROM "PlatformAdmins"`);
console.log("PlatformAdmins (singleton table):", JSON.stringify(platformAdmin.rows, null, 2));

const admin = await pool.query(
    `SELECT "AdminId", "TenantId", "FullName", "Email", "BranchId", "IsActive" FROM "Admins" WHERE LOWER("Email") = LOWER($1)`,
    [email]
);
console.log(`Admins matching ${email}:`, JSON.stringify(admin.rows, null, 2));

const tenant = await pool.query(
    `SELECT "TenantId", "TenantName", "Slug", "OwnerEmail", "IsActive" FROM "Tenants" WHERE LOWER("OwnerEmail") = LOWER($1)`,
    [email]
);
console.log(`Tenants owned by ${email}:`, JSON.stringify(tenant.rows, null, 2));

const customer = await pool.query(
    `SELECT "CustomerId", "TenantId", "FullName", "Email", "IsActive" FROM "Customers" WHERE LOWER("Email") = LOWER($1)`,
    [email]
);
console.log(`Customers matching ${email}:`, JSON.stringify(customer.rows, null, 2));

await pool.end();
