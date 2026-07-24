import express from "express";
import cors from "cors";

import notFound from "./middleware/NotFound.js";
import errorHandler from "./middleware/ErrorHandler.js";

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

const app = express();

// Without maxAge, browsers don't cache the CORS preflight at all - every
// mutating request (any JSON body + Authorization header counts as
// non-simple) pays a full extra OPTIONS round trip before the real one.
// Caching it removes that tax for repeat requests to the same origin.
app.use(cors({ maxAge: 7200 }));
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "RestroOS API is running successfully."
    });
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

app.use(notFound);
app.use(errorHandler);

export default app;
