import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    IconButton,
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
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import SoupKitchenOutlinedIcon from "@mui/icons-material/SoupKitchenOutlined";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { getPusherClient } from "../lib/pusherClient";
import { playNotificationSound } from "../utils/notificationSound";
import OrderDetailsDialog from "./OrderDetailsDialog";
import EmptyState from "../components/EmptyState";
import BillReceipt from "../components/BillReceipt";
import KotReceipt from "../components/KotReceipt";
import PrintDialog from "../components/PrintDialog";
import { formatCurrency, formatDateTime, getNextStatuses, getStatusChipColor, isTerminalStatus } from "./orderStatusUtils";
import { toDateInputValue } from "../utils/dateRange";

// "All" first, then the sequence a Delivery order actually moves through -
// Dine In/Takeaway orders just never hit "Out For Delivery", which is fine
// since it'll always have a zero count for them rather than being confusing.
const STATUS_FILTERS = ["All", "Pending", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered", "Cancelled"];

// Soft tinted pills rather than MUI's solid filled chips. With ~92% of a
// mature order list sitting on "Delivered", a wall of saturated green was
// drawing the eye to the one thing nobody needs to look at; muting the
// settled states lets Pending and Cancelled actually stand out.
const STATUS_PILL_STYLES = {
    Pending: { color: "#92400E", bgcolor: "#FEF3C7" },
    Accepted: { color: "#1E40AF", bgcolor: "#DBEAFE" },
    Preparing: { color: "#9A3412", bgcolor: "#FFEDD5" },
    Ready: { color: "#5B21B6", bgcolor: "#EDE9FE" },
    "Out For Delivery": { color: "#155E75", bgcolor: "#CFFAFE" },
    Delivered: { color: "#3F6212", bgcolor: "#F0F5E4" },
    Cancelled: { color: "#9B1C1C", bgcolor: "#FEE2E2" }
};

function StatusPill({ status }) {

    const palette = STATUS_PILL_STYLES[status] || { color: "#374151", bgcolor: "#F3F4F6" };

    return (
        <Box
            component="span"
            sx={{
                ...palette,
                display: "inline-block",
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap"
            }}
        >
            {status}
        </Box>
    );

}

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
    // Empty means "all time" - the page's existing behaviour, so opening
    // Orders still shows everything rather than silently hiding history
    // behind a default window.
    const [dateRange, setDateRange] = useState({ from: "", to: "" });
    // A single scalar here used to re-enable an unrelated row's button the
    // instant a second order started advancing - a Set keyed by order id
    // keeps every in-flight row disabled independently, same pattern as
    // Pos.jsx's pendingAdvanceOrderIds.
    const [advancingOrderIds, setAdvancingOrderIds] = useState(() => new Set());

    // Row-level print actions fetch the full order (the list view doesn't
    // carry line items/tax fields) on demand rather than up front for every
    // row - printLoadingId disables just the clicked row's icon while that
    // fetch is in flight, same per-row-independent pattern as advancing.
    const [printOrder, setPrintOrder] = useState(null);
    const [printMode, setPrintMode] = useState(null);
    const [printLoadingId, setPrintLoadingId] = useState(null);

    // Client-side paging over the already-fetched (filtered) list - the
    // backend has no page/limit param on GET /orders.
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

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

        if (advancingOrderIds.has(order.OrderId)) {
            return;
        }

        setAdvancingOrderIds((prev) => new Set(prev).add(order.OrderId));

        try {

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

            setAdvancingOrderIds((prev) => {
                const next = new Set(prev);
                next.delete(order.OrderId);
                return next;
            });

        }

    };

    const handlePrint = async (event, order, mode) => {

        event.stopPropagation();

        if (printLoadingId === order.OrderId) {
            return;
        }

        setPrintLoadingId(order.OrderId);

        try {

            const response = await orderService.getOrderById(order.OrderId);

            if (!response.success) {
                toast.error(response.message || "Failed to load order.");
                return;
            }

            setPrintOrder(response.data);
            setPrintMode(mode);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load order.");

        } finally {

            setPrintLoadingId(null);

        }

    };

    const handleClosePrint = () => {
        setPrintOrder(null);
        setPrintMode(null);
    };

    const statusCounts = orders.reduce((counts, order) => {
        counts[order.OrderStatus] = (counts[order.OrderStatus] || 0) + 1;
        return counts;
    }, {});

    // Keep the page in range whenever the underlying filters (or the data
    // itself, via the background refresh) change - otherwise a filter that
    // shrinks the result set can leave the user stranded on an empty page.
    useEffect(() => {
        setPage(0);
    }, [search, statusFilter, selectedBranchId, dateRange.from, dateRange.to]);

    const filteredOrders = orders.filter((order) => {

        if (statusFilter !== "All" && order.OrderStatus !== statusFilter) {
            return false;
        }

        // Compared as YYYY-MM-DD strings (which sort lexically) against the
        // order's *local* calendar day - the same local-components approach
        // dateRange.toDateInputValue uses, so an early-morning IST order
        // isn't pushed into the previous day the way a UTC comparison would.
        if (dateRange.from || dateRange.to) {

            const orderDay = toDateInputValue(new Date(order.OrderDate));

            if (dateRange.from && orderDay < dateRange.from) {
                return false;
            }

            if (dateRange.to && orderDay > dateRange.to) {
                return false;
            }

        }

        const query = search.trim().toLowerCase();

        if (!query) {
            return true;
        }

        const matchesId = String(order.OrderId).includes(query);
        const matchesCustomer = (order.CustomerName || "").toLowerCase().includes(query);

        return matchesId || matchesCustomer;

    });

    // Cancelled orders are counted but never billed, so they're excluded from
    // revenue and from the average - including them would understate what an
    // order is actually worth.

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

                <TextField
                    size="small"
                    type="date"
                    label="From"
                    value={dateRange.from}
                    onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
                    slotProps={{ inputLabel: { shrink: true } }}
                />

                <TextField
                    size="small"
                    type="date"
                    label="To"
                    value={dateRange.to}
                    onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
                    slotProps={{ inputLabel: { shrink: true } }}
                />

                {(dateRange.from || dateRange.to) && (
                    <Button size="small" onClick={() => setDateRange({ from: "", to: "" })}>
                        Clear dates
                    </Button>
                )}

            </Stack>

            <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: { xs: 0.5, sm: 0 }, mb: 2 }}>

                {STATUS_FILTERS.map((status) => {

                    const count = status === "All" ? orders.length : (statusCounts[status] || 0);
                    const selected = statusFilter === status;
                    // A status nothing is sitting in is a dead end - still
                    // clickable (so the set of statuses stays discoverable),
                    // but dimmed so the counts that carry information aren't
                    // competing with five zeroes for attention.
                    const isEmpty = count === 0 && !selected;

                    return (
                        <Chip
                            key={status}
                            label={`${status} (${count})`}
                            onClick={() => setStatusFilter(status)}
                            color={selected ? (status === "All" ? "primary" : getStatusChipColor(status)) : "default"}
                            variant={selected ? "filled" : "outlined"}
                            sx={{ flexShrink: 0, opacity: isEmpty ? 0.45 : 1 }}
                        />
                    );

                })}

            </Stack>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    // Capped height with a stuck header: at 25 rows a page the
                    // column labels used to scroll away, leaving you counting
                    // columns to work out which figure was the total.
                    <TableContainer sx={{ maxHeight: { xs: "none", md: "calc(100vh - 320px)" } }}>

                        <Table
                            size="small"
                            stickyHeader
                            sx={{
                                "& tbody td": { py: 1.25, borderColor: "#F1F2F4" },
                                "& thead th": {
                                    bgcolor: "#FAFAFB",
                                    color: "text.secondary",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    borderColor: "#E5E7EB"
                                }
                            }}
                        >

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
                                        <TableCell colSpan={ownerMode ? 8 : 7} sx={{ py: 0 }}>
                                            <EmptyState
                                                icon={<ReceiptLongOutlinedIcon />}
                                                title={orders.length === 0 ? "No orders yet" : "No orders match your search/filter"}
                                                description={orders.length === 0 ? "Orders will show up here as customers or staff place them." : "Try a different search term or status filter."}
                                            />
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((order) => {

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

                                                {/* Tabular figures so order numbers form a
                                                    straight column instead of ragging with
                                                    each digit's natural width. Kept as a
                                                    single text node - splitting the "#" into
                                                    its own span to mute it broke every test
                                                    matching on "#62", and readers select and
                                                    search this value as one string. */}
                                                <TableCell sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                                                    #{order.OrderId}
                                                </TableCell>

                                                <TableCell sx={{ fontWeight: 500 }}>
                                                    {order.CustomerName || "Guest"}
                                                    {order.CreatedByAdminName && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 400 }}>
                                                            by {order.CreatedByAdminName}
                                                        </Typography>
                                                    )}
                                                </TableCell>

                                                {ownerMode && (
                                                    <TableCell sx={{ color: "text.secondary" }}>{order.BranchName}</TableCell>
                                                )}

                                                <TableCell sx={{ color: "text.secondary" }}>
                                                    {order.DeliveryType}
                                                    {order.DeliveryType === "Dine In" && order.TableNumber ? ` · T-${order.TableNumber}` : ""}
                                                </TableCell>

                                                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                                                    {formatCurrency(order.TotalAmount)}
                                                </TableCell>

                                                <TableCell>
                                                    <StatusPill status={order.OrderStatus} />
                                                </TableCell>

                                                <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                                                    {formatDateTime(order.OrderDate)}
                                                </TableCell>

                                                <TableCell align="right" onClick={(event) => event.stopPropagation()}>

                                                    <Stack direction="row" spacing={0.25} sx={{ display: "inline-flex", alignItems: "center", mr: 1 }}>

                                                        <Tooltip title="Print KOT">
                                                            <IconButton
                                                                size="small"
                                                                disabled={printLoadingId === order.OrderId}
                                                                onClick={(event) => handlePrint(event, order, "kot")}
                                                                aria-label={`Print KOT for order ${order.OrderId}`}
                                                            >
                                                                <SoupKitchenOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>

                                                        <Tooltip title="Print bill">
                                                            <IconButton
                                                                size="small"
                                                                disabled={printLoadingId === order.OrderId}
                                                                onClick={(event) => handlePrint(event, order, "bill")}
                                                                aria-label={`Print bill for order ${order.OrderId}`}
                                                            >
                                                                <PrintOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>

                                                    </Stack>

                                                    {!isTerminalStatus(order.OrderStatus) && nextStatus && (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            disabled={advancingOrderIds.has(order.OrderId)}
                                                            onClick={(event) => handleQuickAdvance(event, order, nextStatus)}
                                                        >
                                                            {advancingOrderIds.has(order.OrderId) ? "..." : `Mark ${nextStatus}`}
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

                {!loading && filteredOrders.length > 0 && (

                    <TablePagination
                        component="div"
                        count={filteredOrders.length}
                        page={page}
                        onPageChange={(event, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(Number(event.target.value));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                    />

                )}

            </Paper>

            <OrderDetailsDialog
                open={dialogOpen}
                orderId={selectedOrderId}
                onClose={handleDialogClose}
                onChanged={loadOrders}
            />

            <PrintDialog
                open={Boolean(printOrder) && printMode === "bill"}
                onClose={handleClosePrint}
            >
                {printOrder && <BillReceipt order={printOrder} restaurantName={admin?.tenantName} />}
            </PrintDialog>

            <PrintDialog
                open={Boolean(printOrder) && printMode === "kot"}
                onClose={handleClosePrint}
                printLabel="Print KOT"
            >
                {printOrder && <KotReceipt order={printOrder} restaurantName={admin?.tenantName} />}
            </PrintDialog>

        </Box>

    );

}

export default Orders;
