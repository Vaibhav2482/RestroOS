import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Pos from "./pages/Pos";
import Tables from "./pages/Tables";
import Menu from "./pages/Menu";
import Categories from "./pages/Categories";
import Branches from "./pages/Branches";
import Admins from "./pages/Admins";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

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
                <Route path="/orders" element={withLayout(<Orders />)} />
                <Route path="/pos" element={withLayout(<Pos />)} />
                <Route path="/tables" element={withLayout(<Tables />)} />
                <Route path="/menu" element={withLayout(<Menu />)} />
                <Route path="/categories" element={withLayout(<Categories />)} />
                <Route path="/branches" element={withLayout(<Branches />, { ownerOnly: true })} />
                <Route path="/admins" element={withLayout(<Admins />, { ownerOnly: true })} />

                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
