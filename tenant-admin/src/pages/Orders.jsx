import { useEffect, useRef, useState } from "react";
import {
    Box,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { getPusherClient } from "../lib/pusherClient";
import OrderDetailsDialog from "./OrderDetailsDialog";
import { formatCurrency, getStatusChipColor } from "./orderStatusUtils";

function Orders() {

    const { admin } = getStoredAuth() || {};
    const ownerMode = isOwner(admin);

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState("all");

    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

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
                                </TableRow>

                            </TableHead>

                            <TableBody>

                                {orders.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={ownerMode ? 7 : 6} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">No orders found.</Typography>
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    orders.map((order) => (

                                        <TableRow
                                            key={order.OrderId}
                                            hover
                                            onClick={() => handleRowClick(order.OrderId)}
                                            sx={{ cursor: "pointer" }}
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

                                        </TableRow>

                                    ))

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
