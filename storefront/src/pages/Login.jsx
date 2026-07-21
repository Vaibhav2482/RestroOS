import { useState } from "react";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import * as customerAuthService from "../services/customerAuthService";
import { useStorefront } from "../context/StorefrontContext";

function Login() {

    const { tenantSlug } = useParams();
    const navigate = useNavigate();
    const { login, tenant } = useStorefront();

    const [formData, setFormData] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async (event) => {

        event.preventDefault();

        try {

            setLoading(true);

            const response = await customerAuthService.login(tenantSlug, formData.email.trim(), formData.password);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            const { token, ...customer } = response.data;

            login({ token, customer });
            navigate(`/${tenantSlug}`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Login failed.");

        } finally {

            setLoading(false);

        }

    };

    return (

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>

            <Paper elevation={0} sx={{ width: 420, maxWidth: "100%", p: 5, border: "1px solid #E5E7EB" }} component="form" onSubmit={handleSubmit}>

                <Typography variant="h5" fontWeight={800} textAlign="center" sx={{ color: "#4F46E5" }}>
                    {tenant?.TenantName || "Log In"}
                </Typography>

                <Typography textAlign="center" color="text.secondary" sx={{ mb: 4 }}>
                    Log in to order
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
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    margin="normal"
                />

                <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 3, height: 48 }}>
                    {loading ? "Logging in..." : "Log In"}
                </Button>

                <Typography textAlign="center" sx={{ mt: 3 }}>
                    New here? <RouterLink to={`/${tenantSlug}/register`}>Create an account</RouterLink>
                </Typography>

            </Paper>

        </Box>

    );

}

export default Login;
