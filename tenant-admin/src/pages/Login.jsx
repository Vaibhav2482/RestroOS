import { useState } from "react";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { login } from "../services/authService";
import { setStoredAuth } from "../utils/adminAuth";

function Login() {

    const navigate = useNavigate();

    const [formData, setFormData] = useState({ tenantSlug: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);

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

                <Typography variant="h5" fontWeight={800} textAlign="center" sx={{ color: "#4F46E5" }}>
                    RestroOS
                </Typography>

                <Typography textAlign="center" color="text.secondary" sx={{ mb: 4 }}>
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
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    margin="normal"
                />

                <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 3, height: 48 }}>
                    {loading ? "Logging in..." : "Log In"}
                </Button>

            </Paper>

        </Box>

    );

}

export default Login;
