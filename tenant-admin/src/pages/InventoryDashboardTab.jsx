import { useEffect, useRef, useState } from "react";
import { Box, Card, CardContent, Chip, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as inventoryService from "../services/inventoryService";
import { TRANSACTION_TYPE_COLORS, TRANSACTION_TYPE_LABELS } from "../utils/units";

function StatCard({ icon, label, value, color }) {

    return (

        <Card elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>

                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${color}1A`,
                        color
                    }}
                >
                    {icon}
                </Box>

                <Box>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h5" fontWeight={800}>{value}</Typography>
                </Box>

            </CardContent>

        </Card>

    );

}

const formatDateTime = (value) => new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
});

function InventoryDashboardTab({ branchId }) {

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (branchId) {
            loadDashboard();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    const loadDashboard = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await inventoryService.getDashboard(branchId);

            if (response.success) {
                setSummary(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load the inventory dashboard.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (!summary) {
        return null;
    }

    return (

        <Box>

            <Grid container spacing={3} sx={{ mb: 4 }}>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<Inventory2OutlinedIcon />} label="Active Ingredients" value={summary.ActiveIngredients} color="#4F46E5" />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<ReportProblemOutlinedIcon />} label="Out of Stock" value={summary.OutOfStock} color="#DC2626" />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<WarningAmberOutlinedIcon />} label="Low Stock" value={summary.LowStock} color="#D97706" />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<DeleteOutlineRoundedIcon />}
                        label="Wastage (30 Days)"
                        value={Number(summary.wastage30Days?.WastageCount || 0)}
                        color="#0F766E"
                    />
                </Grid>

            </Grid>

            <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                {summary.recentTransactions.length === 0 ? (

                    <Box sx={{ py: 6, textAlign: "center" }}>
                        <Typography color="text.secondary">No stock activity yet.</Typography>
                    </Box>

                ) : (

                    <Stack divider={<Box sx={{ borderBottom: "1px solid #F0F1F5" }} />}>

                        {summary.recentTransactions.map((row) => (

                            <Box key={row.TransactionId} sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 1.5, flexWrap: "wrap" }}>

                                <Chip
                                    size="small"
                                    label={TRANSACTION_TYPE_LABELS[row.TransactionType] || row.TransactionType}
                                    color={TRANSACTION_TYPE_COLORS[row.TransactionType] || "default"}
                                    variant="outlined"
                                    sx={{ minWidth: 130 }}
                                />

                                <Typography fontWeight={600} sx={{ minWidth: 160 }}>{row.IngredientName}</Typography>

                                <Typography sx={{ fontVariantNumeric: "tabular-nums" }} color="text.secondary">
                                    {Number(row.QuantityBase) > 0 ? "+" : ""}{Number(row.EnteredQuantity)} {row.EnteredUnit}
                                </Typography>

                                <Box sx={{ flexGrow: 1 }} />

                                <Typography variant="caption" color="text.secondary">
                                    {row.ActorType === "System" ? "System" : "Staff"} · {formatDateTime(row.CreatedAt)}
                                </Typography>

                            </Box>

                        ))}

                    </Stack>

                )}

            </Paper>

        </Box>

    );

}

export default InventoryDashboardTab;
