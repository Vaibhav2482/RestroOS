import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

const formatDate = (value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function SalesSummaryReportTab({ branchId, range, onRangeChange }) {

    const [daily, setDaily] = useState([]);
    const [totals, setTotals] = useState(null);
    const [loading, setLoading] = useState(true);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        // For an owner, branchId starts as "" until branches finish loading
        // (Reports.jsx) - firing the request with that placeholder hit the
        // server's ::int cast with an empty string and 500'd on every load.
        if (branchId) {
            loadReport();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, range.from, range.to]);

    const loadReport = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await analyticsService.getSalesSummary(branchId, range.from, range.to);

            if (response.success) {
                setDaily(response.data.daily);
                setTotals(response.data.totals);
            } else {
                toast.error(response.message || "Failed to load the sales summary.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load the sales summary.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleExport = () => {

        downloadCsv(
            `sales-summary_${range.from}_to_${range.to}.csv`,
            ["Date", "Total Orders", "Cancelled", "Gross Sales", "Avg Order Value"],
            daily.map((row) => {

                const completed = Number(row.TotalOrders) - Number(row.CancelledOrders);
                const aov = completed > 0 ? Number(row.GrossSales) / completed : 0;

                return [formatDate(row.Date), row.TotalOrders, row.CancelledOrders, Number(row.GrossSales).toFixed(2), aov.toFixed(2)];

            })
        );

    };

    return (

        <Box>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", mb: 2 }}>

                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>

                    <TextField
                        size="small"
                        type="date"
                        label="From"
                        value={range.from}
                        onChange={(event) => onRangeChange((prev) => ({ ...prev, from: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        size="small"
                        type="date"
                        label="To"
                        value={range.to}
                        onChange={(event) => onRangeChange((prev) => ({ ...prev, to: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                </Box>

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={daily.length === 0}>
                    Export CSV
                </Button>

            </Box>

            {totals && daily.length > 0 && (

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: 2, mb: 2 }}>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">Total Orders</Typography>
                        <Typography fontWeight={700}>{totals.TotalOrders}</Typography>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                        <Typography fontWeight={700}>{totals.CancelledOrders}</Typography>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">Gross Sales</Typography>
                        <Typography fontWeight={700}>{formatCurrency(totals.GrossSales)}</Typography>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">Avg Order Value</Typography>
                        <Typography fontWeight={700}>{formatCurrency(totals.AvgOrderValue)}</Typography>
                    </Paper>

                </Box>

            )}

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table size="small">

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Total Orders</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Cancelled</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Gross Sales</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Avg Order Value</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : daily.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={5} sx={{ py: 0 }}>
                                        <EmptyState icon={<TrendingUpOutlinedIcon />} title="No orders in this range" description="Try widening the date range." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                daily.map((row) => {

                                    const completed = Number(row.TotalOrders) - Number(row.CancelledOrders);
                                    const aov = completed > 0 ? Number(row.GrossSales) / completed : 0;

                                    return (

                                        <TableRow key={row.Date} hover>
                                            <TableCell>{formatDate(row.Date)}</TableCell>
                                            <TableCell align="right">{row.TotalOrders}</TableCell>
                                            <TableCell align="right">{row.CancelledOrders}</TableCell>
                                            <TableCell align="right">{formatCurrency(row.GrossSales)}</TableCell>
                                            <TableCell align="right">{formatCurrency(aov)}</TableCell>
                                        </TableRow>

                                    );

                                })

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            </Paper>

        </Box>

    );

}

export default SalesSummaryReportTab;
