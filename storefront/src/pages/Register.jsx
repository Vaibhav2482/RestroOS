import { useState } from "react";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import * as customerAuthService from "../services/customerAuthService";
import { useStorefront } from "../context/StorefrontContext";

function Register() {

    const { tenantSlug } = useParams();
    const navigate = useNavigate();
    const { login, tenant, isLoggedIn } = useStorefront();

    const [formData, setFormData] = useState({ fullName: "", email: "", phone: "", password: "" });
    const [loading, setLoading] = useState(false);

    // Reachable via the browser Back button after a customer has already
    // logged in - without this, submitting the form here would silently log
    // them out of their current session and into a brand-new account.
    if (isLoggedIn) {
        return <Navigate to={`/${tenantSlug}`} replace />;
    }

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async (event) => {

        event.preventDefault();

        try {

            setLoading(true);

            const response = await customerAuthService.register(tenantSlug, formData);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            // Registration doesn't return a token - chain straight into login
            // with the same credentials rather than making the customer
            // retype what they just typed on a separate page.
            const loginResponse = await customerAuthService.login(tenantSlug, formData.email.trim(), formData.password);

            if (!loginResponse.success) {

                toast.success("Account created — log in to continue.");
                navigate(`/${tenantSlug}/login`);
                return;

            }

            const { token, ...customer } = loginResponse.data;

            login({ token, customer });
            toast.success(`Welcome, ${customer.FullName}!`);
            navigate(`/${tenantSlug}`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Registration failed.");

        } finally {

            setLoading(false);

        }

    };

    return (

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>

            <Paper elevation={0} sx={{ width: 420, maxWidth: "100%", p: { xs: 3, sm: 5 }, border: "1px solid #E5E7EB" }} component="form" onSubmit={handleSubmit}>

                <Typography variant="h5" fontWeight={800} textAlign="center" sx={{ color: "primary.main" }}>
                    {tenant?.TenantName || "Create Account"}
                </Typography>

                <Typography textAlign="center" color="text.secondary" sx={{ mb: 4 }}>
                    Create an account to order
                </Typography>

                <TextField
                    fullWidth
                    required
                    label="Full Name"
                    name="fullName"
                    value={formData.fullName}
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
                    label="Phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    margin="normal"
                />

                <TextField
                    fullWidth
                    required
                    label="Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    margin="normal"
                    helperText="At least 8 characters."
                />

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 2 }}>
                    By creating an account, you agree to our <RouterLink to={`/${tenantSlug}/privacy`}>Privacy Policy</RouterLink>.
                </Typography>

                <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 2, height: 48 }}>
                    {loading ? "Creating account..." : "Create Account"}
                </Button>

                <Typography textAlign="center" sx={{ mt: 3 }}>
                    Already have an account? <RouterLink to={`/${tenantSlug}/login`}>Log In</RouterLink>
                </Typography>

            </Paper>

        </Box>

    );

}

export default Register;
