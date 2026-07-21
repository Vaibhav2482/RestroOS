import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import toast from "react-hot-toast";

import * as menuService from "../services/menuService";
import * as categoryService from "../services/categoryService";
import * as customerService from "../services/customerService";
import * as orderService from "../services/orderService";
import PosItemOptionsDialog from "./PosItemOptionsDialog";

const PAYMENT_METHODS = ["Cash", "Card", "UPI"];
const GUEST_PHONE = "0000000000";

// The order-builder half of the POS flow: browse menu, build a cart, attach
// a customer (or fall back to the shared guest placeholder), pick a payment
// method and submit. GST is computed server-side, so only a pre-tax
// subtotal is shown here.
function PosOrderBuilder({ branchId, deliveryType, tableNumber, onCreated, onCancel }) {

    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [itemSearch, setItemSearch] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState("all");

    const [cartLines, setCartLines] = useState([]);
    const [optionsDialogItem, setOptionsDialogItem] = useState(null);

    const [resolvedCustomer, setResolvedCustomer] = useState(null);
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [needsName, setNeedsName] = useState(false);
    const [checkingCustomer, setCheckingCustomer] = useState(false);

    const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);

    // Default to the shared guest placeholder so staff can start adding items
    // immediately; they can still swap in a real customer below.
    useEffect(() => {

        (async () => {

            try {

                const response = await customerService.getOrCreateGuestCustomer();

                if (response.success) {
                    setResolvedCustomer(response.data);
                }

            } catch {

                // Non-fatal — the customer step still lets staff type a phone in manually.

            }

        })();

        (async () => {

            try {

                const response = await categoryService.getAllCategories();

                if (response.success) {
                    setCategories(response.data.filter((category) => category.IsActive !== false));
                }

            } catch {

                toast.error("Failed to load categories.");

            }

        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        if (!branchId) {
            return;
        }

        (async () => {

            try {

                setMenuLoading(true);

                const response = await menuService.getAllMenuItems(branchId);

                if (response.success) {
                    setMenuItems(response.data.filter((item) => item.IsAvailable && item.IsActive));
                }

            } catch {

                toast.error("Failed to load menu for this branch.");

            } finally {

                setMenuLoading(false);

            }

        })();

    }, [branchId]);

    const isGuest = resolvedCustomer?.Phone === GUEST_PHONE;

    const handleFindCustomer = async () => {

        if (!customerPhone.trim()) {
            toast.error("Enter a phone number.");
            return;
        }

        setCheckingCustomer(true);

        try {

            const response = await customerService.findOrCreateWalkInCustomer({
                phone: customerPhone.trim(),
                fullName: needsName ? customerName.trim() : undefined
            });

            if (!response.success) {

                if (response.message?.includes("Full Name is required")) {
                    setNeedsName(true);
                } else {
                    toast.error(response.message);
                }

                return;

            }

            setResolvedCustomer(response.data);
            setNeedsName(false);
            toast.success(needsName ? "Customer created." : "Customer found.");

        } catch (error) {

            const message = error.response?.data?.message;

            if (message?.includes("Full Name is required")) {
                setNeedsName(true);
            } else {
                toast.error(message || "Failed to look up customer.");
            }

        } finally {

            setCheckingCustomer(false);

        }

    };

    const handleUseGuest = async () => {

        setCheckingCustomer(true);

        try {

            const response = await customerService.getOrCreateGuestCustomer();

            if (response.success) {
                setResolvedCustomer(response.data);
                setNeedsName(false);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to start a guest order.");

        } finally {

            setCheckingCustomer(false);

        }

    };

    const handleChangeCustomer = () => {
        setResolvedCustomer(null);
        setNeedsName(false);
        setCustomerPhone("");
        setCustomerName("");
    };

    // Sums quantity across every cart line for a menu item — a plain item
    // only ever has one line, but a customized item can have several (one
    // per distinct combination of selected options), so this doubles as the
    // "total in cart" badge for options-enabled items too.
    const getQuantity = (menuItemId) =>
        cartLines
            .filter((line) => line.menuItemId === menuItemId)
            .reduce((sum, line) => sum + line.quantity, 0);

    const handleIncrement = (menuItem) => {

        setCartLines((prev) => {

            const existing = prev.find((line) => line.menuItemId === menuItem.MenuItemId);

            if (existing) {
                return prev.map((line) =>
                    line.menuItemId === menuItem.MenuItemId
                        ? { ...line, quantity: line.quantity + 1 }
                        : line
                );
            }

            return [
                ...prev,
                {
                    lineKey: String(menuItem.MenuItemId),
                    menuItemId: menuItem.MenuItemId,
                    itemName: menuItem.ItemName,
                    price: Number(menuItem.Price),
                    quantity: 1,
                    selectedOptionIds: [],
                    summary: undefined
                }
            ];

        });

    };

    // Menu items with option groups open the customization dialog instead of
    // adding straight to the cart; plain items keep the old direct-add path.
    const handleAddClick = (item) => {

        if (item.HasOptions) {
            setOptionsDialogItem(item);
        } else {
            handleIncrement(item);
        }

    };

    // Called back by PosItemOptionsDialog with the resolved selection. Two
    // customizations of the same menu item are distinct line items — only an
    // identical set of selected options merges quantity into an existing
    // line, mirroring how the storefront cart treats variants.
    const handleConfirmOptions = ({ menuItemId, quantity, selectedOptionIds, unitPrice, summary }) => {

        const sortedOptionIds = [...selectedOptionIds].sort((a, b) => a - b);
        const lineKey = `${menuItemId}::${sortedOptionIds.join(",")}`;
        const item = menuItems.find((menuItem) => menuItem.MenuItemId === menuItemId);

        setCartLines((prev) => {

            const existing = prev.find((line) => line.lineKey === lineKey);

            if (existing) {
                return prev.map((line) =>
                    line.lineKey === lineKey
                        ? { ...line, quantity: line.quantity + quantity }
                        : line
                );
            }

            return [
                ...prev,
                {
                    lineKey,
                    menuItemId,
                    itemName: item?.ItemName ?? "",
                    price: unitPrice,
                    quantity,
                    selectedOptionIds: sortedOptionIds,
                    summary
                }
            ];

        });

        setOptionsDialogItem(null);

    };

    const handleDecrement = (menuItem) => {

        setCartLines((prev) => {

            const existing = prev.find((line) => line.menuItemId === menuItem.MenuItemId);

            if (!existing) {
                return prev;
            }

            if (existing.quantity <= 1) {
                return prev.filter((line) => line.menuItemId !== menuItem.MenuItemId);
            }

            return prev.map((line) =>
                line.menuItemId === menuItem.MenuItemId
                    ? { ...line, quantity: line.quantity - 1 }
                    : line
            );

        });

    };

    const handleRemoveLine = (lineKey) => {
        setCartLines((prev) => prev.filter((line) => line.lineKey !== lineKey));
    };

    const categoriesWithItems = useMemo(() =>
        categories.filter((category) =>
            menuItems.some((item) => item.CategoryId === category.CategoryId)
        ),
    [categories, menuItems]);

    const filteredItems = useMemo(() => {

        const search = itemSearch.trim().toLowerCase();

        return menuItems.filter((item) =>
            (selectedCategoryId === "all" || item.CategoryId === selectedCategoryId) &&
            item.ItemName.toLowerCase().includes(search)
        );

    }, [menuItems, itemSearch, selectedCategoryId]);

    const subtotal = cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    const handleReview = () => {

        if (!resolvedCustomer) {
            toast.error("Attach a customer (or use Guest) first.");
            return;
        }

        if (cartLines.length === 0) {
            toast.error("Add at least one item.");
            return;
        }

        setReviewOpen(true);

    };

    const handleConfirm = async () => {

        try {

            setSubmitting(true);

            const response = await orderService.createOrder({
                customerId: resolvedCustomer.CustomerId,
                deliveryType,
                tableNumber: deliveryType === "Dine In" ? tableNumber : undefined,
                paymentMethod,
                notes: notes.trim() || undefined,
                items: cartLines.map((line) => ({
                    menuItemId: line.menuItemId,
                    quantity: line.quantity,
                    selectedOptionIds: line.selectedOptionIds || []
                }))
            });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(`Order #${response.data.OrderId} placed — total ₹ ${Number(response.data.TotalAmount).toFixed(2)}.`);
            setReviewOpen(false);
            onCreated(response.data);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create order.");

        } finally {

            setSubmitting(false);

        }

    };

    return (

        <Grid container spacing={3}>

            <Grid size={{ xs: 12, md: 7 }}>

                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                    Menu
                </Typography>

                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search menu items..."
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    sx={{ mb: 2 }}
                />

                {categoriesWithItems.length > 0 && (

                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2, maxHeight: 92, overflowY: "auto" }}>

                        <Chip
                            label="All"
                            color={selectedCategoryId === "all" ? "primary" : "default"}
                            onClick={() => setSelectedCategoryId("all")}
                        />

                        {categoriesWithItems.map((category) => (

                            <Chip
                                key={category.CategoryId}
                                label={category.CategoryName}
                                color={selectedCategoryId === category.CategoryId ? "primary" : "default"}
                                onClick={() => setSelectedCategoryId(category.CategoryId)}
                            />

                        ))}

                    </Box>

                )}

                <Box sx={{ maxHeight: 560, overflowY: "auto", pr: 0.5 }}>

                    {!menuLoading && filteredItems.length === 0 && (

                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                            No menu items found.
                        </Typography>

                    )}

                    {filteredItems.map((item) => {

                        const quantity = getQuantity(item.MenuItemId);

                        return (

                            <Card
                                key={item.MenuItemId}
                                variant="outlined"
                                sx={{
                                    p: 1.5,
                                    mb: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1
                                }}
                            >

                                <Box sx={{ minWidth: 0 }}>

                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>

                                        <Box
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: "2px",
                                                bgcolor: item.IsVeg ? "success.main" : "#8b3a3a",
                                                flexShrink: 0
                                            }}
                                        />

                                        <Typography fontWeight={600} noWrap>
                                            {item.ItemName}
                                        </Typography>

                                    </Box>

                                    <Typography variant="body2" color="text.secondary">
                                        ₹ {Number(item.Price).toFixed(2)}
                                    </Typography>

                                </Box>

                                {item.HasOptions ? (

                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>

                                        {quantity > 0 && (
                                            <Chip size="small" color="primary" label={quantity} />
                                        )}

                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<AddRoundedIcon />}
                                            onClick={() => handleAddClick(item)}
                                        >
                                            Add
                                        </Button>

                                    </Box>

                                ) : quantity === 0 ? (

                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AddRoundedIcon />}
                                        onClick={() => handleAddClick(item)}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        Add
                                    </Button>

                                ) : (

                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>

                                        <IconButton size="small" onClick={() => handleDecrement(item)}>
                                            <RemoveRoundedIcon fontSize="small" />
                                        </IconButton>

                                        <Typography fontWeight={700} sx={{ minWidth: 20, textAlign: "center" }}>
                                            {quantity}
                                        </Typography>

                                        <IconButton size="small" onClick={() => handleIncrement(item)}>
                                            <AddRoundedIcon fontSize="small" />
                                        </IconButton>

                                    </Box>

                                )}

                            </Card>

                        );

                    })}

                </Box>

            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>

                <Box sx={{ position: { md: "sticky" }, top: { md: 16 } }}>

                    <Card variant="outlined" sx={{ p: 2.5 }}>

                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                            Customer
                        </Typography>

                        {resolvedCustomer ? (

                            <Chip
                                label={
                                    isGuest
                                        ? "Walk-in Guest (no details given)"
                                        : `${resolvedCustomer.FullName} — ${resolvedCustomer.Phone}`
                                }
                                color="success"
                                onDelete={handleChangeCustomer}
                                sx={{ mb: 1, maxWidth: "100%" }}
                            />

                        ) : (

                            <Grid container spacing={1.5}>

                                <Grid size={{ xs: 12 }}>

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Phone Number"
                                        value={customerPhone}
                                        onChange={(event) => setCustomerPhone(event.target.value)}
                                        onBlur={() => customerPhone.trim() && !needsName && handleFindCustomer()}
                                    />

                                </Grid>

                                {needsName && (

                                    <Grid size={{ xs: 12 }}>

                                        <TextField
                                            fullWidth
                                            size="small"
                                            required
                                            label="Customer Name"
                                            value={customerName}
                                            onChange={(event) => setCustomerName(event.target.value)}
                                        />

                                    </Grid>

                                )}

                                <Grid size={{ xs: needsName ? 12 : 8 }}>

                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        disabled={checkingCustomer}
                                        onClick={handleFindCustomer}
                                    >
                                        {needsName ? "Create Customer" : "Find / Add Customer"}
                                    </Button>

                                </Grid>

                                {!needsName && (

                                    <Grid size={{ xs: 4 }}>

                                        <Button
                                            variant="text"
                                            fullWidth
                                            disabled={checkingCustomer}
                                            onClick={handleUseGuest}
                                        >
                                            Guest
                                        </Button>

                                    </Grid>

                                )}

                            </Grid>

                        )}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            Cart
                        </Typography>

                        {cartLines.length === 0 ? (

                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                No items added yet.
                            </Typography>

                        ) : (

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 220, overflowY: "auto" }}>

                                {cartLines.map((line) => (

                                    <Box key={line.lineKey} sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>

                                        <Box sx={{ minWidth: 0 }}>

                                            <Typography variant="body2" noWrap>
                                                {line.itemName} &times; {line.quantity}
                                            </Typography>

                                            {line.summary && (
                                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                                                    {line.summary}
                                                </Typography>
                                            )}

                                        </Box>

                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>

                                            <Typography variant="body2" fontWeight={600}>
                                                ₹ {(line.price * line.quantity).toFixed(2)}
                                            </Typography>

                                            <IconButton size="small" color="error" onClick={() => handleRemoveLine(line.lineKey)}>
                                                <DeleteRoundedIcon fontSize="small" />
                                            </IconButton>

                                        </Box>

                                    </Box>

                                ))}

                            </Box>

                        )}

                        {cartLines.length > 0 && (

                            <Box sx={{ mt: 1.5, textAlign: "right" }}>

                                <Typography variant="h6" fontWeight={700}>
                                    Subtotal: ₹ {subtotal.toFixed(2)}
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    Tax added at checkout
                                </Typography>

                            </Box>

                        )}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            Payment Method
                        </Typography>

                        <ToggleButtonGroup
                            exclusive
                            fullWidth
                            color="primary"
                            size="small"
                            value={paymentMethod}
                            onChange={(event, value) => value && setPaymentMethod(value)}
                            sx={{ mb: 2 }}
                        >

                            {PAYMENT_METHODS.map((method) => (
                                <ToggleButton key={method} value={method}>
                                    {method}
                                </ToggleButton>
                            ))}

                        </ToggleButtonGroup>

                        <TextField
                            fullWidth
                            size="small"
                            multiline
                            rows={2}
                            label="Order Notes (optional)"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            sx={{ mb: 2 }}
                        />

                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>

                            {onCancel && (
                                <Button onClick={onCancel}>
                                    Back
                                </Button>
                            )}

                            <Button
                                variant="contained"
                                fullWidth={!onCancel}
                                disabled={submitting}
                                onClick={handleReview}
                            >
                                Review Order
                            </Button>

                        </Box>

                    </Card>

                </Box>

            </Grid>

            <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} fullWidth maxWidth="xs">

                <DialogTitle>
                    Confirm Order
                </DialogTitle>

                <DialogContent>

                    <Typography sx={{ mb: 1.5 }}>
                        <strong>Customer:</strong>{" "}
                        {isGuest ? "Walk-in Guest (no details given)" : `${resolvedCustomer?.FullName} — ${resolvedCustomer?.Phone}`}
                    </Typography>

                    <Typography sx={{ mb: 1.5 }}>
                        <strong>Order Type:</strong>{" "}
                        {deliveryType}
                        {deliveryType === "Dine In" && tableNumber && ` (Table ${tableNumber})`}
                    </Typography>

                    <Divider sx={{ mb: 1.5 }} />

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>

                        {cartLines.map((line) => (

                            <Box key={line.lineKey} sx={{ display: "flex", justifyContent: "space-between" }}>

                                <Box sx={{ minWidth: 0 }}>

                                    <Typography variant="body2">
                                        {line.itemName} &times; {line.quantity}
                                    </Typography>

                                    {line.summary && (
                                        <Typography variant="caption" color="text.secondary">
                                            {line.summary}
                                        </Typography>
                                    )}

                                </Box>

                                <Typography variant="body2" fontWeight={600}>
                                    ₹ {(line.price * line.quantity).toFixed(2)}
                                </Typography>

                            </Box>

                        ))}

                    </Box>

                    <Divider sx={{ mb: 1.5 }} />

                    <Typography sx={{ mb: 0.5 }}>
                        <strong>Payment:</strong> {paymentMethod}
                    </Typography>

                    <Typography variant="h6" fontWeight={700}>
                        Subtotal: ₹ {subtotal.toFixed(2)}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        GST (2.5% CGST + 2.5% SGST) is added automatically — the final
                        total will be confirmed once the order is placed.
                    </Typography>

                </DialogContent>

                <DialogActions>

                    <Button onClick={() => setReviewOpen(false)} disabled={submitting}>
                        Edit
                    </Button>

                    <Button variant="contained" disabled={submitting} onClick={handleConfirm}>
                        {submitting ? "Placing Order..." : "Confirm & Place Order"}
                    </Button>

                </DialogActions>

            </Dialog>

            <PosItemOptionsDialog
                open={Boolean(optionsDialogItem)}
                menuItem={optionsDialogItem}
                onClose={() => setOptionsDialogItem(null)}
                onConfirm={handleConfirmOptions}
            />

        </Grid>

    );

}

export default PosOrderBuilder;
