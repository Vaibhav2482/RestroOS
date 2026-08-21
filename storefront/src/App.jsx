import { useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material";

import { StorefrontProvider, useStorefront } from "./context/StorefrontContext";
import { buildTenantTheme } from "./theme/theme";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Addresses from "./pages/Addresses";
import Profile from "./pages/Profile";
import Privacy from "./pages/Privacy";

function TenantThemedApp() {

    const { tenant } = useStorefront();

    // Recreated only when the tenant's chosen color actually changes, not
    // on every render - createTheme() isn't cheap enough to redo per paint.
    const tenantTheme = useMemo(() => buildTenantTheme(tenant?.PrimaryColor), [tenant?.PrimaryColor]);

    return (

        <ThemeProvider theme={tenantTheme}>

            <Layout>

                <Routes>

                    <Route index element={<Home />} />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                    <Route path="cart" element={<Cart />} />

                    <Route path="checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                    <Route path="orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                    <Route path="orders/:orderId" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
                    <Route path="addresses" element={<ProtectedRoute><Addresses /></ProtectedRoute>} />
                    <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="privacy" element={<Privacy />} />

                    <Route path="*" element={<Navigate to="" replace />} />

                </Routes>

            </Layout>

        </ThemeProvider>

    );

}

function TenantApp() {

    return (

        <StorefrontProvider>
            <TenantThemedApp />
        </StorefrontProvider>

    );

}

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route path="/" element={<Landing />} />
                <Route path="/:tenantSlug/*" element={<TenantApp />} />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
