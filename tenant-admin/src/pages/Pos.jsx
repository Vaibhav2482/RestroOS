import { useEffect, useState } from "react";
import { Box, Button, Chip, CircularProgress, IconButton, MenuItem, Select, Stack, Typography } from "@mui/material";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";
import * as tableService from "../services/tableService";
import * as orderService from "../services/orderService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { getPusherClient } from "../lib/pusherClient";
import { playNotificationSound } from "../utils/notificationSound";

import PosTableGrid from "./PosTableGrid";
import PosOrderBuilder from "./PosOrderBuilder";
import PosOrderDetails from "./PosOrderDetails";
import PosTableOrdersDialog from "./PosTableOrdersDialog";
import SettleBillDialog from "./SettleBillDialog";
import { formatCurrency } from "./orderStatusUtils";
import { SIDEBAR_FORCE_COLLAPSE_EVENT } from "../components/Layout";

function Pos() {

    const auth = getStoredAuth();
    const ownerMode = isOwner(auth?.admin);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(ownerMode ? null : auth?.admin?.BranchId);

    const [tables, setTables] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    // Starts true, not false - tables is [] before the first fetch resolves
    // either way (branch admin or owner), and PosTableGrid can't tell "no
    // tables yet" apart from "haven't fetched yet" on its own. Left false
    // by default, the floor briefly flashed its own "No tables yet" empty
    // state on every page load/branch switch before the real grid replaced
    // it, since nothing was actually gating the grid on this flag.
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState("grid");
    const [pendingTable, setPendingTable] = useState(null);

    const selectedBranchName = branches.find((branch) => branch.BranchId === selectedBranchId)?.BranchName;
    const [detailsOrder, setDetailsOrder] = useState(null);
    // A table with more than one still-active order (e.g. a second round
    // ordered after the first is already being prepared) needs a chooser -
    // clicking straight into whichever order happened to load last would
    // silently hide the other one from the staff member.
    const [tableOrdersView, setTableOrdersView] = useState(null);
    // The table whose consolidated bill is currently open in SettleBillDialog
    // - separate from tableOrdersView/detailsOrder, since settling reaches a
    // table's whole visit directly rather than any one order within it.
    const [settleBillTable, setSettleBillTable] = useState(null);
    // Live item count/subtotal reported up from PosOrderBuilder, shown in
    // the header strip so a captain glancing up while browsing the menu
    // doesn't need to look over at the cart panel for the running total.
    const [cartSummary, setCartSummary] = useState(null);
    // OrderIds with a status-advance request in flight - the quick-advance
    // button on the table grid had no guard against a rapid second tap
    // firing before the first one's response (and the table refresh it
    // triggers) landed, so a straggler tap would try to advance from a
    // status the order had already moved past and get rejected, stacking
    // up a wall of "Order status can only move forward" toasts.
    const [pendingAdvanceOrderIds, setPendingAdvanceOrderIds] = useState(() => new Set());

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
                    } else {
                        // No branch to select means the table-state effect
                        // below never fires, so nothing else will ever turn
                        // this off - an owner account with zero branches
                        // would otherwise spin forever instead of reaching
                        // PosTableGrid's own "no tables" empty state.
                        setLoading(false);
                    }

                }

            } catch {

                toast.error("Failed to load branches.");
                setLoading(false);

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
        const handleStatusChange = () => loadTableState(selectedBranchId, true);

        const handleCreated = (payload) => {

            // The captain who just rang this order up already saw its own
            // "Order placed" toast and KOT ticket - re-announcing it here
            // with a sound and a second toast was pure noise for exactly
            // the one admin who least needed telling. This notification is
            // for every OTHER till/admin watching the branch (a customer's
            // online order, or a second till), so it's skipped only for
            // the admin who actually created it.
            if (String(payload.createdByAdminId) !== String(auth?.admin?.AdminId)) {
                playNotificationSound();
                toast.success(`New order #${payload.orderId} received.`);
            }

            loadTableState(selectedBranchId, true);

        };

        channel.bind("order:created", handleCreated);
        channel.bind("order:status-changed", handleStatusChange);

        return () => {
            channel.unbind("order:created", handleCreated);
            channel.unbind("order:status-changed", handleStatusChange);
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

    // A table can have more than one active order at once (a dine-in table
    // orders starters, those go into the kitchen, then the same table
    // orders dessert before the first round is even delivered) - grouping
    // into an array here instead of overwriting by TableNumber keeps every
    // one of them visible instead of the newest silently hiding the rest.
    const activeOrdersByTable = new Map();

    activeOrders.forEach((order) => {
        const existing = activeOrdersByTable.get(order.TableNumber) || [];
        activeOrdersByTable.set(order.TableNumber, [...existing, order]);
    });

    // A live read of the floor at a glance - the grid below answers "which
    // table", this answers "how busy are we right now" without counting
    // tiles by eye. Derived from the same tables/activeOrdersByTable the
    // grid itself uses, so it can never drift out of sync with what's
    // actually rendered below it.
    const occupiedTableCount = tables.filter((table) => (activeOrdersByTable.get(table.TableName) || []).length > 0).length;
    const availableTableCount = tables.length - occupiedTableCount;

    const openOrderDetails = async (orderId) => {

        try {

            const response = await orderService.getOrderById(orderId);

            if (response.success) {
                setDetailsOrder(response.data);
            }

        } catch {

            toast.error("Failed to load order details.");

        }

    };

    const handleTableClick = (table, orders) => {

        if (!orders || orders.length === 0) {
            setPendingTable(table);
            setMode("dine-in");
            return;
        }

        // One order is the common case, and this needs to stay a single
        // tap straight to its details like it always was - routing even a
        // lone order through the chooser first (an earlier attempt at this)
        // doubled the taps for the case that happens on almost every table.
        // The chooser is worth the extra tap only when there's genuinely
        // more than one order to pick between.
        if (orders.length === 1) {
            openOrderDetails(orders[0].OrderId);
            return;
        }

        setTableOrdersView({ table, orders });

    };

    const handleSelectTableOrder = async (orderId) => {
        setTableOrdersView(null);
        await openOrderDetails(orderId);
    };

    // Same "start a fresh order" flow used for an empty table - the backend
    // has no rule against a second Dine In order on an already-occupied
    // table, this was purely a missing entry point in the UI.
    const handleAddAnotherOrder = (table) => {
        setTableOrdersView(null);
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

        if (pendingAdvanceOrderIds.has(orderId)) {
            return;
        }

        setPendingAdvanceOrderIds((prev) => new Set(prev).add(orderId));

        try {

            const response = await orderService.updateOrderStatus(orderId, orderStatus);

            if (!response.success) {
                toast.error(response.message, { id: `advance-${orderId}` });
                return;
            }

            toast.success(response.message);

            setDetailsOrder((prev) => (prev && prev.OrderId === orderId ? { ...prev, OrderStatus: orderStatus } : prev));

            await loadTableState(selectedBranchId, true);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order status.", { id: `advance-${orderId}` });

        } finally {

            setPendingAdvanceOrderIds((prev) => {
                const next = new Set(prev);
                next.delete(orderId);
                return next;
            });

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

    const isBuildingOrder = mode === "dine-in" || mode === "takeaway";
    const orderDeliveryType = mode === "dine-in" ? "Dine In" : "Takeaway";
    const backToFloor = () => { setMode("grid"); setPendingTable(null); };

    // Reclaims the sidebar's horizontal space for the order workspace while
    // a captain is actively taking an order - releases it (not "expands
    // it", the distinction matters: Layout.jsx keeps this separate from the
    // admin's own persisted collapse preference, so leaving the order
    // builder restores whatever they'd actually chosen, not just "open").
    // The cleanup also fires on unmount, so navigating away from /pos
    // entirely never leaves the sidebar stuck collapsed.
    useEffect(() => {

        window.dispatchEvent(new CustomEvent(SIDEBAR_FORCE_COLLAPSE_EVENT, { detail: isBuildingOrder }));

        return () => {
            window.dispatchEvent(new CustomEvent(SIDEBAR_FORCE_COLLAPSE_EVENT, { detail: false }));
        };

    }, [isBuildingOrder]);

    return (

        <Box>

            {/* Only the floor/grid view gets the page-level heading and branch
                picker - once a captain is actively building an order, this
                row would just repeat "New Order"/table info a second time
                right above the workstation's own compact header, at the
                cost of real vertical space a working POS screen can't spare. */}
            {mode === "grid" && (

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5, flexWrap: "wrap", gap: 2 }}>

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

                        <Button variant="outlined" onClick={handleTakeaway}>
                            Takeaway / Counter Order
                        </Button>

                    </Box>

                </Box>

            )}

            {mode === "grid" && !loading && tables.length > 0 && (

                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>

                    <Chip
                        label={`${occupiedTableCount} Occupied`}
                        color="warning"
                        size="small"
                        variant={occupiedTableCount > 0 ? "filled" : "outlined"}
                    />

                    <Chip
                        label={`${availableTableCount} Available`}
                        color="success"
                        size="small"
                        variant={availableTableCount > 0 ? "filled" : "outlined"}
                    />

                    <Typography variant="body2" color="text.secondary">
                        {tables.length} table{tables.length === 1 ? "" : "s"} total
                    </Typography>

                </Stack>

            )}

            {mode === "grid" && (

                loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    <PosTableGrid
                        tables={tables}
                        activeOrdersByTable={activeOrdersByTable}
                        onTableClick={handleTableClick}
                        onQuickAdvance={handleAdvanceStatus}
                        onAddOrder={handleAddAnotherOrder}
                        onSettleBill={setSettleBillTable}
                        pendingAdvanceOrderIds={pendingAdvanceOrderIds}
                    />

                )

            )}

            {/* Full-height workstation, not a form-in-a-card: 80px/48px below
                is exactly Layout.jsx's own chrome around <main> at this
                breakpoint (mobile app bar + content padding below md; just
                content padding from md up) - not a guess, and the only two
                numbers that ever need to change here are if that padding
                does. Gated on min-height as well as min-width, not just
                sm/md width alone - a phone in landscape can cross the sm
                width threshold while still only having ~350-400px of actual
                height to work with, which isn't enough room for the cart's
                own fixed-header/scrollable/fixed-footer split below (found
                by actually testing that orientation, not guessed). Below
                that combined threshold this intentionally has no fixed
                height at all, so it's a normal scrolling page instead of a
                cramped, overlapping fixed box. */}
            {isBuildingOrder && selectedBranchId && (mode === "takeaway" || pendingTable) && (

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        height: "auto",
                        "@media (min-width:600px) and (min-height:500px)": { height: "calc(100vh - 80px)" },
                        "@media (min-width:900px) and (min-height:500px)": { height: "calc(100vh - 48px)" },
                        minHeight: 0
                    }}
                >

                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1.5, flexShrink: 0 }}>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>

                            <IconButton size="small" onClick={backToFloor} sx={{ display: { sm: "none" } }}>
                                <ArrowBackRoundedIcon fontSize="small" />
                            </IconButton>

                            {mode === "dine-in" ? <TableRestaurantRoundedIcon color="primary" fontSize="small" /> : <ShoppingBagRoundedIcon color="primary" fontSize="small" />}

                            <Typography variant="subtitle1" fontWeight={800} noWrap>
                                {mode === "dine-in" ? `Table ${pendingTable.TableName}` : "Takeaway"}
                            </Typography>

                            <Chip label={orderDeliveryType} size="small" sx={{ fontWeight: 700 }} />

                            {/* Live totals reported up from PosOrderBuilder -
                                hidden until there's actually a cart to
                                summarize, rather than showing "0 Items" on
                                an empty order. */}
                            {cartSummary && cartSummary.itemCount > 0 && (

                                <Chip
                                    label={`${cartSummary.itemCount} Item${cartSummary.itemCount === 1 ? "" : "s"} · ${formatCurrency(cartSummary.subtotal)}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 700, borderColor: "primary.main", color: "primary.main", display: { xs: "none", sm: "flex" } }}
                                />

                            )}

                        </Box>

                        <Button
                            size="small"
                            startIcon={<ArrowBackRoundedIcon />}
                            onClick={backToFloor}
                            sx={{ display: { xs: "none", sm: "inline-flex" } }}
                        >
                            Back to Floor
                        </Button>

                    </Box>

                    <Box sx={{ flex: 1, minHeight: 0 }}>

                        <PosOrderBuilder
                            key={mode === "dine-in" ? `dine-in-${selectedBranchId}-${pendingTable.TableId}` : `takeaway-${selectedBranchId}`}
                            branchId={selectedBranchId}
                            branchName={selectedBranchName}
                            deliveryType={orderDeliveryType}
                            tableNumber={mode === "dine-in" ? pendingTable.TableName : undefined}
                            onCreated={handleOrderCreated}
                            onCartSummaryChange={setCartSummary}
                        />

                    </Box>

                </Box>

            )}

            <PosOrderDetails
                open={Boolean(detailsOrder)}
                order={detailsOrder}
                onClose={() => setDetailsOrder(null)}
                onAdvanceStatus={handleAdvanceStatus}
                onCancelOrder={handleCancelOrder}
            />

            <PosTableOrdersDialog
                open={Boolean(tableOrdersView)}
                table={tableOrdersView?.table}
                orders={tableOrdersView?.orders || []}
                onSelectOrder={handleSelectTableOrder}
                onAddAnotherOrder={() => handleAddAnotherOrder(tableOrdersView.table)}
                onClose={() => setTableOrdersView(null)}
            />

            <SettleBillDialog
                open={Boolean(settleBillTable)}
                branchId={selectedBranchId}
                table={settleBillTable}
                onClose={() => setSettleBillTable(null)}
                onSettled={() => loadTableState(selectedBranchId, true)}
            />

        </Box>

    );

}

export default Pos;
