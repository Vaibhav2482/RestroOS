import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { formatCurrency } from "./orderStatusUtils";

function SummaryStat({ label, value }) {

    return (
        <Box>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography fontWeight={700}>{value}</Typography>
        </Box>
    );

}

// The single most standard POS report there is - everything a shift needs
// to close out and reconcile against the till, for exactly one day. Pulls
// together Sales Summary, Tax Summary, Payment Breakdown and Staff Sales
// (already-existing reports) rather than showing anything new, the same
// way the backend's getDayEndSummary combines their own service calls
// instead of duplicating any of their SQL.
function DayEndReportTab({ branchId, date, onDateChange }) {

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (branchId) {
            loadReport();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, date]);

    const loadReport = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await analyticsService.getDayEndSummary(branchId, date);

            if (response.success) {
                setSummary(response.data);
            } else {
                toast.error(response.message || "Failed to load the day-end summary.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load the day-end summary.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    return (

        <Box>

            <Box
                sx={{
                    display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", mb: 2,
                    // Only the report itself prints - the date picker/button
                    // row has no place on a printed close-of-day slip.
                    "@media print": { display: "none" }
                }}
            >

                <TextField
                    size="small"
                    type="date"
                    label="Date"
                    value={date}
                    onChange={(event) => onDateChange(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                />

                <Button size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!summary}>
                    Print
                </Button>

            </Box>

            {loading ? (

                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress size={28} />
                </Box>

            ) : !summary ? null : (

                <Stack spacing={2.5}>

                    <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>Sales</Typography>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: 2 }}>
                            <SummaryStat label="Total Orders" value={summary.sales.TotalOrders} />
                            <SummaryStat label="Cancelled" value={summary.sales.CancelledOrders} />
                            <SummaryStat label="Gross Sales" value={formatCurrency(summary.sales.GrossSales)} />
                            <SummaryStat label="Avg Order Value" value={formatCurrency(summary.sales.AvgOrderValue)} />
                        </Box>

                    </Paper>

                    <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>Tax (GST)</Typography>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(5, 1fr)" }, gap: 2 }}>
                            <SummaryStat label="Sub Total" value={formatCurrency(summary.tax.SubTotal)} />
                            <SummaryStat label="Discount" value={formatCurrency(summary.tax.DiscountAmount)} />
                            <SummaryStat label="CGST" value={formatCurrency(summary.tax.CgstAmount)} />
                            <SummaryStat label="SGST" value={formatCurrency(summary.tax.SgstAmount)} />
                            <SummaryStat label="Total Collected" value={formatCurrency(summary.tax.TotalAmount)} />
                        </Box>

                    </Paper>

                    <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ p: 3, pb: 1.5 }}>Payment Breakdown</Typography>

                        <Divider />

                        <TableContainer>

                            <Table size="small">

                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Orders</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Revenue</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>

                                    {summary.payments.length === 0 ? (

                                        <TableRow>
                                            <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                                                <Typography color="text.secondary" variant="body2">No orders on this day.</Typography>
                                            </TableCell>
                                        </TableRow>

                                    ) : (

                                        summary.payments.map((row) => (

                                            <TableRow key={row.PaymentMethod} hover>
                                                <TableCell>{row.PaymentMethod}</TableCell>
                                                <TableCell align="right">{row.OrderCount}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.Revenue)}</TableCell>
                                            </TableRow>

                                        ))

                                    )}

                                </TableBody>

                            </Table>

                        </TableContainer>

                    </Paper>

                    <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ p: 3, pb: 1.5 }}>Staff Sales</Typography>

                        <Divider />

                        <TableContainer>

                            <Table size="small">

                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Staff Member</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Orders</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Revenue</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>

                                    {summary.staff.length === 0 ? (

                                        <TableRow>
                                            <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                                                <Typography color="text.secondary" variant="body2">No orders on this day.</Typography>
                                            </TableCell>
                                        </TableRow>

                                    ) : (

                                        summary.staff.map((row) => (

                                            <TableRow key={row.CreatedByAdminId ?? "online"} hover>
                                                <TableCell>{row.StaffName}</TableCell>
                                                <TableCell align="right">{row.OrderCount}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.Revenue)}</TableCell>
                                            </TableRow>

                                        ))

                                    )}

                                </TableBody>

                            </Table>

                        </TableContainer>

                    </Paper>

                </Stack>

            )}

        </Box>

    );

}

export default DayEndReportTab;
