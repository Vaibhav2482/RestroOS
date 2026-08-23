import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Pos from "./pages/Pos";
import Kitchen from "./pages/Kitchen";
import Tables from "./pages/Tables";
import Menu from "./pages/Menu";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Categories from "./pages/Categories";
import Coupons from "./pages/Coupons";
import Branches from "./pages/Branches";
import DeliverySettings from "./pages/DeliverySettings";
import Admins from "./pages/Admins";
import Integrations from "./pages/Integrations";
import PrinterSettings from "./pages/PrinterSettings";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import Features from "./pages/Features";
import MyProfile from "./pages/MyProfile";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// @mui/x-charts pulls in a meaningfully heavy rendering layer that only
// this one page needs (it alone added ~230KB gzipped to the shared vendor
// bundle) - route-level lazy-loading was tried and reverted everywhere
// else this session, but singling out just the one page with the outlier
// dependency is a narrower, well-justified case, not a repeat of that.
const Analytics = lazy(() => import("./pages/Analytics"));

const analyticsFallback = (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} />
    </Box>
);

function withLayout(element, options) {

    return (
        <ProtectedRoute {...options}>
            <Layout>{element}</Layout>
        </ProtectedRoute>
    );

}

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route path="/login" element={<Login />} />

                <Route path="/" element={withLayout(<Dashboard />)} />
                <Route path="/analytics" element={withLayout(<Suspense fallback={analyticsFallback}><Analytics /></Suspense>, { permission: "view_analytics" })} />
                <Route path="/orders" element={withLayout(<Orders />, { permission: "manage_orders" })} />
                <Route path="/customers" element={withLayout(<Customers />, { permission: "view_customers" })} />
                <Route path="/pos" element={withLayout(<Pos />, { permission: "manage_orders" })} />
                <Route path="/kitchen" element={withLayout(<Kitchen />, { permission: "manage_orders" })} />
                <Route path="/printers" element={withLayout(<PrinterSettings />, { permission: "manage_orders" })} />
                <Route path="/tables" element={withLayout(<Tables />, { permission: "manage_tables" })} />
                <Route path="/menu" element={withLayout(<Menu />, { permission: "manage_menu" })} />
                <Route path="/inventory" element={withLayout(<Inventory />, { permission: ["manage_inventory", "manage_ingredients"] })} />
                <Route path="/reports" element={withLayout(<Reports />, { permission: "view_reports" })} />
                <Route path="/categories" element={withLayout(<Categories />, { permission: "manage_categories" })} />
                <Route path="/coupons" element={withLayout(<Coupons />, { permission: "manage_coupons" })} />
                <Route path="/branches" element={withLayout(<Branches />, { ownerOnly: true, feature: "manage_branches" })} />
                <Route path="/delivery-settings" element={withLayout(<DeliverySettings />, { permission: "manage_delivery" })} />
                <Route path="/admins" element={withLayout(<Admins />, { ownerOnly: true })} />
                <Route path="/integrations" element={withLayout(<Integrations />, { permission: "manage_integrations" })} />
                <Route path="/activity-log" element={withLayout(<AuditLog />, { permission: "view_activity_log" })} />
                <Route path="/settings" element={withLayout(<Settings />, { permission: "manage_branding" })} />
                <Route path="/features" element={withLayout(<Features />, { ownerOnly: true })} />
                <Route path="/profile" element={withLayout(<MyProfile />)} />

                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
