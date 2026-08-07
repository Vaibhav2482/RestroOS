import { useState } from "react";
import { Box, Button, IconButton, InputAdornment, Paper, TextField, Typography } from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import toast from "react-hot-toast";

import { login } from "../services/authService";
import { setStoredAuth } from "../utils/platformAuth";

function Login() {

    const navigate = useNavigate();

    const [formData, setFormData] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    // This is the only account on the whole platform with no self-service
    // recovery path (see resetOwnerPassword in Tenants.jsx - that resets a
    // tenant owner, not this one) - a masked typo silently locking the sole
    // operator out for MAX_FAILED_ATTEMPTS is a much bigger deal here than
    // on a login form with a "forgot password" escape hatch.
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async (event) => {

        event.preventDefault();

        try {

            setLoading(true);

            const response = await login(formData.email, formData.password);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            const { token, ...admin } = response.data;

            setStoredAuth({ token, admin });
            navigate("/tenants");

        } catch (error) {

            toast.error(error.response?.data?.message || "Login failed.");

        } finally {

            setLoading(false);

        }

    };

    return (

        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>

            <Paper elevation={0} sx={{ width: 420, maxWidth: "100%", p: 5, border: "1px solid #E5E7EB" }} component="form" onSubmit={handleSubmit}>

                <Typography variant="h5" fontWeight={800} textAlign="center" sx={{ color: "#4F46E5" }}>
                    RestroOS
                </Typography>

                <Typography textAlign="center" color="text.secondary" sx={{ mb: 4 }}>
                    Platform Admin
                </Typography>

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

                <Typography textAlign="center" sx={{ mt: 3 }}>
                    First time? <RouterLink to="/setup">Set up your account</RouterLink>
                </Typography>

            </Paper>

        </Box>

    );

}

export default Login;
