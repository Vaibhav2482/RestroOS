import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, getStoredAuth } from "../utils/adminAuth";

// A plain getStoredAuth() call only reflects what was true at that
// component's last render - this re-renders the caller whenever
// setStoredAuth() fires AUTH_CHANGED_EVENT, which happens after a profile
// save and after Layout.jsx's periodic permission refresh. Pages whose
// buttons/nav gate on isOwner()/hasPermission() should use this instead of
// getStoredAuth() directly, so a permission an Owner just granted shows up
// without the Branch Admin having to navigate away and back.
export function useStoredAuth() {

    const [auth, setAuth] = useState(() => getStoredAuth());

    useEffect(() => {

        const handleChange = () => setAuth(getStoredAuth());

        window.addEventListener(AUTH_CHANGED_EVENT, handleChange);
        return () => window.removeEventListener(AUTH_CHANGED_EVENT, handleChange);

    }, []);

    return auth;

}
