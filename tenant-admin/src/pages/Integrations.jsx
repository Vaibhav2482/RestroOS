import { useEffect, useState } from "react";
import { Box, Chip, CircularProgress, Grid, Paper, Typography } from "@mui/material";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import toast from "react-hot-toast";

import * as integrationService from "../services/integrationService";

function IntegrationCard({ integration }) {

    return (

        <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB", height: "100%" }}>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <StorefrontOutlinedIcon sx={{ color: "#4F46E5" }} />
                    <Typography variant="h6" fontWeight={700}>{integration.name}</Typography>
                </Box>

                <Chip label={integration.statusLabel} size="small" sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 600 }} />

            </Box>

            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                {integration.description}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                {integration.note}
            </Typography>

        </Paper>

    );

}

function Integrations() {

    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        (async () => {

            try {

                const response = await integrationService.getIntegrations();

                if (response.success) {
                    setIntegrations(response.data);
                } else {
                    toast.error(response.message || "Failed to load integrations.");
                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load integrations.");

            } finally {

                setLoading(false);

            }

        })();

    }, []);

    return (

        <Box>

            <Typography variant="h4" sx={{ mb: 1 }}>Integrations</Typography>

            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
                Order aggregator platforms like Zomato and Swiggy gate their POS integration
                programs behind their own eligibility requirements, not a self-serve signup -
                here's what's planned and why it isn't connected yet.
            </Typography>

            {loading ? (

                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress size={28} />
                </Box>

            ) : (

                <Grid container spacing={2.5}>

                    {integrations.map((integration) => (
                        <Grid key={integration.key} size={{ xs: 12, sm: 6, md: 4 }}>
                            <IntegrationCard integration={integration} />
                        </Grid>
                    ))}

                </Grid>

            )}

        </Box>

    );

}

export default Integrations;
