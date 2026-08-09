import express from "express";
import cors from "cors";

import { initSentry } from "./config/sentry.js";
import notFound from "./middleware/NotFound.js";
import errorHandler from "./middleware/ErrorHandler.js";
import { generalRateLimiter } from "./middleware/RateLimit.js";

initSentry();

import PlatformAdminRoutes from "./routes/PlatformAdminRoutes.js";
import TenantRoutes from "./routes/TenantRoutes.js";
import PublicTenantRoutes from "./routes/PublicTenantRoutes.js";
import AdminAuthRoutes from "./routes/AdminAuthRoutes.js";
import AdminRoutes from "./routes/AdminRoutes.js";
import BranchRoutes from "./routes/BranchRoutes.js";
import CategoryRoutes from "./routes/CategoryRoutes.js";
import MenuRoutes from "./routes/MenuRoutes.js";
import MenuOptionRoutes from "./routes/MenuOptionRoutes.js";
import TableRoutes from "./routes/TableRoutes.js";
import CustomerAuthRoutes from "./routes/CustomerAuthRoutes.js";
import CustomerRoutes from "./routes/CustomerRoutes.js";
import CustomerAddressRoutes from "./routes/CustomerAddressRoutes.js";
import CartRoutes from "./routes/CartRoutes.js";
import OrderRoutes from "./routes/OrderRoutes.js";
import CheckoutRoutes from "./routes/CheckoutRoutes.js";
import PaymentRoutes from "./routes/PaymentRoutes.js";
import CouponRoutes from "./routes/CouponRoutes.js";
import UploadRoutes from "./routes/UploadRoutes.js";
import RealtimeRoutes from "./routes/RealtimeRoutes.js";
import IntegrationRoutes from "./routes/IntegrationRoutes.js";
import AnalyticsRoutes from "./routes/AnalyticsRoutes.js";
import IngredientRoutes from "./routes/IngredientRoutes.js";
import InventoryRoutes from "./routes/InventoryRoutes.js";
import MenuItemRecipeRoutes from "./routes/MenuItemRecipeRoutes.js";
import AuditRoutes from "./routes/AuditRoutes.js";
import { razorpayWebhook } from "./controllers/PaymentController.js";
import { runMigrations } from "./config/migrate.js";

const app = express();

// Without maxAge, browsers don't cache the CORS preflight at all - every
// mutating request (any JSON body + Authorization header counts as
// non-simple) pays a full extra OPTIONS round trip before the real one.
// Caching it removes that tax for repeat requests to the same origin.
//
// Origin is unrestricted unless CORS_ALLOWED_ORIGINS is set - a security
// audit flagged the open policy, but this API is bearer-token-only (no
// cookies anywhere), which is a materially lower risk than a cookie-auth
// app: a third-party site can't read another origin's localStorage, and
// the browser won't auto-attach an Authorization header cross-origin the
// way it would a cookie, so classic CSRF doesn't apply here. Left opt-in
// (comma-separated origins) rather than hardcoding the three frontend
// domains directly, since getting that list wrong here would break every
// storefront/tenant-admin/platform-admin request in production - safer to
// have it set deliberately, with today's behavior unchanged until it is.
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
    maxAge: 7200,
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true
}));
// Registered before express.json() below and outside PaymentRoutes.js's
// authenticate gate - see razorpayWebhook's own comment for why (raw body
// for signature verification, no Bearer token possible from Razorpay's side).
app.post("/api/v1/payments/webhook", express.raw({ type: "application/json" }), razorpayWebhook);

app.use(express.json());

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "RestroOS API is running successfully."
    });
});

// Registered after /health above (so uptime monitors polling it never trip
// this) but before every other route below.
app.use("/api/v1", generalRateLimiter);

// SQL lives in config/migrations.js as plain JS now, not read from disk at
// runtime - see that file's own comment for why the previous version of
// this broke production. No-op after the first successful run per warm
// instance (config/migrate.js).
app.use(async (req, res, next) => {

    try {
        await runMigrations();
        next();
    } catch (error) {
        next(error);
    }

});

app.use("/api/v1/platform-admin/auth", PlatformAdminRoutes);
app.use("/api/v1/platform-admin/tenants", TenantRoutes);
app.use("/api/v1/tenants", PublicTenantRoutes);
app.use("/api/v1/admin/auth", AdminAuthRoutes);
app.use("/api/v1/admins", AdminRoutes);
app.use("/api/v1/branches", BranchRoutes);
app.use("/api/v1/categories", CategoryRoutes);
app.use("/api/v1/menu", MenuRoutes);
app.use("/api/v1/menu-options", MenuOptionRoutes);
app.use("/api/v1/tables", TableRoutes);
app.use("/api/v1/customer/auth", CustomerAuthRoutes);
app.use("/api/v1/customers", CustomerRoutes);
app.use("/api/v1/customer-addresses", CustomerAddressRoutes);
app.use("/api/v1/cart", CartRoutes);
app.use("/api/v1/orders", OrderRoutes);
app.use("/api/v1/checkout", CheckoutRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/coupons", CouponRoutes);
app.use("/api/v1/uploads", UploadRoutes);
app.use("/api/v1/realtime", RealtimeRoutes);
app.use("/api/v1/integrations", IntegrationRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);
app.use("/api/v1/ingredients", IngredientRoutes);
app.use("/api/v1/inventory", InventoryRoutes);
app.use("/api/v1/menu-item-recipes", MenuItemRecipeRoutes);
app.use("/api/v1/audit-logs", AuditRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
