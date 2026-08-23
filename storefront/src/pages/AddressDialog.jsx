import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import EditLocationAltRoundedIcon from "@mui/icons-material/EditLocationAltRounded";

import AddressMapPicker from "../components/AddressMapPicker";

const emptyForm = {
    addressType: "Home",
    customLabel: "",
    fullAddress: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
    latitude: null,
    longitude: null
};

// AddressType is its own column, independent of the free-text
// AddressTitle - "Ira" can be typed as the title while AddressType stays
// "Home", so the list still shows a house icon next to a custom name (the
// exact case a title-only inference couldn't represent). Only needed as a
// fallback for a row saved before AddressType existed (NULL in the DB).
const inferAddressType = (title) => {

    const normalized = (title || "").trim().toLowerCase();

    if (normalized === "home") return "Home";
    if (normalized === "work") return "Work";

    return "Other";

};

// Shared create/edit form used by both the Addresses page and the Checkout
// page's "Add Address" link-out flow. Two internal steps for a NEW address:
// the full-screen map (AddressMapPicker) picks a location first, then this
// form collects the remaining details - matching Zomato/Swiggy's flow.
// Editing an existing address skips straight to the details step (its
// location is already set); "Change location" from there re-opens the map
// without losing anything already typed.
function AddressDialog({ open, onClose, onSave, address, saving }) {

    const hasMapsKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

    const [step, setStep] = useState("details");
    const [cameFromDetails, setCameFromDetails] = useState(false);
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {

        if (!open) {
            return;
        }

        if (address) {

            const addressType = address.AddressType || inferAddressType(address.AddressTitle);

            setFormData({
                addressType,
                // Blank when the saved title is exactly the type's default
                // name (nothing customized to show back) - otherwise the
                // customer's actual chosen label.
                customLabel: address.AddressTitle && address.AddressTitle !== addressType ? address.AddressTitle : "",
                fullAddress: address.FullAddress || "",
                city: address.City || "",
                state: address.State || "",
                pincode: address.Pincode || "",
                landmark: address.Landmark || "",
                latitude: address.Latitude ?? null,
                longitude: address.Longitude ?? null
            });
            setStep("details");

        } else {

            setFormData(emptyForm);
            // No Maps key configured - the map step can't render anything
            // (AddressMapPicker returns null), so go straight to plain text
            // entry rather than opening a dialog with nothing in it.
            setStep(hasMapsKey ? "map" : "details");

        }

        setCameFromDetails(false);

    }, [open, address, hasMapsKey]);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleMapConfirm = ({ latitude, longitude, formattedAddress, city, state, pincode }) => {

        setFormData((prev) => ({
            ...prev,
            latitude,
            longitude,
            // Only overwrite a still-blank field - never clobber an address
            // the customer already edited before tapping "Change location".
            fullAddress: formattedAddress && !prev.fullAddress.trim() ? formattedAddress : prev.fullAddress,
            city: city && !prev.city.trim() ? city : prev.city,
            state: state && !prev.state.trim() ? state : prev.state,
            pincode: pincode && !prev.pincode.trim() ? pincode : prev.pincode
        }));

        setStep("details");

    };

    const handleMapClose = () => {

        if (cameFromDetails) {
            setStep("details");
        } else {
            onClose();
        }

    };

    const handleChangeLocation = () => {
        setCameFromDetails(true);
        setStep("map");
    };

    const handleSubmit = (event) => {

        event.preventDefault();

        onSave({
            addressTitle: formData.customLabel.trim() || formData.addressType,
            addressType: formData.addressType,
            fullAddress: formData.fullAddress,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            landmark: formData.landmark,
            latitude: formData.latitude,
            longitude: formData.longitude
        });

    };

    const isValid = formData.fullAddress.trim() && formData.city.trim() && formData.state.trim() && formData.pincode.trim()
        && (formData.addressType !== "Other" || formData.customLabel.trim());

    if (step === "map") {

        return (
            <AddressMapPicker
                open={open}
                onClose={handleMapClose}
                onConfirm={handleMapConfirm}
            />
        );

    }

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle fontWeight={800}>
                {address ? "Edit Address" : "Add Address"}
            </DialogTitle>

            <Box component="form" onSubmit={handleSubmit}>

                <DialogContent sx={{ pt: 1 }}>

                    <Grid container spacing={2}>

                        {hasMapsKey && (formData.latitude != null) && (

                            <Grid size={{ xs: 12 }}>
                                <Button
                                    size="small"
                                    startIcon={<EditLocationAltRoundedIcon fontSize="small" />}
                                    onClick={handleChangeLocation}
                                    sx={{ px: 0 }}
                                >
                                    Change location
                                </Button>
                            </Grid>

                        )}

                        <Grid size={{ xs: 12 }}>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Save as
                            </Typography>

                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                value={formData.addressType}
                                onChange={(event, value) => value && setFormData((prev) => ({ ...prev, addressType: value }))}
                                sx={{
                                    "& .MuiToggleButton-root": {
                                        py: 1,
                                        gap: 0.75,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        "&.Mui-selected": {
                                            bgcolor: "#EEF2FF",
                                            color: "primary.main",
                                            borderColor: "primary.main",
                                            "&:hover": { bgcolor: "#E0E7FF" }
                                        }
                                    }
                                }}
                            >
                                <ToggleButton value="Home">
                                    <HomeRoundedIcon fontSize="small" />
                                    Home
                                </ToggleButton>
                                <ToggleButton value="Work">
                                    <WorkRoundedIcon fontSize="small" />
                                    Work
                                </ToggleButton>
                                <ToggleButton value="Other">
                                    <NearMeRoundedIcon fontSize="small" />
                                    Other
                                </ToggleButton>
                            </ToggleButtonGroup>

                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                required={formData.addressType === "Other"}
                                label={formData.addressType === "Other" ? "Label" : "Label (optional)"}
                                name="customLabel"
                                placeholder={formData.addressType === "Other" ? "e.g. Regus Office" : `Defaults to "${formData.addressType}"`}
                                value={formData.customLabel}
                                onChange={handleChange}
                            />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                required
                                multiline
                                minRows={2}
                                label="Complete Address"
                                name="fullAddress"
                                helperText="Add house/flat number and floor if the pinned location doesn't already include it."
                                value={formData.fullAddress}
                                onChange={handleChange}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                fullWidth
                                required
                                label="City"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                fullWidth
                                required
                                label="State"
                                name="state"
                                value={formData.state}
                                onChange={handleChange}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                fullWidth
                                required
                                label="Pincode"
                                name="pincode"
                                value={formData.pincode}
                                onChange={handleChange}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                fullWidth
                                label="Landmark (optional)"
                                name="landmark"
                                value={formData.landmark}
                                onChange={handleChange}
                            />
                        </Grid>

                    </Grid>

                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={onClose} color="inherit">Cancel</Button>
                    <Button type="submit" variant="contained" disabled={!isValid || saving}>
                        {saving ? "Saving..." : "Save Address"}
                    </Button>
                </DialogActions>

            </Box>

        </Dialog>

    );

}

export default AddressDialog;
