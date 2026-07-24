import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Grid,
    Paper,
    Step,
    StepLabel,
    Stepper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import { useStorefront } from "../context/StorefrontContext";
import { getPusherClient } from "../lib/pusherClient";

const DELIVERY_STEPS = ["Pending", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered"];
const DINE_IN_STEPS = ["Pending", "Accepted", "Preparing", "Ready", "Delivered"];

const CANCELLABLE_STATUSES = ["Pending", "Accepted", "Preparing"];

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    return new Date(dateString).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });

}

function formatMoney(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function OrderDetail() {

    const { orderId } = useParams();
    const { tenantSlug, customer } = useStorefront();
    const navigate = useNavigate();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const fetchOrder = useCallback(async (silent = false) => {

        try {

            const response = await orderService.getOrderById(orderId);

            if (response.success) {
                setOrder(response.data);
            } else if (!silent) {
                toast.error(response.message);
            }

        } catch (error) {

            if (!silent) {
                toast.error(error.response?.data?.message || "Failed to load order.");
            }

        }

    }, [orderId]);

    useEffect(() => {

        let cancelled = false;

        (async () => {
            setLoading(true);
            await fetchOrder();
            if (!cancelled) {
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };

    }, [fetchOrder]);

    // Fallback safety net in case a realtime event is ever missed (dropped
    // connection, Pusher not configured) - the Pusher subscription below is
    // what actually makes status changes show up instantly. Stops once the
    // order reaches a terminal state - nothing left to watch for at that point.
    useEffect(() => {

        if (!order || order.OrderStatus === "Delivered" || order.OrderStatus === "Cancelled") {
            return undefined;
        }

        const interval = setInterval(() => {

            if (document.visibilityState === "visible") {
                fetchOrder(true);
            }

        }, 30000);

        return () => clearInterval(interval);

    }, [order, fetchOrder]);

    // Realtime: this customer's own channel carries status changes for all
    // of their orders - only react when the event is for the order this
    // page is showing.
    useEffect(() => {

        const pusher = getPusherClient();

        if (!pusher || !customer?.CustomerId) {
            return undefined;
        }

        const channel = pusher.subscribe(`private-customer-${customer.CustomerId}`);

        const handleStatusChanged = (payload) => {

            if (String(payload.orderId) === String(orderId)) {
                fetchOrder(true);
            }

        };

        channel.bind("order:status-changed", handleStatusChanged);

        return () => {
            channel.unbind("order:status-changed", handleStatusChanged);
            pusher.unsubscribe(channel.name);
        };

    }, [customer?.CustomerId, orderId, fetchOrder]);

    const handleCancelOrder = async () => {

        setConfirmOpen(false);

        try {

            setCancelling(true);

            const response = await orderService.cancelOrder(orderId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Order cancelled.");
            await fetchOrder();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to cancel order.");

        } finally {

            setCancelling(false);

        }

    };

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!order) {
        return (
            <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="h6">Order not found</Typography>
            </Box>
        );
    }

    const steps = order.DeliveryType === "Delivery" ? DELIVERY_STEPS : DINE_IN_STEPS;
    const isCancelled = order.OrderStatus === "Cancelled";
    const activeStep = steps.indexOf(order.OrderStatus);
    const canCancel = CANCELLABLE_STATUSES.includes(order.OrderStatus);

    return (

        <Box sx={{ py: 2 }}>

            <Typography variant="h5" sx={{ mb: 0.5 }}>
                Order #{order.OrderId}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Placed on {formatDate(order.OrderDate)}
            </Typography>

            {isCancelled ? (

                <Alert severity="error" sx={{ mb: 3 }}>
                    This order was cancelled.
                </Alert>

            ) : (

                <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>
                    <Stepper activeStep={activeStep} alternativeLabel>
                        {steps.map((step) => (
                            <Step key={step}>
                                <StepLabel>{step}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                </Paper>

            )}

            <Grid container spacing={3}>

                <Grid size={{ xs: 12, md: 7 }}>

                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>Items</Typography>

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
                                {order.Items.map((item) => (
                                    <TableRow key={item.OrderItemId}>
                                        <TableCell>{item.ItemName}</TableCell>
                                        <TableCell align="right">{formatMoney(item.Price)}</TableCell>
                                        <TableCell align="right">{item.Quantity}</TableCell>
                                        <TableCell align="right">{formatMoney(item.TotalPrice)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, ml: "auto", width: { xs: "100%", sm: 260 } }}>

                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                                <Typography variant="body2">{formatMoney(order.SubTotal)}</Typography>
                            </Box>

                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                <Typography variant="body2" color="text.secondary">CGST</Typography>
                                <Typography variant="body2">{formatMoney(order.CgstAmount)}</Typography>
                            </Box>

                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                <Typography variant="body2" color="text.secondary">SGST</Typography>
                                <Typography variant="body2">{formatMoney(order.SgstAmount)}</Typography>
                            </Box>

                            <Divider sx={{ my: 0.5 }} />

                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                <Typography fontWeight={700}>Total</Typography>
                                <Typography fontWeight={700} sx={{ color: "#4F46E5" }}>{formatMoney(order.TotalAmount)}</Typography>
                            </Box>

                        </Box>

                    </Paper>

                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>

                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>Order Info</Typography>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>

                            <Box>
                                <Typography variant="caption" color="text.secondary">Delivery Type</Typography>
                                <Typography variant="body2">
                                    {order.DeliveryType}
                                    {order.DeliveryType === "Dine In" && order.TableNumber ? ` (Table ${order.TableNumber})` : ""}
                                </Typography>
                            </Box>

                            {order.DeliveryType === "Delivery" && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Delivering To</Typography>
                                    <Typography variant="body2">Your saved address</Typography>
                                </Box>
                            )}

                            <Box>
                                <Typography variant="caption" color="text.secondary">Payment Method</Typography>
                                <Typography variant="body2">{order.PaymentMethod}</Typography>
                            </Box>

                            {order.OrderNotes && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                                    <Typography variant="body2">{order.OrderNotes}</Typography>
                                </Box>
                            )}

                        </Box>

                    </Paper>

                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>Branch</Typography>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>

                            <Typography variant="body2" fontWeight={600}>{order.BranchName}</Typography>

                            <Typography variant="body2" color="text.secondary">
                                {order.BranchAddress}, {order.BranchCity} {order.BranchPincode}
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                                {order.BranchPhone}
                            </Typography>

                        </Box>

                    </Paper>

                    {canCancel && (
                        <Button
                            fullWidth
                            color="error"
                            variant="outlined"
                            disabled={cancelling}
                            onClick={() => setConfirmOpen(true)}
                            sx={{ height: 48 }}
                        >
                            {cancelling ? "Cancelling..." : "Cancel Order"}
                        </Button>
                    )}

                    <Button
                        fullWidth
                        variant="text"
                        onClick={() => navigate(`/${tenantSlug}/orders`)}
                        sx={{ mt: 1.5 }}
                    >
                        Back to Orders
                    </Button>

                </Grid>

            </Grid>

            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>

                <DialogTitle>Cancel this order?</DialogTitle>

                <DialogContent>
                    <DialogContentText>
                        This can't be undone. Your order #{order.OrderId} will be cancelled.
                    </DialogContentText>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Keep Order</Button>
                    <Button color="error" variant="contained" onClick={handleCancelOrder}>
                        Yes, Cancel
                    </Button>
                </DialogActions>

            </Dialog>

        </Box>

    );

}

export default OrderDetail;
