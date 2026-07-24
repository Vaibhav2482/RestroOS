import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography
} from "@mui/material";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";
import * as orderService from "../services/orderService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { getPusherClient } from "../lib/pusherClient";

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

function OrderTicket({ order, column, onAdvance, advancing }) {

    const minutes = elapsedMinutes(order.OrderDate);

    return (

        <Paper elevation={0} sx={{ p: 2, mb: 2, border: "1px solid #E5E7EB" }}>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography fontWeight={700}>#{order.OrderId}</Typography>
                <Chip
                    label={`${minutes}m`}
                    size="small"
                    color={minutes >= 15 ? "error" : minutes >= 8 ? "warning" : "default"}
                />
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {order.DeliveryType === "Dine In" && order.TableNumber ? `Table ${order.TableNumber}` : order.DeliveryType}
            </Typography>

            <Divider sx={{ mb: 1 }} />

            <Stack spacing={0.75}>

                {order.Items.map((item) => (

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
                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={advancing}
                    onClick={() => onAdvance(order.OrderId, column.nextStatus)}
                    sx={{ mt: 2 }}
                >
                    {advancing ? "Updating..." : column.actionLabel}
                </Button>
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
    const [advancingId, setAdvancingId] = useState(null);

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

        channel.bind("order:created", handleUpdate);
        channel.bind("order:status-changed", handleUpdate);

        return () => {
            channel.unbind("order:created", handleUpdate);
            channel.unbind("order:status-changed", handleUpdate);
            pusher.unsubscribe(channel.name);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    const handleAdvance = async (orderId, nextStatus) => {

        try {

            setAdvancingId(orderId);

            const response = await orderService.updateOrderStatus(orderId, nextStatus);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            await loadOrders(selectedBranchId, true);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order.");

        } finally {

            setAdvancingId(null);

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

                                    columnOrders.map((order) => (
                                        <OrderTicket
                                            key={order.OrderId}
                                            order={order}
                                            column={column}
                                            advancing={advancingId === order.OrderId}
                                            onAdvance={handleAdvance}
                                        />
                                    ))

                                )}

                            </Grid>

                        );

                    })}

                </Grid>

            )}

        </Box>

    );

}

export default Kitchen;
