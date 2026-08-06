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
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

const formatDateTime = (value) => new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// A void/cancellation report - one row per cancelled order, the same way
// PetPooja's void report lists individual voided transactions rather than
// just a daily count. RestroOS doesn't currently record WHY an order was
// cancelled (no CancelReason field on Orders), so unlike a full void
// report this only shows frequency and value, not reasons.
function CancelledOrdersReportTab({ branchId, range, onRangeChange }) {

    const [orders, setOrders] = useState([]);
    const [totalValue, setTotalValue] = useState(0);
    const [loading, setLoading] = useState(true);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

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

            const response = await analyticsService.getCancelledOrders(branchId, range.from, range.to);

            if (response.success) {
                setOrders(response.data.orders);
                setTotalValue(response.data.totalValue);
            } else {
                toast.error(response.message || "Failed to load cancelled orders.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load cancelled orders.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleExport = () => {

        downloadCsv(
            `cancelled-orders_${range.from}_to_${range.to}.csv`,
            ["Order ID", "Date", "Value", "Payment Method", "Delivery Type"],
            orders.map((row) => [`#${row.OrderId}`, formatDateTime(row.OrderDate), Number(row.TotalAmount).toFixed(2), row.PaymentMethod, row.DeliveryType])
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

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={orders.length === 0}>
                    Export CSV
                </Button>

            </Box>

            {orders.length > 0 && (

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)" }, gap: 2, mb: 2, maxWidth: 480 }}>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">Cancelled Orders</Typography>
                        <Typography fontWeight={700}>{orders.length}</Typography>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                        <Typography variant="caption" color="text.secondary">Value Lost</Typography>
                        <Typography fontWeight={700}>{formatCurrency(totalValue)}</Typography>
                    </Paper>

                </Box>

            )}

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table size="small">

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Order</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Value</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Payment</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Delivery Type</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : orders.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={5} sx={{ py: 0 }}>
                                        <EmptyState icon={<EventBusyOutlinedIcon />} title="No cancelled orders in this range" description="That's a good thing." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                orders.map((row) => (

                                    <TableRow key={row.OrderId} hover>
                                        <TableCell>#{row.OrderId}</TableCell>
                                        <TableCell>{formatDateTime(row.OrderDate)}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.TotalAmount)}</TableCell>
                                        <TableCell>{row.PaymentMethod}</TableCell>
                                        <TableCell>{row.DeliveryType}</TableCell>
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

export default CancelledOrdersReportTab;
