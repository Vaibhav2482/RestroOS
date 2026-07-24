import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { StorefrontProvider } from "./context/StorefrontContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PageLoader from "./components/PageLoader";

import Landing from "./pages/Landing";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Home = lazy(() => import("./pages/Home"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Addresses = lazy(() => import("./pages/Addresses"));

function TenantApp() {

    return (

        <StorefrontProvider>

            <Layout>

                <Suspense fallback={<PageLoader />}>

                    <Routes>

                        <Route index element={<Home />} />
                        <Route path="login" element={<Login />} />
                        <Route path="register" element={<Register />} />
                        <Route path="cart" element={<Cart />} />

                        <Route path="checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                        <Route path="orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                        <Route path="orders/:orderId" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
                        <Route path="addresses" element={<ProtectedRoute><Addresses /></ProtectedRoute>} />

                        <Route path="*" element={<Navigate to="" replace />} />

                    </Routes>

                </Suspense>

            </Layout>

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
