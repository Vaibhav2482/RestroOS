import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import {
    formatCurrency,
    getNextStatuses,
    getStatusChipColor,
    isTerminalStatus
} from "./orderStatusUtils";

function OrderDetailsDialog({ open, orderId, onClose, onChanged }) {

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {

        if (open && orderId) {
            loadOrder();
        }

        if (!open) {
            setOrder(null);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, orderId]);

    const loadOrder = async () => {

        try {

            setLoading(true);

            const response = await orderService.getOrderById(orderId);

            if (response.success) {
                setOrder(response.data);
            } else {
                toast.error(response.message || "Failed to load order details.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load order details.");

        } finally {

            setLoading(false);

        }

    };

    const handleAdvanceStatus = async (nextStatus) => {

        try {

            setActionLoading(true);

            const response = await orderService.updateOrderStatus(orderId, nextStatus);

            if (!response.success) {
                toast.error(response.message || "Failed to update order status.");
                return;
            }

            toast.success(response.message || "Order status updated.");
            onChanged?.();
            loadOrder();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order status.");

        } finally {

            setActionLoading(false);

        }

    };

    const handleCancel = async () => {

        try {

            setActionLoading(true);

            const response = await orderService.cancelOrder(orderId);

            if (!response.success) {
                toast.error(response.message || "Failed to cancel order.");
                return;
            }

            toast.success(response.message || "Order cancelled.");
            onChanged?.();
            loadOrder();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to cancel order.");

        } finally {

            setActionLoading(false);

        }

    };

    const nextStatuses = order ? getNextStatuses(order.OrderStatus, order.DeliveryType) : [];
    const terminal = order ? isTerminalStatus(order.OrderStatus) : false;

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                Order {order ? `#${order.OrderId}` : ""}

                <IconButton onClick={onClose} size="small">
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>

            </DialogTitle>

            <DialogContent dividers>

                {loading || !order ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    <Box>

                        <Grid container spacing={2} sx={{ mb: 2 }}>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Customer</Typography>
                                <Typography fontWeight={600}>{order.CustomerName || "Guest"}</Typography>
                                {order.CustomerPhone && (
                                    <Typography variant="body2" color="text.secondary">{order.CustomerPhone}</Typography>
                                )}
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Branch</Typography>
                                <Typography fontWeight={600}>{order.BranchName || "-"}</Typography>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Order Type</Typography>
                                <Typography fontWeight={600}>
                                    {order.DeliveryType}
                                    {order.DeliveryType === "Dine In" && order.TableNumber ? ` (Table ${order.TableNumber})` : ""}
                                </Typography>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Payment Method</Typography>
                                <Typography fontWeight={600}>{order.PaymentMethod || "-"}</Typography>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Order Date</Typography>
                                <Typography fontWeight={600}>{new Date(order.OrderDate).toLocaleString()}</Typography>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Status</Typography>
                                <Box sx={{ mt: 0.5 }}>
                                    <Chip
                                        label={order.OrderStatus}
                                        color={getStatusChipColor(order.OrderStatus)}
                                        size="small"
                                    />
                                </Box>
                            </Grid>

                            {order.OrderNotes && (
                                <Grid size={{ xs: 12 }}>
                                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                                    <Typography>{order.OrderNotes}</Typography>
                                </Grid>
                            )}

                        </Grid>

                        <Divider sx={{ mb: 2 }} />

                        <TableContainer sx={{ border: "1px solid #E5E7EB", borderRadius: 2, mb: 2 }}>

                            <Table size="small">

                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item</TableCell>
                                        <TableCell align="right">Price</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>

                                    {(order.Items || []).map((item) => (

                                        <TableRow key={item.OrderItemId}>
                                            <TableCell>{item.ItemName}</TableCell>
                                            <TableCell align="right">{formatCurrency(item.Price)}</TableCell>
                                            <TableCell align="right">{item.Quantity}</TableCell>
                                            <TableCell align="right">{formatCurrency(item.TotalPrice)}</TableCell>
                                        </TableRow>

                                    ))}

                                </TableBody>

                            </Table>

                        </TableContainer>

                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
                            <Typography variant="h6" fontWeight={700}>
                                Total: {formatCurrency(order.TotalAmount)}
                            </Typography>
                        </Box>

                        {terminal ? (

                            <Typography color="text.secondary">
                                This order is {order.OrderStatus.toLowerCase()} — no further action available.
                            </Typography>

                        ) : (

                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>

                                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                    Advance to:
                                </Typography>

                                {nextStatuses.map((status) => (

                                    <Button
                                        key={status}
                                        size="small"
                                        variant="outlined"
                                        disabled={actionLoading}
                                        onClick={() => handleAdvanceStatus(status)}
                                    >
                                        {status}
                                    </Button>

                                ))}

                                <Button
                                    size="small"
                                    color="error"
                                    variant="text"
                                    disabled={actionLoading}
                                    onClick={handleCancel}
                                    sx={{ ml: "auto" }}
                                >
                                    Cancel Order
                                </Button>

                            </Box>

                        )}

                    </Box>

                )}

            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

        </Dialog>

    );

}

export default OrderDetailsDialog;
