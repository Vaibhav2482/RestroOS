import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import toast from "react-hot-toast";

import { changeOwnPassword } from "../services/authService";

// This is the only in-app path to rotate this account's own password -
// before it existed, the only options were a fresh bootstrap (blocked once
// any platform admin exists) or a direct database edit.
function ChangePasswordDialog({ open, onClose }) {

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = async () => {

        if (!currentPassword) {
            toast.error("Current password is required.");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation don't match.");
            return;
        }

        try {

            setSubmitting(true);

            const response = await changeOwnPassword(currentPassword, newPassword);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Password changed.");
            handleClose();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to change password.");

        } finally {

            setSubmitting(false);

        }

    };

    return (

        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">

            <DialogTitle>Change Password</DialogTitle>

            <DialogContent>

                <Stack spacing={2} sx={{ mt: 0.5 }}>

                    <TextField
                        fullWidth
                        required
                        type="password"
                        label="Current Password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                    />

                    <TextField
                        fullWidth
                        required
                        type="password"
                        label="New Password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        helperText="At least 8 characters."
                    />

                    <TextField
                        fullWidth
                        required
                        type="password"
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                    />

                </Stack>

            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Changing..." : "Change Password"}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default ChangePasswordDialog;
