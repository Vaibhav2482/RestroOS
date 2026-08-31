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
    ListItemIcon,
    Menu,
    MenuItem,
    Pagination,
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

// "All" first, then the sequence a Delivery order actually moves through -
// Dine In/Takeaway orders just never hit "Out For Delivery", and only ever
// reach their own terminal word (Served / Picked Up), never "Delivered",
// which is fine since the others will always have a zero count for a given
// order rather than being confusing.
const STATUS_FILTERS = ["All", "Pending", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered", "Served", "Picked Up", "Cancelled"];

// Soft tinted pills rather than MUI's solid filled chips. With ~92% of a
// mature order list sitting on a settled/terminal status, a wall of
// saturated green was drawing the eye to the one thing nobody needs to look
// at; muting the settled states lets Pending and Cancelled actually stand out.
const STATUS_PILL_STYLES = {
    Pending: { color: "#92400E", bgcolor: "#FEF3C7" },
    Accepted: { color: "#1E40AF", bgcolor: "#DBEAFE" },
    Preparing: { color: "#9A3412", bgcolor: "#FFEDD5" },
    Ready: { color: "#5B21B6", bgcolor: "#EDE9FE" },
    "Out For Delivery": { color: "#155E75", bgcolor: "#CFFAFE" },
    Delivered: { color: "#3F6212", bgcolor: "#F0F5E4" },
    Served: { color: "#3F6212", bgcolor: "#F0F5E4" },
    "Picked Up": { color: "#3F6212", bgcolor: "#F0F5E4" },
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
    // Server-reported total for the current filtered set (not orders.length,
    // which is just the current page) and per-status counts across that
    // same filtered set (not just the current page) - both drive the
    // TablePagination footer and the filter chip row respectively.
    const [totalCount, setTotalCount] = useState(0);
    const [statusCounts, setStatusCounts] = useState({});
    const [loading, setLoading] = useState(true);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState("all");

    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [search, setSearch] = useState("");
    // The value actually sent to the server - updated 400ms after typing
    // stops, so a paginated/server-filtered search doesn't fire a request
    // per keystroke (harmless when it was a client-side array filter,
    // wasteful now that it's a real network round trip).
    const [debouncedSearch, setDebouncedSearch] = useState("");
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
    // The two print actions used to be separate icon-only buttons (a soup
    // bowl for KOT, a generic printer for the bill) with no visible label,
    // relying entirely on a hover tooltip to explain either one - fine on a
    // desktop mouse, useless at a glance or on a touchscreen. One labeled
    // "Print" trigger opening a menu with two clearly-worded choices reads
    // the same for everyone. printMenuOrderId (not just the anchor element)
    // is what the row-scoped "is my order's menu open" checks key off, so
    // this stays correct even though every row shares this one piece of
    // state.
    const [printMenuAnchor, setPrintMenuAnchor] = useState(null);
    const [printMenuOrderId, setPrintMenuOrderId] = useState(null);

    // Server-side paging - page/rowsPerPage drive the actual GET /orders
    // request (page/limit params) rather than slicing an already-fetched
    // full history client-side.
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

    // Debounced separately from the raw input - a paginated/server-filtered
    // search is a real network request per change now, not a client-side
    // array filter, so typing shouldn't fire one per keystroke.
    useEffect(() => {

        const timeout = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timeout);

    }, [search]);

    // Keep the page in range whenever a filter (not the page/rowsPerPage
    // themselves) changes - otherwise a filter that shrinks the result set
    // can leave the user stranded on an empty page. Guarded so this only
    // touches page state (and so only fires one fetch, not two) when it's
    // actually not already 0 - the common case of changing a filter while
    // already on the first page needs no reset at all.
    useEffect(() => {

        setPage((prev) => (prev === 0 ? prev : 0));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, selectedBranchId, dateRange.from, dateRange.to, debouncedSearch]);

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
    }, [selectedBranchId, statusFilter, dateRange.from, dateRange.to, debouncedSearch, page, rowsPerPage]);

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

            const response = await orderService.getAllOrders(branchId, {
                page: page + 1, // server is 1-indexed, MUI's TablePagination is 0-indexed
                limit: rowsPerPage,
                status: statusFilter !== "All" ? statusFilter : undefined,
                dateFrom: dateRange.from || undefined,
                dateTo: dateRange.to || undefined,
                search: debouncedSearch.trim() || undefined
            });

            if (response.success) {
                setOrders(response.data.orders);
                setTotalCount(response.data.total);
                setStatusCounts(response.data.statusCounts || {});
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

    const handleOpenPrintMenu = (event, orderId) => {
        event.stopPropagation();
        setPrintMenuAnchor(event.currentTarget);
        setPrintMenuOrderId(orderId);
    };

    const handleClosePrintMenu = () => {
        setPrintMenuAnchor(null);
        setPrintMenuOrderId(null);
    };

    const handlePrint = async (event, order, mode) => {

        event.stopPropagation();
        handleClosePrintMenu();

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

    // Cancelled orders are counted but never billed, so they're excluded from
    // revenue and from the average - including them would understate what an
    // order is actually worth.

    const hasActiveFilters = Boolean(debouncedSearch.trim() || statusFilter !== "All" || dateRange.from || dateRange.to);

    return (

        <Box>

            {/* One toolbar row instead of a title/branch row sitting mostly
                empty above a separate search/date row below it - the title
                used to leave a huge dead gap next to the Branch selector
                since flex space-between had nothing to distribute it to.
                The search field's flexGrow now soaks up exactly that gap,
                and everything else keeps its natural width alongside it. */}
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 3 }}>

                <Typography variant="h4" sx={{ flexShrink: 0 }}>Orders</Typography>

                <TextField
                    size="small"
                    placeholder="Search by order #, customer, or phone..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    sx={{ flexGrow: 1, minWidth: 200, maxWidth: 340 }}
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
                    sx={{ flexShrink: 0 }}
                />

                <TextField
                    size="small"
                    type="date"
                    label="To"
                    value={dateRange.to}
                    onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ flexShrink: 0 }}
                />

                {(dateRange.from || dateRange.to) && (
                    <Button size="small" onClick={() => setDateRange({ from: "", to: "" })} sx={{ flexShrink: 0 }}>
                        Clear dates
                    </Button>
                )}

                {ownerMode && (

                    <FormControl size="small" sx={{ minWidth: 220, flexShrink: 0 }}>

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

            <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: { xs: 0.5, sm: 0 }, mb: 2 }}>

                {STATUS_FILTERS.map((status) => {

                    // statusCounts is scoped to branch/date/search but
                    // deliberately NOT the current status filter itself (see
                    // OrderRepository.getOrderStatusCounts) - "All" is the
                    // sum across every status in that same scope, not
                    // totalCount, which reflects whichever status IS
                    // currently selected.
                    const count = status === "All"
                        ? Object.values(statusCounts).reduce((sum, value) => sum + value, 0)
                        : (statusCounts[status] || 0);
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

            {/* minHeight, not just the table's own maxHeight scroll cap below -
                without it, a short result set (or the empty state) left the
                white card far shorter than the page's own reserved height,
                showing as a slab of bare page background underneath it
                instead of looking like a deliberately-sized panel. */}
            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", minHeight: "calc(100vh - 210px)", display: "flex", flexDirection: "column" }}>

                {loading ? (

                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1, py: 8 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    // Capped height with a stuck header: at 25 rows a page the
                    // column labels used to scroll away, leaving you counting
                    // columns to work out which figure was the total. flexGrow
                    // lets it fill the card's own reserved height too, on a
                    // short result set - any leftover space then sits inside
                    // the (still-bordered) table area, above the pagination
                    // footer, rather than the footer floating right under the
                    // last row with blank page background beneath everything.
                    <TableContainer sx={{ maxHeight: { xs: "none", md: "calc(100vh - 210px)" }, flexGrow: 1 }}>

                        <Table
                            size="small"
                            stickyHeader
                            sx={{
                                "& tbody td": { py: 1, borderColor: "#F1F2F4" },
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
                                    <TableCell sx={{ width: 90 }}>Order ID</TableCell>
                                    <TableCell sx={{ minWidth: 160 }}>Customer</TableCell>
                                    {ownerMode && <TableCell sx={{ width: 160 }}>Branch</TableCell>}
                                    <TableCell sx={{ width: 140 }}>Type</TableCell>
                                    <TableCell align="right" sx={{ width: 110 }}>Total</TableCell>
                                    <TableCell sx={{ width: 220 }}>Status</TableCell>
                                    <TableCell sx={{ width: 170 }}>Date</TableCell>
                                    <TableCell align="right" sx={{ width: 300 }}>Actions</TableCell>
                                </TableRow>

                            </TableHead>

                            <TableBody>

                                {orders.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={ownerMode ? 8 : 7} sx={{ py: 0 }}>
                                            <EmptyState
                                                icon={<ReceiptLongOutlinedIcon />}
                                                title={hasActiveFilters ? "No orders match your search/filter" : "No orders yet"}
                                                description={hasActiveFilters ? "Try a different search term or status filter." : "Orders will show up here as customers or staff place them."}
                                            />
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    orders.map((order) => {

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
                                                    // A fixed minimum, not a guess - rows without a quick-advance
                                                    // button (terminal status) or without a payment badge were
                                                    // measurably shorter than rows with one, so the whole list
                                                    // visibly reflowed as an order's status/payment state changed
                                                    // under it. This is the tallest real case (a Payment
                                                    // Failed/Pending badge alongside the status pill), so every
                                                    // row now holds steady at it regardless of that order's
                                                    // current state.
                                                    height: 64,
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
                                                    {/* Only flagged when it's NOT Paid - the common case
                                                        (already paid, or Cash) needs no badge here.
                                                        A Cancelled order still gets this as plain caption
                                                        text, not a second pill-shaped chip - staff scanning
                                                        cancelled orders need to tell "customer's payment
                                                        just failed" apart from "voided for some other
                                                        reason", but two badge shapes stacked under each
                                                        other reads as two competing statuses on one row
                                                        even when the second one is muted in color. Plain
                                                        text underneath (same visual language as the
                                                        "by Admin Name" caption elsewhere in this table)
                                                        reads as a note about a closed order, not a second
                                                        live status. An active order still gets the real
                                                        alarm-colored chip - that one genuinely needs
                                                        attention before someone tries to prepare it. */}
                                                    {["Card", "UPI"].includes(order.PaymentMethod) && order.LatestPaymentStatus && order.LatestPaymentStatus !== "Paid" && (

                                                        order.OrderStatus === "Cancelled" ? (

                                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                                                                Payment {order.LatestPaymentStatus.toLowerCase()}
                                                            </Typography>

                                                        ) : (

                                                            <Chip
                                                                label={`Payment ${order.LatestPaymentStatus}`}
                                                                size="small"
                                                                color={order.LatestPaymentStatus === "Failed" ? "error" : "warning"}
                                                                sx={{ ml: 0.5 }}
                                                            />

                                                        )

                                                    )}
                                                </TableCell>

                                                <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                                                    {formatDateTime(order.OrderDate)}
                                                </TableCell>

                                                <TableCell align="right" onClick={(event) => event.stopPropagation()}>

                                                    {/* One single-line flex row for both the print icons and the
                                                        quick-advance button - previously these were two separate
                                                        inline elements that wrapped onto their own line whenever a
                                                        row had a Mark button, roughly doubling that row's height
                                                        and cutting how many orders fit on screen at once. */}
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ flexWrap: "nowrap" }}>

                                                        {/* One labeled "Print" trigger opening a menu with the
                                                            two choices spelled out, replacing what used to be
                                                            two bare icon buttons (a soup bowl standing in for
                                                            "KOT", a generic printer for "bill") with no visible
                                                            label at all - clear only after hovering long enough
                                                            for the tooltip, which a touchscreen or a quick scan
                                                            never gets. */}
                                                        <Tooltip title="Print">
                                                            <IconButton
                                                                size="small"
                                                                disabled={printLoadingId === order.OrderId}
                                                                onClick={(event) => handleOpenPrintMenu(event, order.OrderId)}
                                                                aria-label={`Print options for order ${order.OrderId}`}
                                                            >
                                                                <PrintOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>

                                                        <Menu
                                                            anchorEl={printMenuAnchor}
                                                            open={printMenuOrderId === order.OrderId}
                                                            onClose={handleClosePrintMenu}
                                                            onClick={(event) => event.stopPropagation()}
                                                        >

                                                            <MenuItem onClick={(event) => handlePrint(event, order, "kot")}>
                                                                <ListItemIcon>
                                                                    <SoupKitchenOutlinedIcon fontSize="small" />
                                                                </ListItemIcon>
                                                                Print KOT
                                                            </MenuItem>

                                                            <MenuItem onClick={(event) => handlePrint(event, order, "bill")}>
                                                                <ListItemIcon>
                                                                    <ReceiptLongOutlinedIcon fontSize="small" />
                                                                </ListItemIcon>
                                                                Print Bill
                                                            </MenuItem>

                                                        </Menu>

                                                        {/* Fixed-width slot regardless of whether a button renders into
                                                            it - a terminal order (no button at all) or a short label
                                                            ("Mark Ready") vs a long one ("Mark Out For Delivery") used
                                                            to leave the row's occupied width ragged and inconsistent
                                                            from one order to the next. Reserving this slot up front
                                                            keeps every row's shape identical either way. */}
                                                        <Box sx={{ width: 200, display: "flex", justifyContent: "flex-end" }}>

                                                            {!isTerminalStatus(order.OrderStatus) && nextStatus && (
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    disabled={advancingOrderIds.has(order.OrderId)}
                                                                    onClick={(event) => handleQuickAdvance(event, order, nextStatus)}
                                                                    sx={{ whiteSpace: "nowrap", minWidth: 120 }}
                                                                >
                                                                    {advancingOrderIds.has(order.OrderId) ? "..." : `Mark ${nextStatus}`}
                                                                </Button>
                                                            )}

                                                        </Box>

                                                    </Stack>

                                                </TableCell>

                                            </TableRow>

                                        );

                                    })

                                )}

                            </TableBody>

                        </Table>

                    </TableContainer>

                )}

                {!loading && totalCount > 0 && (

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 1,
                            borderTop: "1px solid #E5E7EB",
                            bgcolor: "#FAFAFB",
                            pl: 2
                        }}
                    >

                        <Typography variant="body2" color="text.secondary">
                            Showing {Math.min(page * rowsPerPage + 1, totalCount)}–{Math.min((page + 1) * rowsPerPage, totalCount)} of {totalCount} order{totalCount === 1 ? "" : "s"}
                        </Typography>

                        <Stack direction="row" spacing={2.5} alignItems="center" sx={{ py: 1 }}>

                            <FormControl size="small" variant="standard">

                                <Select
                                    value={rowsPerPage}
                                    onChange={(event) => {
                                        setRowsPerPage(Number(event.target.value));
                                        setPage(0);
                                    }}
                                    disableUnderline
                                >

                                    {[10, 25, 50, 100, 200].map((option) => (
                                        <MenuItem key={option} value={option}>{option} / page</MenuItem>
                                    ))}

                                </Select>

                            </FormControl>

                            {/* A prev/next-only pager meant clicking through a
                                dozen-plus pages one at a time to get anywhere -
                                real page counts here (346 orders and growing)
                                make that impractical. Numbered pages let staff
                                jump straight to, say, page 10 in one click. */}
                            <Pagination
                                count={Math.max(1, Math.ceil(totalCount / rowsPerPage))}
                                page={page + 1}
                                onChange={(event, newPage) => setPage(newPage - 1)}
                                color="primary"
                                shape="rounded"
                                size="small"
                                showFirstButton
                                showLastButton
                                siblingCount={1}
                                boundaryCount={1}
                            />

                        </Stack>

                    </Box>

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
