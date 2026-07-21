import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    TextField
} from "@mui/material";

const emptyForm = {
    addressTitle: "",
    fullAddress: "",
    city: "",
    state: "",
    pincode: "",
    landmark: ""
};

// Shared create/edit form used by both the Addresses page and the Checkout
// page's "Add Address" link-out flow.
function AddressDialog({ open, onClose, onSave, address, saving }) {

    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {

        if (!open) {
            return;
        }

        if (address) {

            setFormData({
                addressTitle: address.AddressTitle || "",
                fullAddress: address.FullAddress || "",
                city: address.City || "",
                state: address.State || "",
                pincode: address.Pincode || "",
                landmark: address.Landmark || ""
            });

        } else {

            setFormData(emptyForm);

        }

    }, [open, address]);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSave(formData);
    };

    const isValid = formData.addressTitle.trim() && formData.fullAddress.trim()
        && formData.city.trim() && formData.state.trim() && formData.pincode.trim();

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle fontWeight={800}>
                {address ? "Edit Address" : "Add Address"}
            </DialogTitle>

            <Box component="form" onSubmit={handleSubmit}>

                <DialogContent sx={{ pt: 1 }}>

                    <Grid container spacing={2}>

                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                required
                                label="Address Title"
                                name="addressTitle"
                                placeholder="Home, Work, etc."
                                value={formData.addressTitle}
                                onChange={handleChange}
                            />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                required
                                multiline
                                minRows={2}
                                label="Full Address"
                                name="fullAddress"
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
