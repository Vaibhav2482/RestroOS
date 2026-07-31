import axios from "axios";

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5100/api/v1"
});

axiosClient.interceptors.request.use((config) => {

    let auth = null;

    try {
        auth = JSON.parse(localStorage.getItem("platformAdmin"));
    } catch {
        localStorage.removeItem("platformAdmin");
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
            localStorage.removeItem("platformAdmin");
            window.location.href = "/login";
        }

        return Promise.reject(error);

    }
);

export default axiosClient;
