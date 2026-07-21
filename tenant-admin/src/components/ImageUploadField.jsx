import { useRef, useState } from "react";
import { Box, CircularProgress, IconButton, Typography } from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import toast from "react-hot-toast";

import { uploadImage } from "../services/uploadService";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Real image upload - click/drag a file, it streams to the server, which
// hosts it on Cloudinary and hands back a CDN URL that gets stored as the
// item's ImageUrl. Replaces the old plain "paste a URL" text field.
function ImageUploadField({ label, value, onChange }) {

    const inputRef = useRef(null);

    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = async (file) => {

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error("Please choose an image file.");
            return;
        }

        if (file.size > MAX_SIZE_BYTES) {
            toast.error("Image must be smaller than 5MB.");
            return;
        }

        try {

            setUploading(true);

            const response = await uploadImage(file);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            onChange(response.data.url);
            toast.success("Image uploaded.");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to upload image.");

        } finally {

            setUploading(false);

        }

    };

    return (

        <Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {label}
            </Typography>

            <Box
                onClick={() => !uploading && inputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {

                    event.preventDefault();
                    setDragOver(false);
                    handleFile(event.dataTransfer.files?.[0]);

                }}
                sx={{
                    position: "relative",
                    height: 140,
                    borderRadius: 3,
                    border: "2px dashed",
                    borderColor: dragOver ? "#4F46E5" : "divider",
                    bgcolor: dragOver ? "#EEF2FF" : "#FAFAFA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: uploading ? "default" : "pointer",
                    overflow: "hidden",
                    transition: "border-color .15s ease, background-color .15s ease"
                }}
            >

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => handleFile(event.target.files?.[0])}
                />

                {uploading ? (

                    <CircularProgress size={28} />

                ) : value ? (

                    <>

                        <Box
                            component="img"
                            src={value}
                            alt="Preview"
                            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />

                        <IconButton
                            size="small"
                            onClick={(event) => {

                                event.stopPropagation();
                                onChange("");

                            }}
                            sx={{
                                position: "absolute",
                                top: 6,
                                right: 6,
                                bgcolor: "rgba(0,0,0,.55)",
                                color: "#fff",
                                "&:hover": { bgcolor: "rgba(0,0,0,.75)" }
                            }}
                        >
                            <CloseRoundedIcon fontSize="small" />
                        </IconButton>

                    </>

                ) : (

                    <Box sx={{ textAlign: "center", color: "text.secondary" }}>

                        <CloudUploadRoundedIcon sx={{ fontSize: 28, mb: 0.5 }} />

                        <Typography variant="body2">
                            Click or drag an image here
                        </Typography>

                        <Typography variant="caption">
                            JPG/PNG, up to 5MB
                        </Typography>

                    </Box>

                )}

            </Box>

        </Box>

    );

}

export default ImageUploadField;
