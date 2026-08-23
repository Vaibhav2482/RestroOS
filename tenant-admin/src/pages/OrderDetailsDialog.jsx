import { useEffect, useState } from "react";
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import SoupKitchenOutlinedIcon from "@mui/icons-material/SoupKitchenOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import * as menuService from "../services/menuService";
import * as paymentService from "../services/paymentService";
import { getStoredAuth } from "../utils/adminAuth";
import BillReceipt from "../components/BillReceipt";
import KotReceipt from "../components/KotReceipt";
import PrintDialog from "../components/PrintDialog";
import PosItemOptionsDialog from "./PosItemOptionsDialog";
import { useThermalPrint } from "../hooks/useThermalPrint";
import { buildKotTicket } from "../utils/kotEscpos";
import {
    formatCurrency,
    getNextStatuses,
    getStatusChipColor,
    isTerminalStatus
} from "./orderStatusUtils";

// Builds the same lineKey shape createOrder/PosOrderBuilder use - a menu
// item plus its sorted option-id set - so adding an item that matches an
// existing line (via the picker below) merges quantity instead of creating
// a duplicate row.
const buildLineKey = (menuItemId, selectedOptionIds = []) =>
    `${menuItemId}::${[...selectedOptionIds].sort((a, b) => a - b).join(",")}`;

const linesFromOrderItems = (items = []) =>
    items.map((item) => {

        const selectedOptionIds = (item.SelectedOptions || []).map((option) => option.OptionId);

        return {
            lineKey: buildLineKey(item.MenuItemId, selectedOptionIds),
            menuItemId: item.MenuItemId,
            itemName: item.ItemName,
            price: Number(item.Price),
            quantity: item.Quantity,
            selectedOptionIds: [...selectedOptionIds].sort((a, b) => a - b),
            summary: (item.SelectedOptions || []).map((option) => option.OptionName).join(", ")
        };

    });

