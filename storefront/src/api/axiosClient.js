import axios from "axios";
import { getTenantSlugFromPath, getStoredAuth, clearStoredAuth } from "../utils/customerAuth";

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5100/api/v1"
});

axiosClient.interceptors.request.use((config) => {

    const tenantSlug = getTenantSlugFromPath();
    const auth = tenantSlug ? getStoredAuth(tenantSlug) : null;

    if (auth?.token) {
        config.headers.Authorization = `Bearer ${auth.token}`;
    }

    return config;

});

axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {

        // Only treat this as "your session expired" if the failing request
        // actually carried a token - a 401 with no Authorization header
        // attached is just a plain wrong-password rejection from the login
        // endpoint itself, not an expired session. Wiping storage and hard-
        // reloading to the login page in that case blew away the login
        // form (and its inline error toast) the customer was looking at.
        if (error.response?.status === 401 && error.config?.headers?.Authorization) {

            const tenantSlug = getTenantSlugFromPath();

            if (tenantSlug) {
                clearStoredAuth(tenantSlug);
                window.location.href = `/${tenantSlug}/login`;
            }

        }

        return Promise.reject(error);

    }
);

export default axiosClient;
