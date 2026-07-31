import { useEffect, useRef, useState } from "react";
import { Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import { useStorefront } from "../context/StorefrontContext";
import { getPusherClient } from "../lib/pusherClient";

const STATUS_COLORS = {
    "Pending": "warning",
    "Accepted": "info",
    "Preparing": "info",
    "Ready": "primary",
    "Out For Delivery": "primary",
    "Delivered": "success",
    "Cancelled": "error"
};

function statusColor(status) {
    return STATUS_COLORS[status] || "default";
}

function itemsPreview(items) {

    if (!items || items.length === 0) {
        return "No items";
    }

    const text = items.map((item) => `${item.Quantity}x ${item.ItemName}`).join(", ");

    if (text.length > 80) {
        return `${text.slice(0, 80)}...`;
    }

    return text;

}

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

function Orders() {

    const { tenantSlug, customer } = useStorefront();
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Only the very first load shows the blocking spinner - the periodic
    // background refresh below keeps the list visible and just silently
    // swaps in fresh statuses, so an order moving from Preparing to Ready
    // shows up without the customer needing to pull-to-refresh.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        let cancelled = false;

        const load = async (silent = false) => {

            if (!hasLoadedRef.current && !silent) {
                setLoading(true);
            }

            try {

                const response = await orderService.getOrdersByCustomer(customer.CustomerId);

                if (cancelled) {
                    return;
                }

                if (response.success) {
                    setOrders(response.data);
                } else if (!silent) {
                    toast.error(response.message);
                }

            } catch (error) {

                if (!cancelled && !silent) {
                    toast.error(error.response?.data?.message || "Failed to load orders.");
                }

            } finally {

                if (!cancelled) {
                    setLoading(false);
                    hasLoadedRef.current = true;
                }

            }

        };

        load();

        // Fallback safety net in case a realtime event is ever missed - the
        // Pusher subscription below is what actually makes this feel live.
        const interval = setInterval(() => {

            if (document.visibilityState === "visible") {
                load(true);
            }

        }, 30000);

        const pusher = getPusherClient();
        let channel = null;

        if (pusher && customer.CustomerId) {

            channel = pusher.subscribe(`private-customer-${customer.CustomerId}`);

            channel.bind("order:status-changed", (payload) => {
                toast.success(`Order #${payload.orderId} is now ${payload.orderStatus}.`);
                load(true);
            });

            channel.bind("order:created", () => load(true));

        }

        return () => {

            cancelled = true;
            clearInterval(interval);

            if (channel) {
                channel.unbind_all();
                pusher.unsubscribe(channel.name);
            }

        };

    }, [customer.CustomerId]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (orders.length === 0) {
        return (
            <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    You haven't placed any orders yet
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Browse the menu and place your first order.
                </Typography>
                <RouterLink to={`/${tenantSlug}`}>Browse the menu</RouterLink>
            </Box>
        );
    }

    return (

        // Matches Cart.jsx's maxWidth:720 - each row already uses its full
        // width well (name/status on the left, price on the right), so this
        // caps the line length instead of switching to a card grid, which
        // would fit a "record list" like order history worse than a menu.
        // The flex+justifyContent:center wrapper is what actually centers it -
        // maxWidth+mx:"auto" alone didn't, as a flex child of Layout's own
        // column-flex root (confirmed via screenshot on a wide screen).
        <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Box sx={{ py: 2, width: "100%", maxWidth: 720 }}>

            <Typography variant="h5" sx={{ mb: 3 }}>
                My Orders
            </Typography>

            <Stack spacing={2}>

                {orders.map((order) => (

                    <Paper
                        key={order.OrderId}
                        elevation={0}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/${tenantSlug}/orders/${order.OrderId}`)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                navigate(`/${tenantSlug}/orders/${order.OrderId}`);
                            }
                        }}
                        sx={{
                            p: 3,
                            border: "1px solid #E5E7EB",
                            cursor: "pointer",
                            transition: "border-color 0.15s",
                            "&:hover": { borderColor: "primary.main" },
                            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 }
                        }}
                    >

                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>

                            <Box>

                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                    <Typography fontWeight={700}>Order #{order.OrderId}</Typography>
                                    <Chip label={order.OrderStatus} color={statusColor(order.OrderStatus)} size="small" />
                                </Stack>

                                <Typography variant="body2" color="text.secondary">
                                    {formatDate(order.OrderDate)} &middot; {order.DeliveryType}
                                    {order.DeliveryType === "Dine In" && order.TableNumber ? ` (Table ${order.TableNumber})` : ""}
                                </Typography>

                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    {itemsPreview(order.Items)}
                                </Typography>

                            </Box>

                            <Typography variant="h6" fontWeight={700} sx={{ color: "primary.main" }}>
                                &#8377;{Number(order.TotalAmount).toFixed(2)}
                            </Typography>

                        </Stack>

                    </Paper>

                ))}

            </Stack>

        </Box>
        </Box>

    );

}

export default Orders;
