import { Navigate } from "react-router-dom";
import { getStoredAuth, hasPermission, isFeatureEnabled } from "../utils/adminAuth";

function ProtectedRoute({ children, ownerOnly = false, permission, feature }) {

    const auth = getStoredAuth();

    if (!auth?.token) {
        return <Navigate to="/login" replace />;
    }

    if (ownerOnly && auth.admin?.BranchId) {
        return <Navigate to="/" replace />;
    }

    // permission may be a single key or an array of keys where any one of
    // them is enough (e.g. Inventory holds the Ingredients tab too, so
    // either manage_inventory or manage_ingredients should let someone in).
    // permission already folds in the tenant-level check (see hasPermission)
    // - feature is only for ownerOnly pages like Branches that have no
    // per-admin permission of their own but still need the tenant toggle.
    if (permission) {

        const required = Array.isArray(permission) ? permission : [permission];

        if (!required.some((key) => hasPermission(auth.admin, key))) {
            return <Navigate to="/" replace />;
        }

    }

    if (feature && !isFeatureEnabled(auth.admin, feature)) {
        return <Navigate to="/" replace />;
    }

    return children;

}

export default ProtectedRoute;
