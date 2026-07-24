import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Tenants from "./pages/Tenants";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route path="/" element={<Navigate to="/tenants" replace />} />

                <Route path="/login" element={<Login />} />

                <Route path="/setup" element={<Setup />} />

                <Route
                    path="/tenants"
                    element={
                        <ProtectedRoute>
                            <Tenants />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/tenants" replace />} />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
