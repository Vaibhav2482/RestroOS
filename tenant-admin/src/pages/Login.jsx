import { useEffect, useState } from "react";
import { Box, Button, IconButton, InputAdornment, Paper, TextField, Typography } from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { login } from "../services/authService";
import { setStoredAuth } from "../utils/adminAuth";

function Login() {

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [formData, setFormData] = useState({ tenantSlug: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // axiosClient.js redirects here with this reason when a request comes
    // back tagged "feature_disabled" - the tenant's own access changed
    // (a platform admin, or this tenant's Owner, toggled a feature) since
    // this admin's session started, so their cached permissions are stale
    // rather than their login itself having expired. Told apart from a
    // plain expired-session redirect (no explanatory toast today) since
    // this one has an actual, useful reason to surface.
    useEffect(() => {

        if (searchParams.get("reason") === "access-changed") {
            toast.error("Your restaurant's access has changed. Please log in again.");
            setSearchParams({}, { replace: true });
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async (event) => {

        event.preventDefault();

        try {

            setLoading(true);

            const response = await login(formData.tenantSlug.trim(), formData.email.trim(), formData.password);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            const { token, ...admin } = response.data;

            setStoredAuth({ token, admin });
            navigate("/");

        } catch (error) {

            toast.error(error.response?.data?.message || "Login failed.");

        } finally {

            setLoading(false);

        }

    };

    return (

        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>

            <Paper elevation={0} sx={{ width: 420, maxWidth: "100%", p: 5, border: "1px solid #E5E7EB" }} component="form" onSubmit={handleSubmit}>

                <Typography variant="h5" fontWeight={800} sx={{ color: "#4F46E5", textAlign: "center" }}>
                    RestroOS
                </Typography>

                <Typography color="text.secondary" sx={{ mb: 4, textAlign: "center" }}>
                    Restaurant Admin
                </Typography>

                <TextField
                    fullWidth
                    required
                    label="Restaurant Slug"
                    name="tenantSlug"
                    placeholder="e.g. alpha-diner"
                    value={formData.tenantSlug}
                    onChange={handleChange}
                    margin="normal"
                />

                <TextField
                    fullWidth
                    required
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    margin="normal"
                />

                <TextField
                    fullWidth
                    required
                    label="Password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    margin="normal"
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        edge="end"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }
                    }}
                />

                <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 3, height: 48 }}>
                    {loading ? "Logging in..." : "Log In"}
                </Button>

            </Paper>

        </Box>

    );

}

export default Login;
