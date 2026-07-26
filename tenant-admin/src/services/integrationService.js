import axiosClient from "../api/axiosClient";

export const getIntegrations = async () => {
    const response = await axiosClient.get("/integrations");
    return response.data;
};
