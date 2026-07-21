import express from "express";
import cors from "cors";

import notFound from "./middleware/NotFound.js";
import errorHandler from "./middleware/ErrorHandler.js";

import PlatformAdminRoutes from "./routes/PlatformAdminRoutes.js";
import TenantRoutes from "./routes/TenantRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "RestroOS API is running successfully."
    });
});

app.use("/api/v1/platform-admin/auth", PlatformAdminRoutes);
app.use("/api/v1/platform-admin/tenants", TenantRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
