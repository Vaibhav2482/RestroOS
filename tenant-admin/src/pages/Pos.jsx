import { useEffect, useState } from "react";
import { ChevronDown, ShoppingBag, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "../lib/utils";
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

    const selectedBranchName = branches.find((branch) => branch.BranchId === selectedBranchId)?.BranchName;
    const [detailsOrder, setDetailsOrder] = useState(null);
    // A table with more than one still-active order (e.g. a second round
    // ordered after the first is already being prepared) needs a chooser -
    // clicking straight into whichever order happened to load last would
    // silently hide the other one from the staff member.
    const [tableOrdersView, setTableOrdersView] = useState(null);
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
        const handleStatusChange = () => loadTableState(selectedBranchId, true);

        const handleCreated = (payload) => {
            playNotificationSound();
            toast.success(`New order #${payload.orderId} received.`);
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

    const handleBackToGrid = () => {
        setPendingTable(null);
        setMode("grid");
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

    return (

        <div className="font-sans">

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">

                <h1 className="text-2xl font-extrabold text-foreground">Take Order</h1>

                <div className="flex items-center gap-3">

                    {ownerMode && branches.length > 0 && (

                        <div className="relative">
                            <select
                                value={selectedBranchId ?? ""}
                                onChange={(event) => {
                                    setSelectedBranchId(Number(event.target.value));
                                    setMode("grid");
                                    setPendingTable(null);
                                }}
                                className="h-10 appearance-none rounded-xl border border-border bg-card pl-3.5 pr-9 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                {branches.map((branch) => (
                                    <option key={branch.BranchId} value={branch.BranchId}>
                                        {branch.BranchName}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>

                    )}

                    <div className="flex rounded-xl border border-border bg-muted p-1">

                        <button
                            type="button"
                            onClick={handleBackToGrid}
                            className={cn(
                                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                                mode !== "takeaway" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                            )}
                        >
                            <UtensilsCrossed className="h-3.5 w-3.5" /> Dine In
                        </button>

                        <button
                            type="button"
                            onClick={handleTakeaway}
                            className={cn(
                                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                                mode === "takeaway" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                            )}
                        >
                            <ShoppingBag className="h-3.5 w-3.5" /> Takeaway
                        </button>

                    </div>

                </div>

            </div>

            {mode === "grid" && (

                loading ? (

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="h-52 animate-pulse rounded-2xl border border-border bg-card" />
                        ))}
                    </div>

                ) : (

                    <PosTableGrid
                        tables={tables}
                        activeOrdersByTable={activeOrdersByTable}
                        onTableClick={handleTableClick}
                        onQuickAdvance={handleAdvanceStatus}
                        onAddOrder={handleAddAnotherOrder}
                        pendingAdvanceOrderIds={pendingAdvanceOrderIds}
                    />

                )

            )}

            {mode === "dine-in" && pendingTable && selectedBranchId && (

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">

                    <h2 className="mb-4 text-base font-bold text-foreground">
                        New Order — Table {pendingTable.TableName}
                    </h2>

                    <PosOrderBuilder
                        key={`dine-in-${selectedBranchId}-${pendingTable.TableId}`}
                        branchId={selectedBranchId}
                        branchName={selectedBranchName}
                        deliveryType="Dine In"
                        tableNumber={pendingTable.TableName}
                        onCreated={handleOrderCreated}
                        onCancel={() => { setMode("grid"); setPendingTable(null); }}
                    />

                </div>

            )}

            {mode === "takeaway" && selectedBranchId && (

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">

                    <h2 className="mb-4 text-base font-bold text-foreground">
                        New Order — Takeaway
                    </h2>

                    <PosOrderBuilder
                        key={`takeaway-${selectedBranchId}`}
                        branchId={selectedBranchId}
                        branchName={selectedBranchName}
                        deliveryType="Takeaway"
                        onCreated={handleOrderCreated}
                        onCancel={() => setMode("grid")}
                    />

                </div>

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

        </div>

    );

}

export default Pos;
