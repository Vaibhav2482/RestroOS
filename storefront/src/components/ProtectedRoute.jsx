import { Navigate, useParams } from "react-router-dom";
import { useStorefront } from "../context/StorefrontContext";

// Guards routes that need a logged-in customer (checkout, orders, addresses).
// Must be rendered inside StorefrontProvider.
function ProtectedRoute({ children }) {

    const { tenantSlug } = useParams();
    const { isLoggedIn, loading } = useStorefront();

    if (loading) {
        return null;
    }

    if (!isLoggedIn) {
        return <Navigate to={`/${tenantSlug}/login`} replace />;
    }

    return children;

}

export default ProtectedRoute;
