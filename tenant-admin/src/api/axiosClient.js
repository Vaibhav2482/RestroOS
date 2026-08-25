import axios from "axios";

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5100/api/v1"
});

axiosClient.interceptors.request.use((config) => {

    let auth = null;

    try {
        auth = JSON.parse(localStorage.getItem("tenantAdmin"));
    } catch {
        localStorage.removeItem("tenantAdmin");
    }

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
        // reloading to /login in that case blew away the login form (and
        // its inline error toast) the user was already looking at.
        if (error.response?.status === 401 && error.config?.headers?.Authorization) {
            localStorage.removeItem("tenantAdmin");
            window.location.href = "/login";
        }

        // A platform admin (or this tenant's own Owner) can disable a
        // feature while a staff member is already logged in - the backend
        // enforces that immediately (Auth.js re-reads disabledFeatures fresh
        // on every request), but this admin's cached Permissions/
        // tenantDisabledFeatures in localStorage is still whatever it was
        // at login, so the nav/Staff dialog would keep offering something
        // that's actually dead until they log in again. The
        // "feature_disabled" code (see middleware/Auth.js) is what tells
        // this apart from an ordinary missing-permission 403, which is a
        // routine in-app rejection, not a stale session - only the former
        // forces a re-login, matching how a real SaaS app reacts to an
        // access change made elsewhere while you're mid-session.
        if (error.response?.status === 403 && error.response?.data?.errors?.code === "feature_disabled") {
            localStorage.removeItem("tenantAdmin");
            window.location.href = "/login?reason=access-changed";
        }

        return Promise.reject(error);

    }
);

export default axiosClient;
