import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tooltip,
    Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";
import * as orderService from "../services/orderService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { getPusherClient } from "../lib/pusherClient";
import { playNotificationSound } from "../utils/notificationSound";
import KotReceipt from "../components/KotReceipt";
import PrintDialog from "../components/PrintDialog";
import { useThermalPrint } from "../hooks/useThermalPrint";
import { buildKotTicket } from "../utils/kotEscpos";
import { hasStartedPreparing } from "./orderStatusUtils";

// The kitchen's job ends at Ready - Delivered/Out For Delivery is
// front-of-house's concern, handled from Orders/POS instead. Pending jumps
// straight to Preparing (skipping a separate "Accepted" tap) since the
// backend allows forward jumps in the status sequence, and a KDS wants one
// big button per ticket, not a menu of every intermediate step.
const COLUMNS = [
    { key: "Pending", label: "New", statuses: ["Pending"], nextStatus: "Preparing", actionLabel: "Start Preparing" },
    { key: "InProgress", label: "In Progress", statuses: ["Accepted", "Preparing"], nextStatus: "Ready", actionLabel: "Mark Ready" },
    { key: "Ready", label: "Ready for Pickup", statuses: ["Ready"], nextStatus: null, actionLabel: null }
];

function elapsedMinutes(dateString) {
    return Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 60000));
}

