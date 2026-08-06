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
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import * as menuService from "../services/menuService";
import { getStoredAuth } from "../utils/adminAuth";
import BillReceipt from "../components/BillReceipt";
import PosItemOptionsDialog from "./PosItemOptionsDialog";
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

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [emailingBill, setEmailingBill] = useState(false);
    const [billOpen, setBillOpen] = useState(false);

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
        }

        if (!open) {
            setOrder(null);
            setEditingItems(false);
            setEditLines([]);
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

    const handleCancel = async () => {

        if (!window.confirm("Cancel this order? This cannot be undone.")) {
            return;
        }

        try {

            setActionLoading(true);

            const response = await orderService.cancelOrder(orderId);

            if (!response.success) {
                toast.error(response.message || "Failed to cancel order.");
                return;
            }

            toast.success(response.message || "Order cancelled.");
            onChanged?.();
            loadOrder();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to cancel order.");

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
                                    onClick={handleCancel}
                                    sx={{ ml: "auto" }}
                                >
                                    Cancel Order
                                </Button>

                            </Box>

                        )}

                    </Box>

                )}

            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

            {order && (

                <Dialog open={billOpen} onClose={() => setBillOpen(false)} maxWidth="xs" fullWidth>

                    <DialogContent sx={{ pt: 3 }}>
                        <BillReceipt order={order} restaurantName={auth?.admin?.tenantName} />
                    </DialogContent>

                    <DialogActions>
                        <Button onClick={() => setBillOpen(false)}>Close</Button>
                        <Button
                            variant="contained"
                            startIcon={<PrintOutlinedIcon />}
                            onClick={() => window.print()}
                        >
                            Print
                        </Button>
                    </DialogActions>

                </Dialog>

            )}

            <PosItemOptionsDialog
                open={Boolean(optionsDialogItem)}
                menuItem={optionsDialogItem}
                onClose={() => setOptionsDialogItem(null)}
                onConfirm={handleConfirmAddOptions}
            />

        </Dialog>

    );

}

export default OrderDetailsDialog;
