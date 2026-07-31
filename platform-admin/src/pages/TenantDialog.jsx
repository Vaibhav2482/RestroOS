import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";

const emptyForm = { tenantName: "", slug: "", ownerEmail: "", ownerPhone: "" };

function TenantDialog({ open, onClose, onSave }) {

    const [formData, setFormData] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    // This dialog stays mounted the whole time (Tenants.jsx just toggles
    // `open`), so without this a Cancel - reopen cycle would show whatever
    // was typed into the previous, abandoned attempt. Resetting on every
    // close (not just a successful save) covers Cancel/backdrop/Escape too.
    useEffect(() => {

        if (!open) {
            setFormData(emptyForm);
        }

    }, [open]);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async (event) => {

        event.preventDefault();

        setSaving(true);

        await onSave(formData);

        setSaving(false);

    };

    // Without this, Cancel/Escape/backdrop-click while the create request
    // is still in flight would close the dialog and clear formData (the
    // effect above resets on any close) while the request keeps running -
    // it can't actually be cancelled, so it still lands: the tenant gets
    // created and TemporaryPasswordDialog pops up with a one-time password
    // moments after the admin believed they'd backed out.
    const handleClose = () => {

        if (saving) {
            return;
        }

        onClose();

    };

    return (

        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" disableEscapeKeyDown={saving}>

            <DialogTitle>Onboard a Restaurant</DialogTitle>

            <DialogContent>

                {/* Unlike Login.jsx/Setup.jsx, the submit button here lives in
                    DialogActions, a sibling of DialogContent - the HTML5 `form`
                    attribute on that button (below) associates it with this
                    form by id despite being outside it in the DOM, so Enter
                    submits and `required` actually blocks empty submission
                    instead of being purely cosmetic. */}
                <Box component="form" id="tenant-onboard-form" onSubmit={handleSubmit} noValidate>

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

                </Box>

            </DialogContent>

            <DialogActions>

                <Button onClick={handleClose} disabled={saving}>Cancel</Button>

                <Button type="submit" form="tenant-onboard-form" variant="contained" disabled={saving}>
                    {saving ? "Creating..." : "Create Tenant"}
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default TenantDialog;
