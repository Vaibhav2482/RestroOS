import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Pos from "./pages/Pos";
import Kitchen from "./pages/Kitchen";
import Tables from "./pages/Tables";
import Menu from "./pages/Menu";
import Categories from "./pages/Categories";
import Coupons from "./pages/Coupons";
import Branches from "./pages/Branches";
import Admins from "./pages/Admins";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
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
                <Route path="/analytics" element={withLayout(<Suspense fallback={analyticsFallback}><Analytics /></Suspense>)} />
                <Route path="/orders" element={withLayout(<Orders />)} />
                <Route path="/pos" element={withLayout(<Pos />)} />
                <Route path="/kitchen" element={withLayout(<Kitchen />)} />
                <Route path="/tables" element={withLayout(<Tables />)} />
                <Route path="/menu" element={withLayout(<Menu />)} />
                <Route path="/categories" element={withLayout(<Categories />)} />
                <Route path="/coupons" element={withLayout(<Coupons />, { ownerOnly: true })} />
                <Route path="/branches" element={withLayout(<Branches />, { ownerOnly: true })} />
                <Route path="/admins" element={withLayout(<Admins />, { ownerOnly: true })} />
                <Route path="/integrations" element={withLayout(<Integrations />, { ownerOnly: true })} />
                <Route path="/settings" element={withLayout(<Settings />, { ownerOnly: true })} />

                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
