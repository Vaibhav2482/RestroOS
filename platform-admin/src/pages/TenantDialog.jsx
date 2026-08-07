import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material";

const emptyForm = { tenantName: "", slug: "", ownerEmail: "", ownerPhone: "" };
const emptyErrors = { tenantName: "", ownerEmail: "" };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TenantDialog({ open, onClose, onSave }) {

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState(emptyErrors);
    const [saving, setSaving] = useState(false);

    // This dialog stays mounted the whole time (Tenants.jsx just toggles
    // `open`), so without this a Cancel - reopen cycle would show whatever
    // was typed into the previous, abandoned attempt. Resetting on every
    // close (not just a successful save) covers Cancel/backdrop/Escape too.
    useEffect(() => {

        if (!open) {
            setFormData(emptyForm);
            setErrors(emptyErrors);
        }

    }, [open]);

    const handleChange = (event) => {

        const { name, value } = event.target;

        setFormData((prev) => ({ ...prev, [name]: value }));

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

    };

    // Backs up the `required`/type="email" native validation (see the
    // noValidate note below) with inline messages - a native validation
    // bubble anchored to a field inside an MUI Dialog can render in the
    // wrong place or not at all depending on browser/zoom, so this is the
    // primary feedback path, not just a decoration on top of it.
    const validate = () => {

        const nextErrors = { ...emptyErrors };

        if (formData.tenantName.trim() === "") {
            nextErrors.tenantName = "Restaurant name is required.";
        }

        if (formData.ownerEmail.trim() === "") {
            nextErrors.ownerEmail = "Owner email is required.";
        } else if (!EMAIL_PATTERN.test(formData.ownerEmail.trim())) {
            nextErrors.ownerEmail = "Enter a valid email address.";
        }

        setErrors(nextErrors);

        return Object.values(nextErrors).every((error) => error === "");

    };

    const handleSubmit = async (event) => {

        event.preventDefault();

        if (!validate()) {
            return;
        }

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
                    instead of being purely cosmetic. noValidate must NOT be
                    set here - it would silently defeat that `required`
                    blocking and let handleSubmit fire with blank fields. */}
                <Box component="form" id="tenant-onboard-form" onSubmit={handleSubmit}>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            required
                            label="Restaurant Name"
                            name="tenantName"
                            value={formData.tenantName}
                            onChange={handleChange}
                            error={Boolean(errors.tenantName)}
                            helperText={errors.tenantName}
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
                            error={Boolean(errors.ownerEmail)}
                            helperText={errors.ownerEmail}
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
