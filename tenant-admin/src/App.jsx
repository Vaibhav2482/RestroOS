import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import PageLoader from "./components/PageLoader";

import Login from "./pages/Login";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const Pos = lazy(() => import("./pages/Pos"));
const Tables = lazy(() => import("./pages/Tables"));
const Menu = lazy(() => import("./pages/Menu"));
const Categories = lazy(() => import("./pages/Categories"));
const Coupons = lazy(() => import("./pages/Coupons"));
const Branches = lazy(() => import("./pages/Branches"));
const Admins = lazy(() => import("./pages/Admins"));

function withLayout(element, options) {

    return (
        <ProtectedRoute {...options}>
            <Layout>
                <Suspense fallback={<PageLoader />}>
                    {element}
                </Suspense>
            </Layout>
        </ProtectedRoute>
    );

}

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route path="/login" element={<Login />} />

                <Route path="/" element={withLayout(<Dashboard />)} />
                <Route path="/orders" element={withLayout(<Orders />)} />
                <Route path="/pos" element={withLayout(<Pos />)} />
                <Route path="/tables" element={withLayout(<Tables />)} />
                <Route path="/menu" element={withLayout(<Menu />)} />
                <Route path="/categories" element={withLayout(<Categories />)} />
                <Route path="/coupons" element={withLayout(<Coupons />, { ownerOnly: true })} />
                <Route path="/branches" element={withLayout(<Branches />, { ownerOnly: true })} />
                <Route path="/admins" element={withLayout(<Admins />, { ownerOnly: true })} />

                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
