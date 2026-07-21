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

        if (error.response?.status === 401) {
            localStorage.removeItem("platformAdmin");
            window.location.href = "/login";
        }

        return Promise.reject(error);

    }
);

export default axiosClient;