// A ticket sitting in "Ready" for days (stale demo data, or just missed)
// would otherwise show something like "7118m" - a wide, unreadable chip
// that also squeezed the order-number/chip row together since Stack's
// space-between had almost no room left to distribute. Collapsing to
// hours/days past 60 minutes keeps the label short at any age.
function formatElapsed(minutes) {

    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h`;
    }

    return `${Math.floor(hours / 24)}d`;

}

// A table ordering a second round mid-sitting (starters already in, dessert
// ordered before they're even out) used to show up as two cards with
// nothing tying them together - easy to miss they're the same table.
// Groups consecutive same-table Dine In tickets within a column; Takeaway/
// Delivery orders (no table) and a table with only one open ticket here
// stay exactly as before, single card, no wrapper.
function groupOrdersByTable(columnOrders) {

    const groups = [];
    const groupByTable = new Map();

    for (const order of columnOrders) {

        const tableKey = order.DeliveryType === "Dine In" && order.TableNumber ? order.TableNumber : null;

        if (tableKey && groupByTable.has(tableKey)) {
            groupByTable.get(tableKey).orders.push(order);
            continue;
        }

        const group = { tableNumber: tableKey, orders: [order] };

        if (tableKey) {
            groupByTable.set(tableKey, group);
        }

        groups.push(group);

    }

    return groups;

}

function OrderTicket({ order, column, onAdvance, advancing, onPrintKot, hideTableLabel }) {

    const minutes = elapsedMinutes(order.OrderDate);

    // Same gate as Orders.jsx's quick-advance button - the backend blocks a
    // Card/UPI order from reaching Preparing (or anything past it, which
    // "Mark Ready" on an Accepted ticket also does by jumping straight over
    // Preparing) without a confirmed payment. Tapping this used to just fail
    // with a bare error toast after the round trip; disabling it up front is
    // a courtesy only - the server's own gate still enforces this either way.
    const blockedByUnconfirmedPayment = Boolean(
        column.nextStatus
        && ["Card", "UPI"].includes(order.PaymentMethod)
        && order.LatestPaymentStatus
        && order.LatestPaymentStatus !== "Paid"
        && hasStartedPreparing(column.nextStatus, order.DeliveryType)
    );

    return (

        <Paper elevation={0} sx={{ p: 2, mb: 2, border: "1px solid #E5E7EB" }}>

            <Stack direction="row" spacing={1} sx={{ width: "100%", mb: 0.5, justifyContent: "space-between", alignItems: "center" }}>
                <Typography fontWeight={700}>#{order.OrderId}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <Chip
                        label={formatElapsed(minutes)}
                        size="small"
                        color={minutes >= 15 ? "error" : minutes >= 8 ? "warning" : "default"}
                    />
                    <Tooltip title="Print KOT">
                        <IconButton size="small" onClick={() => onPrintKot(order)} aria-label={`Print KOT for order ${order.OrderId}`}>
                            <PrintOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>

                {/* Suppressed inside a table group - its own header already
                    says "Table X", so every card in the group repeating it
                    is just noise. */}
                {!hideTableLabel && (
                    <Typography variant="body2" color="text.secondary">
                        {order.DeliveryType === "Dine In" && order.TableNumber ? `Table ${order.TableNumber}` : order.DeliveryType}
                    </Typography>
                )}

                {/* In Progress merges Accepted and Preparing into one column
                    with one shared "Mark Ready" button (a KDS wants one big
                    action per ticket, not a menu of every intermediate step)
                    - but that meant a ticket nobody has started cooking yet
                    looked identical to one already on the stove. This is the
                    only thing that tells them apart at a glance. */}
                {column.statuses.length > 1 && (
                    <Chip
                        label={order.OrderStatus}
                        size="small"
                        variant={order.OrderStatus === "Preparing" ? "filled" : "outlined"}
                        color={order.OrderStatus === "Preparing" ? "warning" : "default"}
                    />
                )}

            </Stack>

            <Divider sx={{ mb: 1 }} />

            <Stack spacing={0.75}>

                {(order.Items || []).map((item) => (

                    <Box key={item.OrderItemId}>

                        <Typography variant="body2" fontWeight={600}>
                            {item.Quantity}x {item.ItemName}
                        </Typography>

                        {item.SelectedOptions?.length > 0 && (
                            <Typography variant="caption" color="text.secondary" component="div">
                                {item.SelectedOptions.map((option) => option.OptionName).join(", ")}
                            </Typography>
                        )}

                    </Box>

                ))}

            </Stack>

            {order.OrderNotes && (
                <Typography variant="caption" sx={{ mt: 1, display: "block", fontStyle: "italic" }}>
                    Note: {order.OrderNotes}
                </Typography>
            )}

            {column.actionLabel && (
                <Tooltip title={blockedByUnconfirmedPayment ? "Payment not yet confirmed for this order - it can't move forward yet." : ""}>
                    <span style={{ display: "block" }}>
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={advancing || blockedByUnconfirmedPayment}
                            onClick={() => onAdvance(order.OrderId, column.nextStatus)}
                            sx={{ mt: 2 }}
                        >
                            {advancing ? "Updating..." : column.actionLabel}
                        </Button>
                    </span>
                </Tooltip>
            )}

        </Paper>

    );

}

function Kitchen() {

    const { admin } = getStoredAuth() || {};
    const ownerMode = isOwner(admin);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(ownerMode ? null : admin?.BranchId);

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    // A single scalar here used to re-enable an unrelated ticket's button
    // the instant a second one started advancing (advancingId === that
    // OTHER order's id, not this one) - a Set keyed by order id keeps every
    // in-flight ticket disabled independently, same pattern as Pos.jsx's
    // pendingAdvanceOrderIds.
    const [advancingIds, setAdvancingIds] = useState(() => new Set());
    const [kotOrder, setKotOrder] = useState(null);
    const { printing: kotPrinting, print: printKot } = useThermalPrint();
    // Unused beyond forcing a re-render - elapsedMinutes() itself always
    // reads Date.now() fresh, but nothing was ever prompting React to
    // recompute it between actual data changes (a Pusher event or the 60s
    // poll). Without this, a ticket's timer chip only advanced/changed
    // color whenever the kitchen happened to get a data update, not
    // continuously the way a real KDS ticks live.
    const [, forceTick] = useState(0);

    useEffect(() => {

        const interval = setInterval(() => forceTick((tick) => tick + 1), 15000);
        return () => clearInterval(interval);

    }, []);

    useEffect(() => {

        if (!ownerMode) {
            return;
        }

        (async () => {

            try {

                const response = await branchService.getAllBranches();

                if (response.success) {

                    setBranches(response.data);

                    if (response.data.length > 0) {
                        setSelectedBranchId(response.data[0].BranchId);
                    }

                }

            } catch {

                toast.error("Failed to load branches.");

            }

        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadOrders = async (branchId, silent = false) => {

        try {

            if (!silent) {
                setLoading(true);
            }

            const response = await orderService.getKitchenOrders(branchId);

            if (response.success) {
                setOrders(response.data);
            } else if (!silent) {
                toast.error(response.message || "Failed to load kitchen orders.");
            }

        } catch (error) {

            if (!silent) {
                toast.error(error.response?.data?.message || "Failed to load kitchen orders.");
            }

        } finally {

            setLoading(false);

        }

    };

    useEffect(() => {

        if (!selectedBranchId) {
            return undefined;
        }

        loadOrders(selectedBranchId);

        // Fallback safety net in case a realtime event is ever missed - the
        // Pusher subscription below is what actually makes this feel live.
        const interval = setInterval(() => {

            if (document.visibilityState === "visible") {
                loadOrders(selectedBranchId, true);
            }

        }, 60000);

        return () => clearInterval(interval);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    useEffect(() => {

        const pusher = getPusherClient();

        if (!pusher || !selectedBranchId) {
            return undefined;
        }

        const channel = pusher.subscribe(`private-branch-${selectedBranchId}`);
        const handleUpdate = () => loadOrders(selectedBranchId, true);

        const handleCreated = () => {
            playNotificationSound();
            loadOrders(selectedBranchId, true);
        };

        channel.bind("order:created", handleCreated);
        channel.bind("order:status-changed", handleUpdate);

        return () => {
            channel.unbind("order:created", handleCreated);
            channel.unbind("order:status-changed", handleUpdate);
            pusher.unsubscribe(channel.name);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    const handleAdvance = async (orderId, nextStatus) => {

        if (advancingIds.has(orderId)) {
            return;
        }

        setAdvancingIds((prev) => new Set(prev).add(orderId));

        try {

            const response = await orderService.updateOrderStatus(orderId, nextStatus);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            await loadOrders(selectedBranchId, true);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order.");

        } finally {

            setAdvancingIds((prev) => {
                const next = new Set(prev);
                next.delete(orderId);
                return next;
            });

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 3 }}>

                <Typography variant="h4">Kitchen</Typography>

                {ownerMode && (

                    <FormControl size="small" sx={{ minWidth: 220 }}>

                        <InputLabel id="kitchen-branch-label">Branch</InputLabel>

                        <Select
                            labelId="kitchen-branch-label"
                            label="Branch"
                            value={selectedBranchId ?? ""}
                            onChange={(event) => setSelectedBranchId(event.target.value)}
                        >

                            {branches.map((branch) => (
                                <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                    {branch.BranchName}
                                </MenuItem>
                            ))}

                        </Select>

                    </FormControl>

                )}

            </Box>

            {loading ? (

                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress size={28} />
                </Box>

            ) : (

                <Grid container spacing={2}>

                    {COLUMNS.map((column) => {

                        const columnOrders = orders.filter((order) => column.statuses.includes(order.OrderStatus));

                        return (

                            <Grid key={column.key} size={{ xs: 12, md: 4 }}>

                                <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                                    {column.label} ({columnOrders.length})
                                </Typography>

                                {columnOrders.length === 0 ? (

                                    <Paper elevation={0} sx={{ p: 3, textAlign: "center", border: "1px dashed #E5E7EB" }}>
                                        <Typography color="text.secondary" variant="body2">Nothing here.</Typography>
                                    </Paper>

                                ) : (

                                    groupOrdersByTable(columnOrders).map((group) => {

                                        const isGrouped = group.orders.length > 1;

                                        const tickets = group.orders.map((order) => (
                                            <OrderTicket
                                                key={order.OrderId}
                                                order={order}
                                                column={column}
                                                advancing={advancingIds.has(order.OrderId)}
                                                onAdvance={handleAdvance}
                                                onPrintKot={setKotOrder}
                                                hideTableLabel={isGrouped}
                                            />
                                        ));

                                        if (!isGrouped) {
                                            return tickets;
                                        }

                                        return (

                                            <Box
                                                key={`table-${group.tableNumber}`}
                                                sx={{ mb: 2, p: 1.5, border: "1px solid #C7D2FE", borderRadius: 1, bgcolor: "#EEF2FF" }}
                                            >

                                                <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: "block", mb: 1 }}>
                                                    Table {group.tableNumber} &middot; {group.orders.length} orders
                                                </Typography>

                                                {tickets}

                                            </Box>

                                        );

                                    })

                                )}

                            </Grid>

                        );

                    })}

                </Grid>

            )}

            <PrintDialog
                open={Boolean(kotOrder)}
                onClose={() => setKotOrder(null)}
                printLabel="Print KOT"
                variant="drawer"
                title={kotOrder ? `Order #${kotOrder.OrderId}` : "KOT"}
                printing={kotPrinting}
                onPrint={kotOrder ? () => printKot(() => buildKotTicket({
                    order: { ...kotOrder, BranchName: branches.find((branch) => branch.BranchId === selectedBranchId)?.BranchName },
                    restaurantName: admin?.tenantName
                })) : undefined}
            >
                {kotOrder && (
                    <KotReceipt
                        order={{ ...kotOrder, BranchName: branches.find((branch) => branch.BranchId === selectedBranchId)?.BranchName }}
                        restaurantName={admin?.tenantName}
                    />
                )}
            </PrintDialog>

        </Box>

    );

}

export default Kitchen;
