import axiosClient from "../api/axiosClient";

export const login = async (email, password) => {

    const response = await axiosClient.post("/platform-admin/auth/login", { email, password });

    return response.data;

};

export const bootstrap = async (fullName, email, password) => {

    const response = await axiosClient.post("/platform-admin/auth/bootstrap", { fullName, email, password });

    return response.data;

};
