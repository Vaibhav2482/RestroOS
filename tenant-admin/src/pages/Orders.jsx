import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
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
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { getPusherClient } from "../lib/pusherClient";
import { playNotificationSound } from "../utils/notificationSound";
import OrderDetailsDialog from "./OrderDetailsDialog";
import { formatCurrency, getNextStatuses, getStatusChipColor, isTerminalStatus } from "./orderStatusUtils";

// "All" first, then the sequence a Delivery order actually moves through -
// Dine In/Takeaway orders just never hit "Out For Delivery", which is fine
// since it'll always have a zero count for them rather than being confusing.
const STATUS_FILTERS = ["All", "Pending", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered", "Cancelled"];

function Orders() {

    const { admin } = getStoredAuth() || {};
    const ownerMode = isOwner(admin);

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState("all");

    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [advancingOrderId, setAdvancingOrderId] = useState(null);

    // Only the very first load (nothing on screen yet) shows the blocking
    // spinner. Every reload after that - after advancing a status, after
    // switching branches, or the periodic background refresh below - keeps
    // the existing table visible and just swaps in fresh data once it
    // arrives, instead of blanking the whole page out on every action.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (ownerMode) {
            loadBranches();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        loadOrders();

        // Fallback safety net in case a realtime event is ever missed (dropped
        // connection, Pusher not configured) - the Pusher subscription below
        // is what actually makes this feel live.
        const interval = setInterval(() => {

            if (document.visibilityState === "visible") {
                loadOrders(true);
            }

        }, 60000);

        return () => clearInterval(interval);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    // Realtime: subscribe to every branch this admin can see so a new order
    // or a status change made from the POS/another tab shows up immediately
    // instead of waiting for the next poll.
    useEffect(() => {

        const pusher = getPusherClient();

        if (!pusher) {
            return undefined;
        }

        const branchIds = ownerMode
            ? branches.map((branch) => branch.BranchId)
            : (admin?.BranchId ? [admin.BranchId] : []);

        if (branchIds.length === 0) {
            return undefined;
        }

        const handleStatusChange = () => loadOrders(true);

        const handleCreated = (payload) => {
            playNotificationSound();
            toast.success(`New order #${payload.orderId} received.`);
            loadOrders(true);
        };

        const channels = branchIds.map((branchId) => {
            const channel = pusher.subscribe(`private-branch-${branchId}`);
            channel.bind("order:created", handleCreated);
            channel.bind("order:status-changed", handleStatusChange);
            return channel;
        });

        return () => {

            channels.forEach((channel) => {
                channel.unbind("order:created", handleCreated);
                channel.unbind("order:status-changed", handleStatusChange);
                pusher.unsubscribe(channel.name);
            });

        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ownerMode, branches, admin?.BranchId]);

    const loadBranches = async () => {

        try {

            const response = await branchService.getAllBranches();

            if (response.success) {
                setBranches(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load branches.");

        }

    };

    const loadOrders = async (silent = false) => {

        try {

            if (!hasLoadedRef.current && !silent) {
                setLoading(true);
            }

            const branchId = ownerMode && selectedBranchId !== "all" ? selectedBranchId : undefined;

            const response = await orderService.getAllOrders(branchId);

            if (response.success) {
                setOrders(response.data);
            } else if (!silent) {
                toast.error(response.message || "Failed to load orders.");
            }

        } catch (error) {

            if (!silent) {
                toast.error(error.response?.data?.message || "Failed to load orders.");
            }

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleRowClick = (orderId) => {
        setSelectedOrderId(orderId);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setSelectedOrderId(null);
    };

    // A single-tap way to clear the most common step (front-of-house handing
    // a Ready order off as Delivered/Out For Delivery) without opening the
    // full details dialog just for that - stopPropagation keeps the click
    // from also triggering the row's own onClick, which would pop the dialog
    // right back open underneath it.
    const handleQuickAdvance = async (event, order, nextStatus) => {

        event.stopPropagation();

        try {

            setAdvancingOrderId(order.OrderId);

            const response = await orderService.updateOrderStatus(order.OrderId, nextStatus);

            if (!response.success) {
                toast.error(response.message || "Failed to update order status.");
                return;
            }

            toast.success(response.message || "Order status updated.");
            await loadOrders(true);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order status.");

        } finally {

            setAdvancingOrderId(null);

        }

    };

    const statusCounts = orders.reduce((counts, order) => {
        counts[order.OrderStatus] = (counts[order.OrderStatus] || 0) + 1;
        return counts;
    }, {});

    const filteredOrders = orders.filter((order) => {

        if (statusFilter !== "All" && order.OrderStatus !== statusFilter) {
            return false;
        }

        const query = search.trim().toLowerCase();

        if (!query) {
            return true;
        }

        const matchesId = String(order.OrderId).includes(query);
        const matchesCustomer = (order.CustomerName || "").toLowerCase().includes(query);

        return matchesId || matchesCustomer;

    });

    return (

        <Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 3 }}>

                <Typography variant="h4">Orders</Typography>

                {ownerMode && (

                    <FormControl size="small" sx={{ minWidth: 220 }}>

                        <InputLabel id="branch-filter-label">Branch</InputLabel>

                        <Select
                            labelId="branch-filter-label"
                            label="Branch"
                            value={selectedBranchId}
                            onChange={(event) => setSelectedBranchId(event.target.value)}
                        >

                            <MenuItem value="all">All Branches</MenuItem>

                            {branches.map((branch) => (
                                <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                    {branch.BranchName}
                                </MenuItem>
                            ))}

                        </Select>

                    </FormControl>

                )}

            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>

                <TextField
                    size="small"
                    placeholder="Search by order # or customer..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    sx={{ flexGrow: 1, maxWidth: { sm: 320 } }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRoundedIcon fontSize="small" sx={{ color: "text.disabled" }} />
                                </InputAdornment>
                            )
                        }
                    }}
                />

                <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: { xs: 0.5, sm: 0 } }}>

                    {STATUS_FILTERS.map((status) => {

                        const count = status === "All" ? orders.length : (statusCounts[status] || 0);
                        const selected = statusFilter === status;

                        return (
                            <Chip
                                key={status}
                                label={`${status} (${count})`}
                                onClick={() => setStatusFilter(status)}
                                color={selected ? (status === "All" ? "primary" : getStatusChipColor(status)) : "default"}
                                variant={selected ? "filled" : "outlined"}
                                sx={{ flexShrink: 0 }}
                            />
                        );

                    })}

                </Stack>

            </Stack>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    <TableContainer>

                        <Table>

                            <TableHead>

                                <TableRow>
                                    <TableCell>Order ID</TableCell>
                                    <TableCell>Customer</TableCell>
                                    {ownerMode && <TableCell>Branch</TableCell>}
                                    <TableCell>Type</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>

                            </TableHead>

                            <TableBody>

                                {filteredOrders.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={ownerMode ? 8 : 7} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">
                                                {orders.length === 0
                                                    ? "No orders found."
                                                    : "No orders match your search/filter."}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    filteredOrders.map((order) => {

                                        // Pending is the one status that always needs a human to
                                        // notice it right now - a new order sitting unhandled is
                                        // the costliest thing to miss in this list, so it gets a
                                        // visual flag the plain status chip doesn't provide.
                                        const needsAttention = order.OrderStatus === "Pending";
                                        const nextStatus = getNextStatuses(order.OrderStatus, order.DeliveryType)[0];

                                        return (

                                            <TableRow
                                                key={order.OrderId}
                                                hover
                                                onClick={() => handleRowClick(order.OrderId)}
                                                sx={{
                                                    cursor: "pointer",
                                                    borderLeft: needsAttention ? "3px solid #F59E0B" : "3px solid transparent"
                                                }}
                                            >

                                                <TableCell>#{order.OrderId}</TableCell>

                                                <TableCell>
                                                    {order.CustomerName || "Guest"}
                                                </TableCell>

                                                {ownerMode && <TableCell>{order.BranchName}</TableCell>}

                                                <TableCell>
                                                    {order.DeliveryType}
                                                    {order.DeliveryType === "Dine In" && order.TableNumber ? ` (T-${order.TableNumber})` : ""}
                                                </TableCell>

                                                <TableCell align="right">{formatCurrency(order.TotalAmount)}</TableCell>

                                                <TableCell>
                                                    <Chip
                                                        label={order.OrderStatus}
                                                        color={getStatusChipColor(order.OrderStatus)}
                                                        size="small"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    {new Date(order.OrderDate).toLocaleString()}
                                                </TableCell>

                                                <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                                                    {!isTerminalStatus(order.OrderStatus) && nextStatus && (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            disabled={advancingOrderId === order.OrderId}
                                                            onClick={(event) => handleQuickAdvance(event, order, nextStatus)}
                                                        >
                                                            {advancingOrderId === order.OrderId ? "..." : `Mark ${nextStatus}`}
                                                        </Button>
                                                    )}
                                                </TableCell>

                                            </TableRow>

                                        );

                                    })

                                )}

                            </TableBody>

                        </Table>

                    </TableContainer>

                )}

            </Paper>

            <OrderDetailsDialog
                open={dialogOpen}
                orderId={selectedOrderId}
                onClose={handleDialogClose}
                onChanged={loadOrders}
            />

        </Box>

    );

}

export default Orders;
