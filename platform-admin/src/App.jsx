import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import PageLoader from "./components/PageLoader";

import Login from "./pages/Login";

const Setup = lazy(() => import("./pages/Setup"));
const Tenants = lazy(() => import("./pages/Tenants"));

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route path="/" element={<Navigate to="/tenants" replace />} />

                <Route path="/login" element={<Login />} />

                <Route
                    path="/setup"
                    element={
                        <Suspense fallback={<PageLoader />}>
                            <Setup />
                        </Suspense>
                    }
                />

                <Route
                    path="/tenants"
                    element={
                        <ProtectedRoute>
                            <Suspense fallback={<PageLoader />}>
                                <Tenants />
                            </Suspense>
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/tenants" replace />} />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
