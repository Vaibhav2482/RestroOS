import { useEffect, useRef, useState } from "react";
import { Box, Card, CardContent, Chip, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as inventoryService from "../services/inventoryService";
import { TRANSACTION_TYPE_COLORS, TRANSACTION_TYPE_LABELS } from "../utils/units";
import EmptyState from "../components/EmptyState";

function StatCard({ icon, label, value, caption, color, onClick }) {

    return (

        <Card
            elevation={0}
            sx={{
                border: "1px solid #E5E7EB",
                ...(onClick && {
                    cursor: "pointer",
                    transition: "border-color .15s, box-shadow .15s",
                    "&:hover": { borderColor: color, boxShadow: `0 0 0 3px ${color}1A` }
                })
            }}
            onClick={onClick}
        >

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
                        color,
                        flexShrink: 0
                    }}
                >
                    {icon}
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h5" fontWeight={800}>{value}</Typography>
                    {caption && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {caption}
                        </Typography>
                    )}
                </Box>

            </CardContent>

        </Card>

    );

}

const formatDateTime = (value) => new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
});

// Tab indices mirror Inventory.jsx's TABS array (Dashboard, Ingredients,
// Branch Stock, Transactions) - a stat card click jumps straight to the
// tab that explains the number, instead of leaving the user to hunt for it.
const TAB_INGREDIENTS = 1;
const TAB_BRANCH_STOCK = 2;
const TAB_TRANSACTIONS = 3;

function InventoryDashboardTab({ branchId, onNavigate }) {

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

    // "N events" alone doesn't say whether that's ₹50 or ₹5,000 of loss - an
    // owner cares about the cost, not the count. Falls back to the count if
    // every wasted ingredient this period happens to have no cost set,
    // rather than showing a misleading "₹0" (same honesty convention the
    // Valuation report uses for ingredients missing a cost).
    const wastageCount = Number(summary.wastage30Days?.WastageCount || 0);
    const wastageMissingCost = Number(summary.wastage30Days?.WastageMissingCost || 0);
    const wastageHasCostData = wastageCount > 0 && wastageMissingCost < wastageCount;
    const wastageValue = wastageHasCostData
        ? `₹${Number(summary.wastage30Days.TotalWastageValue).toFixed(0)}`
        : wastageCount;
    const wastageCaption = wastageCount === 0
        ? undefined
        : wastageHasCostData
            ? `${wastageCount} event${wastageCount === 1 ? "" : "s"}${wastageMissingCost > 0 ? ` · ${wastageMissingCost} missing cost` : ""}`
            : "no cost data set";

    return (

        <Box>

            <Grid container spacing={3} sx={{ mb: 4 }}>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<Inventory2OutlinedIcon />}
                        label="Active Ingredients"
                        value={summary.ActiveIngredients}
                        color="#4F46E5"
                        onClick={onNavigate && (() => onNavigate(TAB_INGREDIENTS))}
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<ReportProblemOutlinedIcon />}
                        label="Out of Stock"
                        value={summary.OutOfStock}
                        color="#DC2626"
                        onClick={onNavigate && (() => onNavigate(TAB_BRANCH_STOCK))}
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<WarningAmberOutlinedIcon />}
                        label="Low Stock"
                        value={summary.LowStock}
                        color="#D97706"
                        onClick={onNavigate && (() => onNavigate(TAB_BRANCH_STOCK))}
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<DeleteOutlineRoundedIcon />}
                        label="Wastage (30 Days)"
                        value={wastageValue}
                        caption={wastageCaption}
                        color="#0F766E"
                        onClick={onNavigate && (() => onNavigate(TAB_TRANSACTIONS))}
                    />
                </Grid>

            </Grid>

            <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                {summary.recentTransactions.length === 0 ? (

                    <EmptyState
                        icon={<Inventory2OutlinedIcon />}
                        title="No stock activity yet"
                        description="Restocks, wastage, and adjustments will show up here as they happen."
                    />

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
                                    {Number(row.QuantityBase) > 0 ? "+" : Number(row.QuantityBase) < 0 ? "-" : ""}{Number(row.EnteredQuantity)} {row.EnteredUnit}
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
