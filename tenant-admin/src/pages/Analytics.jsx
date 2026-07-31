import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import RestaurantMenuOutlinedIcon from "@mui/icons-material/RestaurantMenuOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { formatCurrency } from "./orderStatusUtils";
import { toDateInputValue } from "../utils/dateRange";

const RANGE_PRESETS = [
    { label: "7D", days: 7 },
    { label: "30D", days: 30 },
    { label: "90D", days: 90 }
];

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

function Analytics() {

    const { admin } = getStoredAuth() || {};
    const ownerMode = isOwner(admin);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState("");
    const [rangeDays, setRangeDays] = useState(30);

    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [branchComparison, setBranchComparison] = useState([]);

    const { from, to } = useMemo(() => {

        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);

        return { from: toDateInputValue(fromDate), to: toDateInputValue(toDate) };

    }, [rangeDays]);

    useEffect(() => {

        if (!ownerMode) {
            return;
        }

        (async () => {

            try {

                const response = await branchService.getAllBranches();

                if (response.success) {
                    setBranches(response.data);
                }

            } catch {

                toast.error("Failed to load branches.");

            }

        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        (async () => {

            try {

                setLoading(true);

                const branchId = ownerMode ? (selectedBranchId || undefined) : undefined;

                const requests = [analyticsService.getOverview(branchId, from, to)];

                if (ownerMode) {
                    requests.push(analyticsService.getBranchComparison(from, to));
                }

                const [overviewResponse, branchResponse] = await Promise.all(requests);

                if (overviewResponse.success) {
                    setOverview(overviewResponse.data);
                } else {
                    toast.error(overviewResponse.message || "Failed to load analytics.");
                }

                if (branchResponse) {

                    if (branchResponse.success) {
                        setBranchComparison(branchResponse.data);
                    } else {
                        toast.error(branchResponse.message || "Failed to load branch comparison.");
                    }

                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load analytics.");

            } finally {

                setLoading(false);

            }

        })();

    }, [ownerMode, selectedBranchId, from, to]);

    const revenueTrend = overview?.revenueTrend || [];
    const topItems = overview?.topItems || [];
    const peakHours = overview?.peakHours || [];

    // CogsValue/WastageValue arrive as null (not 0) when at least one
    // consumed/wasted ingredient in range has no CostPerBaseUnit set - a
    // fabricated "the cost was ₹0" is worse than admitting it's unknown,
    // so Gross Margin is only computed when the COGS figure is real.
    const cogsValue = overview?.cogs?.CogsValue !== null && overview?.cogs?.CogsValue !== undefined ? Number(overview.cogs.CogsValue) : null;
    const wastageValue = overview?.cogs?.WastageValue !== null && overview?.cogs?.WastageValue !== undefined ? Number(overview.cogs.WastageValue) : null;
    const ingredientsMissingCost = Number(overview?.cogs?.IngredientsMissingCost || 0);
    const grossMargin = cogsValue !== null ? Number(overview?.summary?.Revenue || 0) - cogsValue : null;

    // Every hour 0-23 gets a bar even with zero orders, so the chart's
    // x-axis stays a stable full day instead of jumping around based on
    // which hours happened to have activity in the selected range.
    const peakHoursByHour = useMemo(() => {

        const counts = new Array(24).fill(0);

        peakHours.forEach((row) => {
            counts[row.Hour] = Number(row.OrderCount);
        });

        return counts;

    }, [peakHours]);

    return (

        <Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 3 }}>

                <Typography variant="h4">Analytics</Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>

                    {ownerMode && branches.length > 0 && (

                        <Select
                            size="small"
                            value={selectedBranchId}
                            onChange={(event) => setSelectedBranchId(event.target.value)}
                            displayEmpty
                            sx={{ minWidth: 180 }}
                        >
                            <MenuItem value="">All Branches</MenuItem>
                            {branches.map((branch) => (
                                <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                    {branch.BranchName}
                                </MenuItem>
                            ))}
                        </Select>

                    )}

                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={rangeDays}
                        onChange={(event, value) => value && setRangeDays(value)}
                    >
                        {RANGE_PRESETS.map((preset) => (
                            <ToggleButton key={preset.days} value={preset.days} sx={{ px: 2 }}>
                                {preset.label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                </Box>

            </Box>

            {loading && !overview ? (

                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress size={28} />
                </Box>

            ) : (

                <>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5, mb: 3 }}>

                        <StatCard
                            icon={<PaidOutlinedIcon />}
                            label="Revenue"
                            value={formatCurrency(overview?.summary?.Revenue)}
                            color="#0F766E"
                        />

                        <StatCard
                            icon={<ReceiptLongOutlinedIcon />}
                            label="Orders"
                            value={overview?.summary?.OrderCount ?? 0}
                            color="#4F46E5"
                        />

                        <StatCard
                            icon={<TrendingUpOutlinedIcon />}
                            label="Avg Order Value"
                            value={formatCurrency(overview?.summary?.AvgOrderValue)}
                            color="#F59E0B"
                        />

                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5, mb: 1.5 }}>

                        <StatCard
                            icon={<RestaurantMenuOutlinedIcon />}
                            label="Cost of Goods Sold"
                            value={cogsValue !== null ? formatCurrency(cogsValue) : "Incomplete"}
                            color="#9333EA"
                        />

                        <StatCard
                            icon={<SavingsOutlinedIcon />}
                            label="Gross Margin"
                            value={grossMargin !== null ? formatCurrency(grossMargin) : "Incomplete"}
                            color="#0F766E"
                        />

                        <StatCard
                            icon={<DeleteOutlineRoundedIcon />}
                            label="Wastage Value"
                            value={wastageValue !== null ? formatCurrency(wastageValue) : "Incomplete"}
                            color="#DC2626"
                        />

                    </Box>

                    {ingredientsMissingCost > 0 && (

                        <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mb: 3 }}>
                            {ingredientsMissingCost} ingredient{ingredientsMissingCost === 1 ? "" : "s"} used in this range
                            {" "}{ingredientsMissingCost === 1 ? "has" : "have"} no cost set, so COGS/margin above are incomplete.
                            Add a cost under Inventory → Ingredients to complete the picture.
                        </Alert>

                    )}

                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>Revenue Trend</Typography>

                        {revenueTrend.length === 0 ? (

                            <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
                                No orders in this range yet.
                            </Typography>

                        ) : (

                            <LineChart
                                height={280}
                                xAxis={[{
                                    scaleType: "point",
                                    data: revenueTrend.map((row) => new Date(row.Date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }))
                                }]}
                                series={[{
                                    data: revenueTrend.map((row) => Number(row.Revenue)),
                                    label: "Revenue",
                                    color: "#4F46E5",
                                    area: true,
                                    curve: "monotoneX"
                                }]}
                                grid={{ horizontal: true }}
                            />

                        )}

                    </Paper>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, mb: 3 }}>

                        <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB" }}>

                            <Typography fontWeight={700} sx={{ mb: 2 }}>Top Selling Items</Typography>

                            {topItems.length === 0 ? (

                                <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                                    No items sold in this range yet.
                                </Typography>

                            ) : (

                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>

                                    {topItems.map((item, index) => (

                                        <Box key={item.ItemName} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>

                                            <Typography variant="body2" color="text.secondary" sx={{ width: 20, flexShrink: 0 }}>
                                                {index + 1}
                                            </Typography>

                                            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                                {item.ItemName}
                                            </Typography>

                                            <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
                                                {item.QuantitySold}x
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" sx={{ width: 90, textAlign: "right", flexShrink: 0 }}>
                                                {formatCurrency(item.Revenue)}
                                            </Typography>

                                        </Box>

                                    ))}

                                </Box>

                            )}

                        </Paper>

                        <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB" }}>

                            <Typography fontWeight={700} sx={{ mb: 2 }}>Orders by Hour</Typography>

                            <BarChart
                                height={280}
                                xAxis={[{ scaleType: "band", data: peakHoursByHour.map((_, hour) => `${hour}`) }]}
                                series={[{ data: peakHoursByHour, label: "Orders", color: "#0F766E" }]}
                                grid={{ horizontal: true }}
                            />

                        </Paper>

                    </Box>

                    {ownerMode && (

                        <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                            <Typography fontWeight={700} sx={{ p: 3, pb: 2 }}>Branch Comparison</Typography>

                            <TableContainer>

                                <Table>

                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Branch</TableCell>
                                            <TableCell align="right">Orders</TableCell>
                                            <TableCell align="right">Revenue</TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>

                                        {branchComparison.length === 0 ? (

                                            <TableRow>
                                                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                                                    <Typography color="text.secondary">No branches yet.</Typography>
                                                </TableCell>
                                            </TableRow>

                                        ) : (

                                            branchComparison.map((branch) => (

                                                <TableRow key={branch.BranchId} hover>
                                                    <TableCell>{branch.BranchName}</TableCell>
                                                    <TableCell align="right">{branch.OrderCount}</TableCell>
                                                    <TableCell align="right">{formatCurrency(branch.Revenue)}</TableCell>
                                                </TableRow>

                                            ))

                                        )}

                                    </TableBody>

                                </Table>

                            </TableContainer>

                        </Paper>

                    )}

                </>

            )}

        </Box>

    );

}

export default Analytics;
