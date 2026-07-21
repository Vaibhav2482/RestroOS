import cloudinary from "../config/cloudinary.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { successResponse, errorResponse } from "../utils/ApiResponse.js";

export const uploadImage = asyncHandler(async (req, res) => {

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return errorResponse(res, "Image hosting is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.", 500);
    }

    if (!req.file) {
        return errorResponse(res, "No image file was uploaded.", 400);
    }

    const result = await new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                // Scoped per tenant so each restaurant's images are organized
                // separately in the shared Cloudinary account.
                folder: `restroos/tenant-${req.user.tenantId}/menu`,
                resource_type: "image",
                transformation: [{ width: 1000, height: 1000, crop: "limit", quality: "auto" }]
            },
            (error, uploadResult) => {

                if (error) {
                    reject(error);
                } else {
                    resolve(uploadResult);
                }

            }
        );

        stream.end(req.file.buffer);

    });

    return successResponse(res, { url: result.secure_url }, "Image uploaded successfully.", 201);

});
