import { Navigate } from "react-router-dom";
import { getStoredAuth } from "../utils/platformAuth";

function ProtectedRoute({ children }) {

    const auth = getStoredAuth();

    if (!auth?.token) {
        return <Navigate to="/login" replace />;
    }

    return children;

}

export default ProtectedRoute;
