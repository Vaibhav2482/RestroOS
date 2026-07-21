import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";

const emptyForm = { tenantName: "", slug: "", ownerEmail: "", ownerPhone: "" };

function TenantDialog({ open, onClose, onSave }) {

    const [formData, setFormData] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async () => {

        setSaving(true);

        const success = await onSave(formData);

        setSaving(false);

        if (success) {
            setFormData(emptyForm);
        }

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle>Onboard a Restaurant</DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            required
                            label="Restaurant Name"
                            name="tenantName"
                            value={formData.tenantName}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            label="URL Slug (optional - auto-generated from name if left blank)"
                            name="slug"
                            value={formData.slug}
                            onChange={handleChange}
                            helperText="Used in the ordering link, e.g. restroos.app/order/your-slug"
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label="Owner Email"
                            name="ownerEmail"
                            value={formData.ownerEmail}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label="Owner Phone (optional)"
                            name="ownerPhone"
                            value={formData.ownerPhone}
                            onChange={handleChange}
                        />
                    </Grid>

                </Grid>

            </DialogContent>

            <DialogActions>

                <Button onClick={onClose}>Cancel</Button>

                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? "Creating..." : "Create Tenant"}
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default TenantDialog;
