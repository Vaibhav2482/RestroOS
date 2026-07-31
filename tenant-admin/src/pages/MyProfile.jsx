import { useState } from "react";
import {
    Avatar,
    Box,
    Button,
    Chip,
    Divider,
    Grid,
    Paper,
    TextField,
    Typography
} from "@mui/material";
import toast from "react-hot-toast";

import * as adminService from "../services/adminService";
import ImageUploadField from "../components/ImageUploadField";
import { getStoredAuth, setStoredAuth, isOwner } from "../utils/adminAuth";

function MyProfile() {

    const auth = getStoredAuth();
    const admin = auth?.admin;
    const owner = isOwner(admin);

    const [fullName, setFullName] = useState(admin?.FullName ?? "");
    const [avatarUrl, setAvatarUrl] = useState(admin?.AvatarUrl ?? "");
    const [savingProfile, setSavingProfile] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);

    const handleSaveProfile = async () => {

        if (!fullName.trim()) {
            toast.error("Full name is required.");
            return;
        }

        try {

            setSavingProfile(true);

            const response = await adminService.updateOwnProfile({ fullName: fullName.trim(), avatarUrl });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            // Refresh the cached auth so the header avatar/name update
            // immediately without needing a re-login.
            setStoredAuth({ ...auth, admin: { ...admin, ...response.data } });

            toast.success("Profile updated.");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update profile.");

        } finally {

            setSavingProfile(false);

        }

    };

    const handleChangePassword = async () => {

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

            setChangingPassword(true);

            const response = await adminService.changeOwnPassword(currentPassword, newPassword);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Password changed.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to change password.");

        } finally {

            setChangingPassword(false);

        }

    };

    return (

        <Box sx={{ maxWidth: 720 }}>

            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>My Profile</Typography>
                <Typography variant="body2" color="text.secondary">
                    Manage your personal account details and login password.
                </Typography>
            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", p: 3, mb: 3 }}>

                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Account</Typography>

                <Grid container spacing={2}>

                    <Grid size={12} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                        <Avatar src={avatarUrl || undefined} sx={{ bgcolor: "#4F46E5", width: 56, height: 56, fontSize: 24 }}>
                            {fullName?.[0]?.toUpperCase() || "A"}
                        </Avatar>
                        <Box>
                            <Typography fontWeight={600}>{admin?.Email}</Typography>
                            <Chip
                                label={owner ? "Owner" : "Branch Admin"}
                                size="small"
                                color={owner ? "primary" : "default"}
                                sx={{ mt: 0.5 }}
                            />
                        </Box>
                    </Grid>

                    <Grid size={12} sm={6}>
                        <TextField
                            fullWidth
                            required
                            label="Full Name"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                        />
                    </Grid>

                    <Grid size={12} sm={6}>
                        <ImageUploadField label="Profile Photo" value={avatarUrl} onChange={setAvatarUrl} />
                    </Grid>

                </Grid>

                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
                    <Button variant="contained" onClick={handleSaveProfile} disabled={savingProfile}>
                        {savingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                </Box>

            </Paper>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", p: 3 }}>

                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Change Password</Typography>

                <Grid container spacing={2}>

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            required
                            type="password"
                            label="Current Password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            autoComplete="current-password"
                        />
                    </Grid>

                    <Grid size={12} sm={6}>
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
                    </Grid>

                    <Grid size={12} sm={6}>
                        <TextField
                            fullWidth
                            required
                            type="password"
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            autoComplete="new-password"
                        />
                    </Grid>

                </Grid>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="contained" onClick={handleChangePassword} disabled={changingPassword}>
                        {changingPassword ? "Changing..." : "Change Password"}
                    </Button>
                </Box>

            </Paper>

        </Box>

    );

}

export default MyProfile;
