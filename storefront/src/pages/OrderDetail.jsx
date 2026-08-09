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
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import { useStorefront } from "../context/StorefrontContext";
import { getPusherClient } from "../lib/pusherClient";
import BillReceipt from "../components/BillReceipt";

const DELIVERY_STEPS = ["Pending", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered"];
const DINE_IN_STEPS = ["Pending", "Accepted", "Preparing", "Ready", "Delivered"];

// Shown on the stepper only - order.OrderStatus/DELIVERY_STEPS/DINE_IN_STEPS
// stay as the real backend values (activeStep is computed from those), this
// is purely cosmetic so 6 steps' worth of labels can sit on one line each
// without wrapping into their neighbor on a ~375px phone.
const STEP_DISPLAY_LABELS = {
    Pending: "Pending",
    Accepted: "Accepted",
    Preparing: "Preparing",
    Ready: "Ready",
    "Out For Delivery": "On the way",
    Delivered: "Delivered"
};

// Matches the server's customer-side cancellation window (FRS A4) - once
// the kitchen has started (Preparing), only staff can still call it off,
// so the button doesn't appear here past Accepted even though staff's own
// screens keep it through Preparing.
const CANCELLABLE_STATUSES = ["Pending", "Accepted"];

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    // en-IN sets number/date conventions, not a timezone - without an
    // explicit timeZone this renders in the browser's local timezone, not
    // the restaurant's.
    return new Date(dateString).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata"
    });

}

