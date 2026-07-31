import { useState } from "react";
import {
    Avatar,
    Box,
    Button,
    Card,
    Divider,
    Grid,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import toast from "react-hot-toast";

import * as customerService from "../services/customerService";
import ImageUploadField from "../components/ImageUploadField";
import { useStorefront } from "../context/StorefrontContext";
import { getStoredAuth } from "../utils/customerAuth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Profile() {

    const { customer, login, tenantSlug } = useStorefront();

    const [fullName, setFullName] = useState(customer?.FullName ?? "");
    const [email, setEmail] = useState(customer?.Email ?? "");
    const [phone, setPhone] = useState(customer?.Phone ?? "");
    const [avatarUrl, setAvatarUrl] = useState(customer?.AvatarUrl ?? "");
    const [savingProfile, setSavingProfile] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);

    const handleSaveProfile = async () => {

        if (!fullName.trim() || !email.trim() || !phone.trim()) {
            toast.error("Name, email, and phone are all required.");
            return;
        }

        if (!EMAIL_PATTERN.test(email.trim())) {
            toast.error("Enter a valid email address.");
            return;
        }

        try {

            setSavingProfile(true);

            const response = await customerService.updateCustomer(customer.CustomerId, {
                fullName: fullName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                avatarUrl
            });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            // Read the CURRENT stored auth, not the one this handler
            // closed over at click time - if the customer logged out (or a
            // different customer logged in) while this request was in
            // flight, blindly re-applying the stale captured auth here
            // would silently log them back in right after they logged out.
            const currentAuth = getStoredAuth(tenantSlug);

            if (currentAuth?.token && String(currentAuth?.customer?.CustomerId) === String(customer.CustomerId)) {
                login({ ...currentAuth, customer: { ...currentAuth.customer, ...response.data } });
            }

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

            const response = await customerService.changePassword(customer.CustomerId, currentPassword, newPassword);

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

        <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: 720 }}>

            <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>
                My Profile
            </Typography>

            <Card sx={{ p: 3, mb: 3 }}>

                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Account</Typography>

                <Grid container spacing={2}>

                    <Grid size={12} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                        <Avatar src={avatarUrl || undefined} sx={{ bgcolor: "primary.main", width: 56, height: 56, fontSize: 24 }}>
                            {fullName?.[0]?.toUpperCase() || "U"}
                        </Avatar>
                        <Typography variant="body2" color="text.secondary">
                            Member since {customer?.CreatedAt ? new Date(customer.CreatedAt).toLocaleDateString() : "-"}
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            required
                            label="Full Name"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            required
                            label="Phone"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label="Email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <ImageUploadField label="Profile Photo" value={avatarUrl} onChange={setAvatarUrl} />
                    </Grid>

                </Grid>

                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
                    <Button variant="contained" onClick={handleSaveProfile} disabled={savingProfile}>
                        {savingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                </Box>

            </Card>

            <Card sx={{ p: 3 }}>

                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Change Password</Typography>

                <Stack spacing={2}>

                    <TextField
                        fullWidth
                        required
                        type="password"
                        label="Current Password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                    />

                    <Grid container spacing={2}>

                        <Grid size={{ xs: 12, sm: 6 }}>
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

                        <Grid size={{ xs: 12, sm: 6 }}>
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

                </Stack>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="contained" onClick={handleChangePassword} disabled={changingPassword}>
                        {changingPassword ? "Changing..." : "Change Password"}
                    </Button>
                </Box>

            </Card>

        </Box>
        </Box>

    );

}

export default Profile;
