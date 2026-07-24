import { useEffect, useState } from "react";
import { Box, Button, Card, MenuItem, Select, Typography } from "@mui/material";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";
import * as tableService from "../services/tableService";
import * as orderService from "../services/orderService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { getPusherClient } from "../lib/pusherClient";

import PosTableGrid from "./PosTableGrid";
import PosOrderBuilder from "./PosOrderBuilder";
import PosOrderDetails from "./PosOrderDetails";

function Pos() {

    const auth = getStoredAuth();
    const ownerMode = isOwner(auth?.admin);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(ownerMode ? null : auth?.admin?.BranchId);

    const [tables, setTables] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const [mode, setMode] = useState("grid");
    const [pendingTable, setPendingTable] = useState(null);
    const [detailsOrder, setDetailsOrder] = useState(null);

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

    useEffect(() => {

        if (!selectedBranchId) {
            return undefined;
        }

        loadTableState(selectedBranchId);

        // Fallback safety net in case a realtime event is ever missed - the
        // Pusher subscription below is what actually makes this feel live.
        const interval = setInterval(() => {

            if (document.visibilityState === "visible") {
                loadTableState(selectedBranchId, true);
            }

        }, 60000);

        return () => clearInterval(interval);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    // Realtime: a new order (placed by a customer, or rung up on another
    // till) or a status change shows up on the table grid immediately.
    useEffect(() => {

        const pusher = getPusherClient();

        if (!pusher || !selectedBranchId) {
            return undefined;
        }

        const channel = pusher.subscribe(`private-branch-${selectedBranchId}`);
        const handleUpdate = () => loadTableState(selectedBranchId, true);

        channel.bind("order:created", handleUpdate);
        channel.bind("order:status-changed", handleUpdate);

        return () => {
            channel.unbind("order:created", handleUpdate);
            channel.unbind("order:status-changed", handleUpdate);
            pusher.unsubscribe(channel.name);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    const loadTableState = async (branchId, silent = false) => {

        try {

            if (!silent) {
                setLoading(true);
            }

            const [tablesResponse, ordersResponse] = await Promise.all([
                tableService.getActiveTables(branchId),
                orderService.getActiveTableOrders(branchId)
            ]);

            if (tablesResponse.success) {
                setTables(tablesResponse.data);
            }

            if (ordersResponse.success) {
                setActiveOrders(ordersResponse.data);
            }

        } catch {

            if (!silent) {
                toast.error("Failed to load table status.");
            }

        } finally {

            if (!silent) {
                setLoading(false);
            }

        }

    };

    const activeOrdersByTable = new Map(activeOrders.map((order) => [order.TableNumber, order]));

    const handleTableClick = async (table, activeOrder) => {

        if (activeOrder) {

            try {

                const response = await orderService.getOrderById(activeOrder.OrderId);

                if (response.success) {
                    setDetailsOrder(response.data);
                }

            } catch {

                toast.error("Failed to load order details.");

            }

            return;

        }

        setPendingTable(table);
        setMode("dine-in");

    };

    const handleTakeaway = () => {
        setPendingTable(null);
        setMode("takeaway");
    };

    const handleOrderCreated = () => {
        setMode("grid");
        setPendingTable(null);
        loadTableState(selectedBranchId, true);
    };

    const handleAdvanceStatus = async (orderId, orderStatus) => {

        try {

            const response = await orderService.updateOrderStatus(orderId, orderStatus);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message);

            setDetailsOrder((prev) => (prev && prev.OrderId === orderId ? { ...prev, OrderStatus: orderStatus } : prev));

            await loadTableState(selectedBranchId, true);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order status.");

        }

    };

    const handleCancelOrder = async (orderId) => {

        try {

            const response = await orderService.cancelOrder(orderId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message);
            setDetailsOrder(null);
            await loadTableState(selectedBranchId, true);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to cancel order.");

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Typography variant="h4" fontWeight={700}>
                    Take Order
                </Typography>

                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>

                    {ownerMode && branches.length > 0 && (

                        <Select
                            size="small"
                            value={selectedBranchId ?? ""}
                            onChange={(event) => {
                                setSelectedBranchId(event.target.value);
                                setMode("grid");
                                setPendingTable(null);
                            }}
                        >
                            {branches.map((branch) => (
                                <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                    {branch.BranchName}
                                </MenuItem>
                            ))}
                        </Select>

                    )}

                    {mode === "grid" && (
                        <Button variant="outlined" onClick={handleTakeaway}>
                            Takeaway / Counter Order
                        </Button>
                    )}

                </Box>

            </Box>

            {mode === "grid" && (

                <>
                    {!loading && tables.length === 0 && (

                        <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
                            No tables set up for this branch yet — add some under Tables.
                        </Typography>

                    )}

                    <PosTableGrid
                        tables={tables}
                        activeOrdersByTable={activeOrdersByTable}
                        onTableClick={handleTableClick}
                        onQuickAdvance={handleAdvanceStatus}
                    />
                </>

            )}

            {mode === "dine-in" && pendingTable && selectedBranchId && (

                <Card sx={{ p: 3 }}>

                    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                        New Order — Table {pendingTable.TableName}
                    </Typography>

                    <PosOrderBuilder
                        key={`dine-in-${selectedBranchId}-${pendingTable.TableId}`}
                        branchId={selectedBranchId}
                        deliveryType="Dine In"
                        tableNumber={pendingTable.TableName}
                        onCreated={handleOrderCreated}
                        onCancel={() => { setMode("grid"); setPendingTable(null); }}
                    />

                </Card>

            )}

            {mode === "takeaway" && selectedBranchId && (

                <Card sx={{ p: 3 }}>

                    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                        New Order — Takeaway
                    </Typography>

                    <PosOrderBuilder
                        key={`takeaway-${selectedBranchId}`}
                        branchId={selectedBranchId}
                        deliveryType="Takeaway"
                        onCreated={handleOrderCreated}
                        onCancel={() => setMode("grid")}
                    />

                </Card>

            )}

            <PosOrderDetails
                open={Boolean(detailsOrder)}
                order={detailsOrder}
                onClose={() => setDetailsOrder(null)}
                onAdvanceStatus={handleAdvanceStatus}
                onCancelOrder={handleCancelOrder}
            />

        </Box>

    );

}

export default Pos;