function formatMoney(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function OrderDetail() {

    const { tenantSlug, tenant, customer } = useStorefront();
    const { orderId } = useParams();
    const navigate = useNavigate();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [emailingBill, setEmailingBill] = useState(false);
    const [reordering, setReordering] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [billOpen, setBillOpen] = useState(false);

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
                toast.success(`Order status updated to ${payload.orderStatus}.`);
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

        if (cancelling) {
            return;
        }

        setConfirmOpen(false);

        try {

            setCancelling(true);

            const response = await orderService.cancelOrder(orderId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message || "Order cancelled.");
            await fetchOrder();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to cancel order.");

        } finally {

            setCancelling(false);

        }

    };

    const handleEmailBill = async () => {

        try {

            setEmailingBill(true);

            const response = await orderService.emailBill(orderId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message || "Bill emailed.");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to email the bill.");

        } finally {

            setEmailingBill(false);

        }

    };

    const handleReorder = async () => {

        if (reordering) {
            return;
        }

        try {

            setReordering(true);

            const response = await orderService.reorderOrder(orderId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message);
            navigate(`/${tenantSlug}/cart`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to reorder.");

        } finally {

            setReordering(false);

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

            <Button
                startIcon={<ArrowBackRoundedIcon fontSize="small" />}
                onClick={() => navigate(`/${tenantSlug}/orders`)}
                sx={{ mb: 1.5, ml: -1 }}
            >
                Back to Orders
            </Button>

            <Box sx={{ display: "flex", alignItems: { sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 3 }}>

                <Box>
                    <Typography variant="h5" sx={{ mb: 0.5 }}>
                        Order #{order.OrderId}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        Placed on {formatDate(order.OrderDate)}
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", gap: 1.5, width: { xs: "100%", sm: "auto" }, flexWrap: "wrap" }}>

                    {!isCancelled && (

                        <>
                            <Button
                                variant="outlined"
                                startIcon={<PrintOutlinedIcon />}
                                onClick={() => setBillOpen(true)}
                                sx={{ height: 42, flex: { xs: 1, sm: "none" } }}
                            >
                                View / Print Bill
                            </Button>

                            <Button
                                variant="outlined"
                                startIcon={<EmailOutlinedIcon />}
                                disabled={emailingBill}
                                onClick={handleEmailBill}
                                sx={{ height: 42, flex: { xs: 1, sm: "none" } }}
                            >
                                {emailingBill ? "Sending..." : "Email Bill"}
                            </Button>
                        </>

                    )}

                    {/* Always available, unlike Print/Email Bill - reordering a
                        cancelled order is arguably the single most useful time
                        to offer it, the same way Swiggy/Zomato surface it. */}
                    <Button
                        variant="contained"
                        startIcon={<ReplayRoundedIcon />}
                        disabled={reordering}
                        onClick={handleReorder}
                        sx={{ height: 42, flex: { xs: 1, sm: "none" } }}
                    >
                        {reordering ? "Adding..." : "Reorder"}
                    </Button>

                </Box>

            </Box>

            {isCancelled ? (

                <Alert severity="error" sx={{ mb: 3 }}>
                    This order was cancelled.
                </Alert>

            ) : (

                <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>
                    {/* alternativeLabel packs each label into an equal-width
                        column - 6 columns leaves ~55px each on a phone, not
                        enough for text at normal size, which is what wrapped
                        and bled into neighboring steps before. Shrinking the
                        label font/icon and using shorter display text (see
                        STEP_DISPLAY_LABELS) keeps every label to one line
                        within its own column instead. */}
                    <Stepper
                        activeStep={activeStep}
                        alternativeLabel
                        sx={{
                            "& .MuiStepLabel-label": {
                                fontSize: { xs: "0.65rem", sm: "0.875rem" },
                                mt: 0.5,
                                lineHeight: 1.2,
                                whiteSpace: "nowrap"
                            },
                            "& .MuiStepIcon-root": {
                                fontSize: { xs: "1.35rem", sm: "1.5rem" }
                            }
                        }}
                    >
                        {steps.map((step) => (
                            <Step key={step}>
                                <StepLabel>{STEP_DISPLAY_LABELS[step]}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                </Paper>

            )}

            <Grid container spacing={3}>

                <Grid size={{ xs: 12, md: 7 }}>

                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>Items</Typography>

                        {/* A 4-column table needs ~420px to show Item/Price/Qty/
                            Total without squeezing the item name - a phone
                            screen doesn't have that, so scrolling the table
                            just hid the name/total off-screen by default
                            instead of actually fixing anything. Below sm this
                            drops the table for a stacked list (name + line
                            total up top, unit price x qty underneath) that
                            needs no horizontal scroll at all; sm+ keeps the
                            table since there's room for it there. */}
                        <Box sx={{ display: { xs: "block", sm: "none" } }}>

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

                                {order.Items.map((item) => (

                                    <Box key={item.OrderItemId} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>

                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography noWrap>{item.ItemName}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatMoney(item.Price)} × {item.Quantity}
                                            </Typography>
                                        </Box>

                                        <Typography fontWeight={600} sx={{ flexShrink: 0 }}>
                                            {formatMoney(item.TotalPrice)}
                                        </Typography>

                                    </Box>

                                ))}

                            </Box>

                        </Box>

                        <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
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
                        </TableContainer>

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
                                <Typography fontWeight={700} sx={{ color: "primary.main" }}>{formatMoney(order.TotalAmount)}</Typography>
                            </Box>

                        </Box>

                    </Paper>

                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>

                    {/* One card instead of two separate boxes - each row reads
                        icon + label + value, same scannable pattern as the
                        bill receipt, instead of a caption-over-value stack
                        repeated block after block. */}
                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: "1px solid #E5E7EB" }}>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

                            <Box sx={{ display: "flex", gap: 1.5 }}>
                                <LocalShippingOutlinedIcon sx={{ color: "text.secondary", fontSize: 20, mt: 0.25 }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">Delivery Type</Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                        {order.DeliveryType}
                                        {order.DeliveryType === "Dine In" && order.TableNumber ? ` (Table ${order.TableNumber})` : ""}
                                    </Typography>
                                </Box>
                            </Box>

                            {order.DeliveryType === "Delivery" && (
                                <Box sx={{ display: "flex", gap: 1.5 }}>
                                    <PlaceOutlinedIcon sx={{ color: "text.secondary", fontSize: 20, mt: 0.25 }} />
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">Delivering To</Typography>
                                        <Typography variant="body2" fontWeight={600}>Your saved address</Typography>
                                    </Box>
                                </Box>
                            )}

                            <Box sx={{ display: "flex", gap: 1.5 }}>
                                <PaymentOutlinedIcon sx={{ color: "text.secondary", fontSize: 20, mt: 0.25 }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">Payment Method</Typography>
                                    <Typography variant="body2" fontWeight={600}>{order.PaymentMethod}</Typography>
                                </Box>
                            </Box>

                            {order.OrderNotes && (
                                <Box sx={{ display: "flex", gap: 1.5 }}>
                                    <NotesOutlinedIcon sx={{ color: "text.secondary", fontSize: 20, mt: 0.25 }} />
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                                        <Typography variant="body2" fontWeight={600}>{order.OrderNotes}</Typography>
                                    </Box>
                                </Box>
                            )}

                            <Divider />

                            <Box sx={{ display: "flex", gap: 1.5 }}>
                                <StoreOutlinedIcon sx={{ color: "text.secondary", fontSize: 20, mt: 0.25 }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">Branch</Typography>
                                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>{order.BranchName}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {order.BranchAddress}, {order.BranchCity} {order.BranchPincode}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {order.BranchPhone}
                                    </Typography>
                                </Box>
                            </Box>

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
                    <Button onClick={() => setConfirmOpen(false)} disabled={cancelling}>Keep Order</Button>
                    <Button color="error" variant="contained" onClick={handleCancelOrder} disabled={cancelling}>
                        {cancelling ? "Cancelling..." : "Yes, Cancel"}
                    </Button>
                </DialogActions>

            </Dialog>

            <Dialog open={billOpen} onClose={() => setBillOpen(false)} maxWidth="xs" fullWidth>

                <DialogContent sx={{ pt: 3 }}>
                    <BillReceipt order={order} restaurantName={tenant?.TenantName} isCancelled={isCancelled} />
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setBillOpen(false)}>Close</Button>
                    <Button
                        variant="contained"
                        startIcon={<PrintOutlinedIcon />}
                        onClick={() => window.print()}
                    >
                        Print
                    </Button>
                </DialogActions>

            </Dialog>

        </Box>

    );

}

export default OrderDetail;
