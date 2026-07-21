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

        if (error.response?.status === 401) {

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
