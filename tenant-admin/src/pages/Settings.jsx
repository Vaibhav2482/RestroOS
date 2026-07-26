import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Paper, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import toast from "react-hot-toast";

import * as tenantService from "../services/tenantService";
import ImageUploadField from "../components/ImageUploadField";

// A curated palette rather than a raw color picker - keeps every tenant's
// storefront looking deliberately designed (readable text/button contrast
// already checked) instead of accidentally landing on something illegible.
const THEME_PRESETS = [
    { name: "Terracotta", color: "#D33C33" },
    { name: "Indigo", color: "#4F46E5" },
    { name: "Teal", color: "#0F766E" },
    { name: "Amber", color: "#D97706" },
    { name: "Rose", color: "#E11D48" },
    { name: "Emerald", color: "#059669" },
    { name: "Slate", color: "#334155" }
];

function Settings() {

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUrl, setLogoUrl] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#4F46E5");

    useEffect(() => {

        (async () => {

            try {

                const response = await tenantService.getOwnTenant();

                if (response.success) {
                    setLogoUrl(response.data.LogoUrl || "");
                    setPrimaryColor(response.data.PrimaryColor || "#4F46E5");
                } else {
                    toast.error(response.message || "Failed to load restaurant settings.");
                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load restaurant settings.");

            } finally {

                setLoading(false);

            }

        })();

    }, []);

    const handleSave = async () => {

        try {

            setSaving(true);

            const response = await tenantService.updateBranding({ logoUrl, primaryColor });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message || "Branding updated.");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update branding.");

        } finally {

            setSaving(false);

        }

    };

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    return (

        <Box>

            <Typography variant="h4" sx={{ mb: 1 }}>Branding</Typography>

            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
                Your logo and theme color show up on your storefront - the ordering site your
                customers see at your restaurant's own link.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB", maxWidth: 520 }}>

                <Box sx={{ mb: 3 }}>
                    <ImageUploadField label="Restaurant Logo" value={logoUrl} onChange={setLogoUrl} />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Theme Color
                </Typography>

                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 3 }}>

                    {THEME_PRESETS.map((preset) => (

                        <Box
                            key={preset.color}
                            onClick={() => setPrimaryColor(preset.color)}
                            title={preset.name}
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                bgcolor: preset.color,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "2px solid",
                                borderColor: primaryColor === preset.color ? "#111827" : "transparent",
                                outline: "2px solid",
                                outlineColor: primaryColor === preset.color ? preset.color : "transparent",
                                outlineOffset: 2,
                                transition: "outline-color .15s ease, border-color .15s ease"
                            }}
                        >
                            {primaryColor === preset.color && <CheckRoundedIcon sx={{ color: "#fff", fontSize: 20 }} />}
                        </Box>

                    ))}

                    <Box
                        component="label"
                        title="Custom color"
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px dashed",
                            borderColor: "divider",
                            background: "conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)",
                            position: "relative",
                            overflow: "hidden"
                        }}
                    >
                        <input
                            type="color"
                            value={primaryColor}
                            onChange={(event) => setPrimaryColor(event.target.value)}
                            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                        />
                    </Box>

                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>

                    <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: primaryColor, border: "1px solid #E5E7EB" }} />

                    <Typography variant="body2" color="text.secondary">
                        {primaryColor.toUpperCase()}
                    </Typography>

                </Box>

                <Button
                    variant="contained"
                    disabled={saving}
                    onClick={handleSave}
                    sx={{ height: 44, px: 4 }}
                >
                    {saving ? "Saving..." : "Save Branding"}
                </Button>

            </Paper>

        </Box>

    );

}

export default Settings;
