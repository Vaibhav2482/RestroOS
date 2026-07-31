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
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { defaultDateRange } from "../utils/dateRange";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

const formatDate = (value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function TaxSummaryReportTab({ branchId }) {

    const [range, setRange] = useState(() => defaultDateRange(30));
    const [daily, setDaily] = useState([]);
    const [totals, setTotals] = useState(null);
    const [loading, setLoading] = useState(true);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        loadReport();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, range.from, range.to]);

    const loadReport = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await analyticsService.getTaxSummary(branchId, range.from, range.to);

            if (response.success) {
                setDaily(response.data.daily);
                setTotals(response.data.totals);
            } else {
                toast.error(response.message || "Failed to load the tax summary.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load the tax summary.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleExport = () => {

        downloadCsv(
            `tax-summary_${range.from}_to_${range.to}.csv`,
            ["Date", "Orders", "Subtotal", "Discount", "CGST", "SGST", "Total"],
            daily.map((row) => [
                formatDate(row.Date), row.OrderCount, Number(row.SubTotal).toFixed(2), Number(row.DiscountAmount).toFixed(2),
                Number(row.CgstAmount).toFixed(2), Number(row.SgstAmount).toFixed(2), Number(row.TotalAmount).toFixed(2)
            ])
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
                        onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        size="small"
                        type="date"
                        label="To"
                        value={range.to}
                        onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
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
                        <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                        <Typography fontWeight={700}>{formatCurrency(totals.SubTotal)}</Typography>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">CGST</Typography>
                        <Typography fontWeight={700}>{formatCurrency(totals.CgstAmount)}</Typography>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">SGST</Typography>
                        <Typography fontWeight={700}>{formatCurrency(totals.SgstAmount)}</Typography>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">Total Collected</Typography>
                        <Typography fontWeight={700}>{formatCurrency(totals.TotalAmount)}</Typography>
                    </Paper>

                </Box>

            )}

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table size="small">

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Orders</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Subtotal</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Discount</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">CGST</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">SGST</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : daily.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={7} sx={{ py: 0 }}>
                                        <EmptyState icon={<ReceiptLongOutlinedIcon />} title="No orders in this range" description="Try widening the date range." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                daily.map((row) => (

                                    <TableRow key={row.Date} hover>
                                        <TableCell>{formatDate(row.Date)}</TableCell>
                                        <TableCell align="right">{row.OrderCount}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.SubTotal)}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.DiscountAmount)}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.CgstAmount)}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.SgstAmount)}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.TotalAmount)}</TableCell>
                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            </Paper>

        </Box>

    );

}

export default TaxSummaryReportTab;