function OrderDetailsDialog({ open, orderId, onClose, onChanged }) {

    const auth = getStoredAuth();
    const { printing: kotPrinting, print: printKot } = useThermalPrint();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [emailingBill, setEmailingBill] = useState(false);
    const [billOpen, setBillOpen] = useState(false);
    const [kotOpen, setKotOpen] = useState(false);

    // Refundable payment (if any) and the void/refund history - both
    // best-effort side-loads alongside the order itself, since neither
    // failing to load should block viewing the order.
    const [payment, setPayment] = useState(null);
    const [adjustments, setAdjustments] = useState([]);

    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");

    const [refundDialogOpen, setRefundDialogOpen] = useState(false);
    const [refundAmount, setRefundAmount] = useState("");
    const [refundReason, setRefundReason] = useState("");

    // Items can only be edited while an order is still Pending (enforced
    // server-side too - see OrderRepository.updateOrderItems). editLines is
    // a local draft; nothing is sent to the API until "Save Changes".
    const [editingItems, setEditingItems] = useState(false);
    const [editLines, setEditLines] = useState([]);
    const [savingItems, setSavingItems] = useState(false);
    const [menuItems, setMenuItems] = useState([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [optionsDialogItem, setOptionsDialogItem] = useState(null);

    useEffect(() => {

        if (open && orderId) {
            loadOrder();
            loadPayment();
            loadAdjustments();
        }

        if (!open) {
            setOrder(null);
            setEditingItems(false);
            setEditLines([]);
            setPayment(null);
            setAdjustments([]);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, orderId]);

    const loadOrder = async () => {

        try {

            setLoading(true);

            const response = await orderService.getOrderById(orderId);

            if (response.success) {
                setOrder(response.data);
            } else {
                toast.error(response.message || "Failed to load order details.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load order details.");

        } finally {

            setLoading(false);

        }

    };

    // Best-effort: "no payment yet" is the ordinary case for most orders,
    // not an error worth surfacing to the person just trying to view it.
    const loadPayment = async () => {

        try {

            const response = await paymentService.getPaymentByOrderId(orderId);
            const refundable = (response.data || []).find((row) => row.PaymentStatus === "Paid" || row.PaymentStatus === "Partially Refunded");

            setPayment(refundable || null);

        } catch {

            setPayment(null);

        }

    };

    const loadAdjustments = async () => {

        try {

            const response = await orderService.getOrderAdjustments(orderId);
            setAdjustments(response.data || []);

        } catch {

            setAdjustments([]);

        }

    };

    const handleAdvanceStatus = async (nextStatus) => {

        try {

            setActionLoading(true);

            const response = await orderService.updateOrderStatus(orderId, nextStatus);

            if (!response.success) {
                toast.error(response.message || "Failed to update order status.");
                return;
            }

            toast.success(response.message || "Order status updated.");
            onChanged?.();
            loadOrder();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order status.");

        } finally {

            setActionLoading(false);

        }

    };

    // A staff void always needs a reason (server-enforced too - see
    // OrderService.cancelOrder) - window.confirm had no way to collect one.
    const handleConfirmCancel = async () => {

        if (!cancelReason.trim()) {
            toast.error("A reason is required to cancel an order.");
            return;
        }

        try {

            setActionLoading(true);

            const response = await orderService.cancelOrder(orderId, cancelReason.trim());

            if (!response.success) {
                toast.error(response.message || "Failed to cancel order.");
                return;
            }

            toast.success(response.message || "Order cancelled.");
            setCancelDialogOpen(false);
            setCancelReason("");
            onChanged?.();
            loadOrder();
            loadAdjustments();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to cancel order.");

        } finally {

            setActionLoading(false);

        }

    };

    const refundableBalance = payment
        ? Math.max(0, Number(payment.Amount) - adjustments
            .filter((row) => row.AdjustmentType === "REFUND")
            .reduce((sum, row) => sum + Number(row.Amount), 0))
        : 0;

    const handleConfirmRefund = async () => {

        if (!refundReason.trim()) {
            toast.error("A reason is required to refund an order.");
            return;
        }

        const amount = Number(refundAmount);

        if (!amount || amount <= 0) {
            toast.error("Refund amount must be greater than 0.");
            return;
        }

        try {

            setActionLoading(true);

            const response = await orderService.refundOrder(orderId, amount, refundReason.trim());

            if (!response.success) {
                toast.error(response.message || "Failed to refund order.");
                return;
            }

            toast.success(response.message || "Order refunded.");
            setRefundDialogOpen(false);
            setRefundAmount("");
            setRefundReason("");
            loadPayment();
            loadAdjustments();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to refund order.");

        } finally {

            setActionLoading(false);

        }

    };

    const handleStartEditItems = async () => {

        setEditLines(linesFromOrderItems(order.Items));
        setEditingItems(true);

        if (menuItems.length === 0) {

            try {

                setMenuLoading(true);

                const response = await menuService.getAllMenuItems(order.BranchId);

                if (response.success) {
                    setMenuItems(response.data.filter((item) => item.IsAvailable && item.IsActive));
                } else {
                    toast.error(response.message || "Failed to load the menu.");
                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load the menu.");

            } finally {

                setMenuLoading(false);

            }

        }

    };

    const handleCancelEditItems = () => {
        setEditingItems(false);
        setEditLines([]);
    };

    const handleLineQuantityChange = (lineKey, delta) => {

        setEditLines((prev) =>
            prev
                .map((line) => (line.lineKey === lineKey ? { ...line, quantity: line.quantity + delta } : line))
                .filter((line) => line.quantity > 0)
        );

    };

    const handleRemoveLine = (lineKey) => {
        setEditLines((prev) => prev.filter((line) => line.lineKey !== lineKey));
    };

    // Plain items (no option groups) add straight to the draft; items with
    // options open PosItemOptionsDialog first, same split PosOrderBuilder
    // uses when building a new order.
    const handlePickMenuItem = (item) => {

        if (!item) {
            return;
        }

        if (item.HasOptions) {
            setOptionsDialogItem(item);
            return;
        }

        const lineKey = buildLineKey(item.MenuItemId, []);

        setEditLines((prev) => {

            const existing = prev.find((line) => line.lineKey === lineKey);

            if (existing) {
                return prev.map((line) => (line.lineKey === lineKey ? { ...line, quantity: line.quantity + 1 } : line));
            }

            return [
                ...prev,
                {
                    lineKey,
                    menuItemId: item.MenuItemId,
                    itemName: item.ItemName,
                    price: Number(item.Price),
                    quantity: 1,
                    selectedOptionIds: [],
                    summary: ""
                }
            ];

        });

    };

    const handleConfirmAddOptions = ({ menuItemId, quantity, selectedOptionIds, unitPrice, summary }) => {

        const lineKey = buildLineKey(menuItemId, selectedOptionIds);
        const item = menuItems.find((menuItem) => menuItem.MenuItemId === menuItemId);

        setEditLines((prev) => {

            const existing = prev.find((line) => line.lineKey === lineKey);

            if (existing) {
                return prev.map((line) => (line.lineKey === lineKey ? { ...line, quantity: line.quantity + quantity } : line));
            }

            return [
                ...prev,
                {
                    lineKey,
                    menuItemId,
                    itemName: item?.ItemName ?? "",
                    price: unitPrice,
                    quantity,
                    selectedOptionIds: [...selectedOptionIds].sort((a, b) => a - b),
                    summary
                }
            ];

        });

        setOptionsDialogItem(null);

    };

    const handleSaveItems = async () => {

        if (editLines.length === 0) {
            toast.error("Order must contain at least one item.");
            return;
        }

        try {

            setSavingItems(true);

            const items = editLines.map((line) => ({
                menuItemId: line.menuItemId,
                quantity: line.quantity,
                selectedOptionIds: line.selectedOptionIds
            }));

            const response = await orderService.updateOrderItems(orderId, items);

            if (!response.success) {
                toast.error(response.message || "Failed to update order items.");
                return;
            }

            toast.success(response.message || "Order items updated.");
            setEditingItems(false);
            onChanged?.();
            loadOrder();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update order items.");

        } finally {

            setSavingItems(false);

        }

    };

    const handleEmailBill = async () => {

        try {

            setEmailingBill(true);

            const response = await orderService.emailBill(orderId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message || "Bill emailed.");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to email the bill.");

        } finally {

            setEmailingBill(false);

        }

    };

    const nextStatuses = order ? getNextStatuses(order.OrderStatus, order.DeliveryType) : [];
    const terminal = order ? isTerminalStatus(order.OrderStatus) : false;

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                Order {order ? `#${order.OrderId}` : ""}

                <IconButton onClick={onClose} size="small">
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>

            </DialogTitle>

            <DialogContent dividers>

                {loading || !order ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    <Box>

                        <Grid container spacing={2} sx={{ mb: 2 }}>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Customer</Typography>
                                <Typography fontWeight={600}>{order.CustomerName || "Guest"}</Typography>
                                {order.CustomerPhone && (
                                    <Typography variant="body2" color="text.secondary">{order.CustomerPhone}</Typography>
                                )}
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Branch</Typography>
                                <Typography fontWeight={600}>{order.BranchName || "-"}</Typography>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Order Type</Typography>
                                <Typography fontWeight={600}>
                                    {order.DeliveryType}
                                    {order.DeliveryType === "Dine In" && order.TableNumber ? ` (Table ${order.TableNumber})` : ""}
                                </Typography>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Payment Method</Typography>
                                <Typography fontWeight={600}>{order.PaymentMethod || "-"}</Typography>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Order Date</Typography>
                                <Typography fontWeight={600}>{new Date(order.OrderDate).toLocaleString()}</Typography>
                            </Grid>

                            {order.CreatedByAdminName && (
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <Typography variant="caption" color="text.secondary">Taken By</Typography>
                                    <Typography fontWeight={600}>{order.CreatedByAdminName}</Typography>
                                </Grid>
                            )}

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">Status</Typography>
                                <Box sx={{ mt: 0.5 }}>
                                    <Chip
                                        label={order.OrderStatus}
                                        color={getStatusChipColor(order.OrderStatus)}
                                        size="small"
                                    />
                                </Box>
                            </Grid>

                            {order.OrderNotes && (
                                <Grid size={{ xs: 12 }}>
                                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                                    <Typography>{order.OrderNotes}</Typography>
                                </Grid>
                            )}

                        </Grid>

                        <Divider sx={{ mb: 2 }} />

                        <TableContainer sx={{ border: "1px solid #E5E7EB", borderRadius: 2, mb: 2 }}>

                            <Table size="small">

                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item</TableCell>
                                        <TableCell align="right">Price</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                        {editingItems && <TableCell align="right" />}
                                    </TableRow>
                                </TableHead>

                                <TableBody>

                                    {editingItems ? (

                                        editLines.map((line) => (

                                            <TableRow key={line.lineKey}>
                                                <TableCell>
                                                    {line.itemName}
                                                    {line.summary && (
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {line.summary}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">{formatCurrency(line.price)}</TableCell>
                                                <TableCell align="right">
                                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                                                        <IconButton size="small" onClick={() => handleLineQuantityChange(line.lineKey, -1)}>
                                                            <RemoveRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                        <Typography sx={{ minWidth: 20, textAlign: "center" }}>{line.quantity}</Typography>
                                                        <IconButton size="small" onClick={() => handleLineQuantityChange(line.lineKey, 1)}>
                                                            <AddRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right">{formatCurrency(line.price * line.quantity)}</TableCell>
                                                <TableCell align="right">
                                                    <IconButton size="small" color="error" onClick={() => handleRemoveLine(line.lineKey)}>
                                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>

                                        ))

                                    ) : (

                                        (order.Items || []).map((item) => (

                                            <TableRow key={item.OrderItemId}>
                                                <TableCell>{item.ItemName}</TableCell>
                                                <TableCell align="right">{formatCurrency(item.Price)}</TableCell>
                                                <TableCell align="right">{item.Quantity}</TableCell>
                                                <TableCell align="right">{formatCurrency(item.TotalPrice)}</TableCell>
                                            </TableRow>

                                        ))

                                    )}

                                </TableBody>

                            </Table>

                        </TableContainer>

                        {editingItems && (

                            <Box sx={{ mb: 2 }}>

                                <Autocomplete
                                    size="small"
                                    loading={menuLoading}
                                    options={menuItems}
                                    getOptionLabel={(item) => item.ItemName}
                                    isOptionEqualToValue={(a, b) => a.MenuItemId === b.MenuItemId}
                                    value={null}
                                    onChange={(event, item) => handlePickMenuItem(item)}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Add item to order" placeholder="Search menu..." />
                                    )}
                                />

                            </Box>

                        )}

                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
                            <Typography variant="h6" fontWeight={700}>
                                Total: {editingItems
                                    ? formatCurrency(editLines.reduce((sum, line) => sum + line.price * line.quantity, 0))
                                    : formatCurrency(order.TotalAmount)}
                            </Typography>
                        </Box>

                        {editingItems ? (

                            <Box sx={{ display: "flex", gap: 1, mb: 3 }}>

                                <Button
                                    size="small"
                                    variant="contained"
                                    disabled={savingItems}
                                    onClick={handleSaveItems}
                                >
                                    {savingItems ? "Saving..." : "Save Changes"}
                                </Button>

                                <Button
                                    size="small"
                                    variant="text"
                                    disabled={savingItems}
                                    onClick={handleCancelEditItems}
                                >
                                    Cancel
                                </Button>

                            </Box>

                        ) : (

                            <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>

                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<PrintOutlinedIcon />}
                                    onClick={() => setBillOpen(true)}
                                >
                                    View / Print Bill
                                </Button>

                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<SoupKitchenOutlinedIcon />}
                                    onClick={() => setKotOpen(true)}
                                >
                                    Print KOT
                                </Button>

                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EmailOutlinedIcon />}
                                    disabled={emailingBill}
                                    onClick={handleEmailBill}
                                >
                                    {emailingBill ? "Sending..." : "Email Bill"}
                                </Button>

                                {order.OrderStatus === "Pending" && (

                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<EditOutlinedIcon />}
                                        onClick={handleStartEditItems}
                                    >
                                        Edit Items
                                    </Button>

                                )}

                            </Box>

                        )}

                        {editingItems ? null : terminal ? (

                            <Typography color="text.secondary">
                                This order is {order.OrderStatus.toLowerCase()} — no further action available.
                            </Typography>

                        ) : (

                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>

                                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                    Advance to:
                                </Typography>

                                {nextStatuses.map((status) => (

                                    <Button
                                        key={status}
                                        size="small"
                                        variant="outlined"
                                        disabled={actionLoading}
                                        onClick={() => handleAdvanceStatus(status)}
                                    >
                                        {status}
                                    </Button>

                                ))}

                                <Button
                                    size="small"
                                    color="error"
                                    variant="text"
                                    disabled={actionLoading}
                                    onClick={() => setCancelDialogOpen(true)}
                                    sx={{ ml: "auto" }}
                                >
                                    Cancel Order
                                </Button>

                            </Box>

                        )}

                        {/* Independent of order status - a refund makes sense on a
                            Delivered order too (a complaint after the fact), not
                            just while it's still active. */}
                        {!editingItems && refundableBalance > 0 && (

                            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                                <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    startIcon={<CurrencyRupeeRoundedIcon fontSize="small" />}
                                    disabled={actionLoading}
                                    onClick={() => { setRefundAmount(refundableBalance.toFixed(2)); setRefundDialogOpen(true); }}
                                >
                                    Refund
                                </Button>
                            </Box>

                        )}

                        {adjustments.length > 0 && (

                            <Box sx={{ mt: 2 }}>

                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                                    History
                                </Typography>

                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>

                                    {adjustments.map((adjustment) => (

                                        <Box key={adjustment.AdjustmentId} sx={{ fontSize: 13, color: "text.secondary" }}>
                                            <Chip
                                                label={adjustment.AdjustmentType === "VOID" ? "Void" : "Refund"}
                                                size="small"
                                                color={adjustment.AdjustmentType === "VOID" ? "error" : "warning"}
                                                sx={{ mr: 1, height: 20, fontSize: 11 }}
                                            />
                                            {adjustment.AdjustmentType === "REFUND" && (
                                                <strong>{formatCurrency(adjustment.Amount)} — </strong>
                                            )}
                                            {adjustment.Reason} <em>({adjustment.ActorAdminName}, {new Date(adjustment.CreatedAt).toLocaleString()})</em>
                                        </Box>

                                    ))}

                                </Box>

                            </Box>

                        )}

                    </Box>

                )}

            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

            {order && (

                <PrintDialog open={billOpen} onClose={() => setBillOpen(false)}>
                    <BillReceipt order={order} restaurantName={auth?.admin?.tenantName} />
                </PrintDialog>

            )}

            {order && (

                <PrintDialog
                    open={kotOpen}
                    onClose={() => setKotOpen(false)}
                    printLabel="Print KOT"
                    variant="drawer"
                    title={order ? `Order #${order.OrderId}` : "KOT"}
                    printing={kotPrinting}
                    onPrint={() => printKot(() => buildKotTicket({ order, restaurantName: auth?.admin?.tenantName }))}
                >
                    <KotReceipt order={order} restaurantName={auth?.admin?.tenantName} />
                </PrintDialog>

            )}

            <PosItemOptionsDialog
                open={Boolean(optionsDialogItem)}
                menuItem={optionsDialogItem}
                onClose={() => setOptionsDialogItem(null)}
                onConfirm={handleConfirmAddOptions}
            />

            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="xs" fullWidth>

                <DialogTitle>Cancel Order</DialogTitle>

                <DialogContent>

                    <DialogContentText sx={{ mb: 2 }}>
                        This cannot be undone. A reason is required and is recorded against your name.
                    </DialogContentText>

                    <TextField
                        autoFocus
                        fullWidth
                        required
                        multiline
                        rows={2}
                        label="Reason"
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                    />

                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setCancelDialogOpen(false)} disabled={actionLoading}>Back</Button>
                    <Button color="error" variant="contained" onClick={handleConfirmCancel} disabled={actionLoading || !cancelReason.trim()}>
                        {actionLoading ? "Cancelling..." : "Cancel Order"}
                    </Button>
                </DialogActions>

            </Dialog>

            <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)} maxWidth="xs" fullWidth>

                <DialogTitle>Refund</DialogTitle>

                <DialogContent>

                    <DialogContentText sx={{ mb: 2 }}>
                        Up to {formatCurrency(refundableBalance)} remains refundable on this order. This does not cancel the order.
                    </DialogContentText>

                    <TextField
                        fullWidth
                        required
                        type="number"
                        label="Amount"
                        value={refundAmount}
                        onChange={(event) => setRefundAmount(event.target.value)}
                        slotProps={{ htmlInput: { min: 0, max: refundableBalance, step: "0.01" } }}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        fullWidth
                        required
                        multiline
                        rows={2}
                        label="Reason"
                        value={refundReason}
                        onChange={(event) => setRefundReason(event.target.value)}
                    />

                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setRefundDialogOpen(false)} disabled={actionLoading}>Back</Button>
                    <Button color="error" variant="contained" onClick={handleConfirmRefund} disabled={actionLoading || !refundReason.trim() || !refundAmount}>
                        {actionLoading ? "Refunding..." : "Refund"}
                    </Button>
                </DialogActions>

            </Dialog>

        </Dialog>

    );

}

export default OrderDetailsDialog;
