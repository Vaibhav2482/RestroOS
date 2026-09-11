import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import * as publicService from "../services/publicService";
import * as cartService from "../services/cartService";
import * as customerAuthService from "../services/customerAuthService";
import {
    getStoredAuth,
    setStoredAuth,
    clearStoredAuth,
    getStoredBranchId,
    setStoredBranchId,
    getStoredTableNumber,
    setStoredTableNumber
} from "../utils/customerAuth";

const StorefrontContext = createContext(null);

// Everything under a "/:tenantSlug/*" route shares this: which restaurant
// we're on, which of its branches is selected (a cart can only ever hold
// items from one branch - the server enforces this too), the logged-in
// customer (if any, scoped to this tenant only), and a live cart count for
// the header badge.
export function StorefrontProvider({ children }) {

    const { tenantSlug } = useParams();
    const [searchParams] = useSearchParams();

    const [tenant, setTenant] = useState(null);
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchIdState] = useState(() => getStoredBranchId(tenantSlug));
    const [auth, setAuth] = useState(() => getStoredAuth(tenantSlug));
    // A table QR code links to "/:tenantSlug?table=N" - captured once here
    // and then carried in localStorage for the rest of the visit, since the
    // customer will navigate around the menu (losing the query param) long
    // before they reach Checkout.
    const [tableNumber, setTableNumberState] = useState(() => searchParams.get("table") || getStoredTableNumber(tenantSlug));
    const [cartCount, setCartCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {

        const fromUrl = searchParams.get("table");

        if (fromUrl) {
            setStoredTableNumber(tenantSlug, fromUrl);
            setTableNumberState(fromUrl);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, tenantSlug]);

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

                // No account required to browse/order: a first-time visitor
                // gets a silent, disposable guest session instead of hitting
                // a registration form before they can even open an item's
                // customization dialog. A returning visitor (real account or
                // an earlier guest session already in localStorage) keeps
                // whatever they already have.
                if (!getStoredAuth(tenantSlug)) {

                    try {

                        const guestResponse = await customerAuthService.createGuestSession(tenantSlug);

                        if (!cancelled && guestResponse.success) {
                            const { token, ...customer } = guestResponse.data;
                            setStoredAuth(tenantSlug, { token, customer });
                            setAuth({ token, customer });
                        }

                    } catch {

                        // Non-fatal - the customer just falls back to seeing
                        // "Log In" and browsing without a cart until they do.

                    }

                }

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

        // Logging out of a real account shouldn't drop the customer back
        // behind the registration wall - hand them a fresh guest session
        // right away so browsing/the cart keep working uninterrupted.
        customerAuthService.createGuestSession(tenantSlug)
            .then((response) => {

                if (response.success) {
                    const { token, ...customer } = response.data;
                    setStoredAuth(tenantSlug, { token, customer });
                    setAuth({ token, customer });
                }

            })
            .catch(() => {});

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
        // A guest session (see createGuestSession) counts as "logged in" for
        // everything that just needs a real CustomerId to work (cart,
        // checkout) - isGuest is the separate flag for UI decisions that
        // specifically mean "does this person have an account" (showing
        // "Log In" instead of their name, letting them reach the actual
        // Login/Register pages instead of bouncing them home).
        isGuest: Boolean(auth?.customer?.IsGuest),
        tableNumber,
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
