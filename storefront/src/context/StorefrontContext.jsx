import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import * as publicService from "../services/publicService";
import * as cartService from "../services/cartService";
import {
    getStoredAuth,
    setStoredAuth,
    clearStoredAuth,
    getStoredBranchId,
    setStoredBranchId
} from "../utils/customerAuth";

const StorefrontContext = createContext(null);

// Everything under a "/:tenantSlug/*" route shares this: which restaurant
// we're on, which of its branches is selected (a cart can only ever hold
// items from one branch - the server enforces this too), the logged-in
// customer (if any, scoped to this tenant only), and a live cart count for
// the header badge.
export function StorefrontProvider({ children }) {

    const { tenantSlug } = useParams();

    const [tenant, setTenant] = useState(null);
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchIdState] = useState(() => getStoredBranchId(tenantSlug));
    const [auth, setAuth] = useState(() => getStoredAuth(tenantSlug));
    const [cartCount, setCartCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {

        let cancelled = false;

        (async () => {

            setLoading(true);
            setNotFound(false);

            try {

                const [tenantResponse, branchesResponse] = await Promise.all([
                    publicService.getPublicTenant(tenantSlug),
                    publicService.getActiveBranches(tenantSlug)
                ]);

                if (cancelled) {
                    return;
                }

                if (!tenantResponse.success) {
                    setNotFound(true);
                    return;
                }

                setTenant(tenantResponse.data);

                if (branchesResponse.success) {

                    setBranches(branchesResponse.data);

                    setSelectedBranchIdState((current) => {

                        const stillValid = current && branchesResponse.data.some((branch) => branch.BranchId === current);

                        if (stillValid) {
                            return current;
                        }

                        const fallback = branchesResponse.data[0]?.BranchId ?? null;

                        if (fallback) {
                            setStoredBranchId(tenantSlug, fallback);
                        }

                        return fallback;

                    });

                }

            } catch {

                setNotFound(true);

            } finally {

                if (!cancelled) {
                    setLoading(false);
                }

            }

        })();

        return () => { cancelled = true; };

    }, [tenantSlug]);

    const selectBranch = useCallback((branchId) => {
        setSelectedBranchIdState(branchId);
        setStoredBranchId(tenantSlug, branchId);
    }, [tenantSlug]);

    const login = useCallback((authData) => {
        setStoredAuth(tenantSlug, authData);
        setAuth(authData);
    }, [tenantSlug]);

    const logout = useCallback(() => {
        clearStoredAuth(tenantSlug);
        setAuth(null);
        setCartCount(0);
    }, [tenantSlug]);

    const refreshCartCount = useCallback(async () => {

        if (!auth?.customer?.CustomerId) {
            setCartCount(0);
            return;
        }

        try {

            const response = await cartService.getCart(auth.customer.CustomerId);

            if (response.success) {
                setCartCount(response.data.reduce((sum, item) => sum + item.Quantity, 0));
            }

        } catch {

            // Non-fatal - the header badge just stays at its last known value.

        }

    }, [auth]);

    useEffect(() => {
        refreshCartCount();
    }, [refreshCartCount]);

    const value = {
        tenantSlug,
        tenant,
        branches,
        selectedBranchId,
        selectBranch,
        auth,
        customer: auth?.customer ?? null,
        isLoggedIn: Boolean(auth?.token),
        login,
        logout,
        cartCount,
        refreshCartCount,
        setCartCount,
        loading,
        notFound
    };

    return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;

}

export const useStorefront = () => {

    const context = useContext(StorefrontContext);

    if (!context) {
        toast.error("Storefront context is missing - this page must be rendered inside StorefrontProvider.");
    }

    return context;

};
