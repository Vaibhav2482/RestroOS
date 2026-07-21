import { useState } from "react";
import { Box, Button, Paper, TextField, Typography, Alert } from "@mui/material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import toast from "react-hot-toast";

import { bootstrap } from "../services/authService";

// Only reachable while no platform admin exists yet - the backend refuses
// this once the first account is created, so this page becomes permanently
// inert after first use (not deleted, just always fails past that point).
function Setup() {

    const navigate = useNavigate();

    const [formData, setFormData] = useState({ fullName: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async (event) => {

        event.preventDefault();

        try {

            setLoading(true);

            const response = await bootstrap(formData.fullName, formData.email, formData.password);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Platform admin account created. Please log in.");
            navigate("/login");

        } catch (error) {

            toast.error(error.response?.data?.message || "Setup failed.");

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

                <Typography textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
                    First-time setup
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                    This creates the one platform admin account. It only works once.
                </Alert>

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
                    label="Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    margin="normal"
                />

                <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 3, height: 48 }}>
                    {loading ? "Creating..." : "Create Platform Admin Account"}
                </Button>

                <Typography textAlign="center" sx={{ mt: 3 }}>
                    Already set up? <RouterLink to="/login">Log in</RouterLink>
                </Typography>

            </Paper>

        </Box>

    );

}

export default Setup;
