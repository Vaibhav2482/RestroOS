import express from "express";
import multer from "multer";

import { uploadImage } from "../controllers/UploadController.js";
import { authenticate, authorize } from "../middleware/Auth.js";

const router = express.Router();

// Memory storage - the file is streamed straight to Cloudinary, never
// written to disk (Render's filesystem is ephemeral anyway).
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {

        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Only image files are allowed."));
            return;
        }

        cb(null, true);

    }
});

// Multer's own errors (bad type, too large) reach here via its callback
// argument, not as a thrown exception - asyncHandler can't catch those.
// Without normalizing them to a 4xx here, the global error handler treats
// them as unexpected 500s and replaces the message with a generic
// "Internal Server Error" in production, hiding the actual reason from
// the admin uploading the image.
const handleUpload = (req, res, next) => {

    upload.single("image")(req, res, (error) => {

        if (error) {

            error.statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

            if (error.code === "LIMIT_FILE_SIZE") {
                error.message = "Image must be smaller than 5MB.";
            }

            next(error);
            return;

        }

        next();

    });

};

router.post("/image", authenticate, authorize("admin"), handleUpload, uploadImage);

export default router;
