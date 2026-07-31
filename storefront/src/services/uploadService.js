import axiosClient from "../api/axiosClient";

export const uploadImage = async (file) => {

    const formData = new FormData();
    formData.append("image", file);

    const response = await axiosClient.post("/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });

    return response.data;

};
