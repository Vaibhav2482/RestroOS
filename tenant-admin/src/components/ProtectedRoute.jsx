import { Navigate } from "react-router-dom";
import { getStoredAuth, hasPermission } from "../utils/adminAuth";

function ProtectedRoute({ children, ownerOnly = false, permission }) {

    const auth = getStoredAuth();

    if (!auth?.token) {
        return <Navigate to="/login" replace />;
    }

    if (ownerOnly && auth.admin?.BranchId) {
        return <Navigate to="/" replace />;
    }

    if (permission && !hasPermission(auth.admin, permission)) {
        return <Navigate to="/" replace />;
    }

    return children;

}

export default ProtectedRoute;
