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
    TextField
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

function PaymentBreakdownReportTab({ branchId, range, onRangeChange }) {

    const [breakdown, setBreakdown] = useState([]);
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

            const response = await analyticsService.getPaymentBreakdown(branchId, range.from, range.to);

            if (response.success) {
                setBreakdown(response.data);
            } else {
                toast.error(response.message || "Failed to load the payment breakdown.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load the payment breakdown.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const totalRevenue = breakdown.reduce((sum, row) => sum + Number(row.Revenue), 0);

    const handleExport = () => {

        downloadCsv(
            `payment-breakdown_${range.from}_to_${range.to}.csv`,
            ["Payment Method", "Orders", "Revenue", "% of Total"],
            breakdown.map((row) => [
                row.PaymentMethod, row.OrderCount, Number(row.Revenue).toFixed(2),
                totalRevenue > 0 ? `${((Number(row.Revenue) / totalRevenue) * 100).toFixed(1)}%` : "0%"
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
                        onChange={(event) => onRangeChange((prev) => ({ ...prev, from: event.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />

                    <TextField
                        size="small"
                        type="date"
                        label="To"
                        value={range.to}
                        onChange={(event) => onRangeChange((prev) => ({ ...prev, to: event.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />

                </Box>

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={breakdown.length === 0}>
                    Export CSV
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Payment Method</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Orders</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Revenue</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">% of Total</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : breakdown.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={4} sx={{ py: 0 }}>
                                        <EmptyState icon={<PaidOutlinedIcon />} title="No orders in this range" description="Try widening the date range." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                breakdown.map((row) => (

                                    <TableRow key={row.PaymentMethod} hover>
                                        <TableCell>{row.PaymentMethod}</TableCell>
                                        <TableCell align="right">{row.OrderCount}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.Revenue)}</TableCell>
                                        <TableCell align="right">
                                            {totalRevenue > 0 ? `${((Number(row.Revenue) / totalRevenue) * 100).toFixed(1)}%` : "-"}
                                        </TableCell>
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

export default PaymentBreakdownReportTab;
