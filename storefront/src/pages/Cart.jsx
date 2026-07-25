import { useCallback, useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import * as cartService from "../services/cartService";
import { useStorefront } from "../context/StorefrontContext";

function formatCurrency(value) {
    return `₹${Number(value ?? 0).toFixed(2)}`;
}

function CartLineItem({ item, onQuantityChange, onRemove }) {

    const optionsSummary = item.SelectedOptions && item.SelectedOptions.length > 0
        ? item.SelectedOptions.map((option) => option.OptionName).join(", ")
        : null;

    return (

        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #E5E7EB" }}>

            {/* Fixed grid tracks, not a two-item flex row - with only "name"
                and "everything else" as flex children, a longer item name or
                an options line nudges the stepper/price/delete as a block
                instead of them staying pinned to the same x on every row.
                Below `sm` the fixed 104/80/40px control tracks would leave
                the name column only ~30px wide, so those three drop to their
                own full-width row underneath the name instead of squeezing
                in beside it. */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "auto 1fr auto", sm: "1fr 104px 80px 40px" },
                    gridTemplateAreas: {
                        xs: `"name name name" "stepper price delete"`,
                        sm: `"name stepper price delete"`
                    },
                    alignItems: "center",
                    columnGap: 2,
                    rowGap: { xs: 1.5, sm: 0 }
                }}
            >

                <Box sx={{ gridArea: "name", minWidth: 0 }}>

                    <Typography fontWeight={700} noWrap>
                        {item.ItemName}
                    </Typography>

                    {optionsSummary ? (
                        <Typography variant="caption" color="text.secondary" component="div" noWrap>
                            {optionsSummary}
                        </Typography>
                    ) : null}

                    <Typography variant="body2" color="text.secondary">
                        {formatCurrency(item.UnitPrice)} each
                    </Typography>

                </Box>

                {/* MUI's default IconButton padding made this read as three
                    loose, unevenly-spaced elements rather than one grouped
                    control - tight p:0.75 + a real pill radius fixes that. */}
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ gridArea: "stepper", border: "1px solid #E5E7EB", borderRadius: 5, px: 0.5, py: 0.25, width: "100%" }}
                >

                    <IconButton
                        size="small"
                        onClick={() => onQuantityChange(item, item.Quantity - 1)}
                        sx={{ p: 0.75 }}
                    >
                        <RemoveIcon sx={{ fontSize: 18 }} />
                    </IconButton>

                    <Typography fontWeight={600} sx={{ minWidth: 20, textAlign: "center" }}>
                        {item.Quantity}
                    </Typography>

                    <IconButton
                        size="small"
                        onClick={() => onQuantityChange(item, item.Quantity + 1)}
                        sx={{ p: 0.75 }}
                    >
                        <AddIcon sx={{ fontSize: 18 }} />
                    </IconButton>

                </Stack>

                <Typography fontWeight={700} sx={{ gridArea: "price", textAlign: { xs: "left", sm: "right" } }}>
                    {formatCurrency(item.TotalPrice)}
                </Typography>

                <IconButton
                    size="small"
                    color="error"
                    onClick={() => onRemove(item)}
                    aria-label={`Remove ${item.ItemName}`}
                    sx={{ gridArea: "delete", justifySelf: "end" }}
                >
                    <DeleteOutlineIcon fontSize="small" />
                </IconButton>

            </Box>

        </Paper>

    );

}

function Cart() {

    const navigate = useNavigate();
    const { tenantSlug, isLoggedIn, customer, setCartCount } = useStorefront();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Only the first load shows the blocking spinner - reloading after a
    // quantity change/remove/clear keeps the existing list visible instead
    // of blanking the page out on every action.
    const hasLoadedRef = useRef(false);

    const loadCart = useCallback(async () => {

        if (!isLoggedIn || !customer?.CustomerId) {
            setLoading(false);
            return;
        }

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await cartService.getCart(customer.CustomerId);

            if (response.success) {
                setItems(response.data);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load cart.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    }, [isLoggedIn, customer]);

    useEffect(() => {
        loadCart();
    }, [loadCart]);

    // Drives the header badge off the same local state the list renders, so
    // it updates on the same tick as an optimistic change below instead of
    // waiting on a dedicated getCart round trip.
    useEffect(() => {
        setCartCount(items.reduce((sum, item) => sum + item.Quantity, 0));
    }, [items, setCartCount]);

    // Applies the new quantity to `items` immediately and fires the request
    // in the background, rolling the line back to its pre-tap state if the
    // request fails - the stepper shouldn't freeze for a round trip on every tap.
    const handleQuantityChange = (item, newQuantity) => {

        if (newQuantity <= 0) {
            setItems((prev) => prev.filter((current) => current.CartId !== item.CartId));
        } else {
            setItems((prev) => prev.map((current) =>
                current.CartId === item.CartId
                    ? { ...current, Quantity: newQuantity, TotalPrice: Number(current.UnitPrice) * newQuantity }
                    : current
            ));
        }

        const request = newQuantity <= 0
            ? cartService.removeCartItem(item.CartId)
            : cartService.updateCartQuantity(item.CartId, newQuantity);

        request
            .then((response) => {

                if (!response.success) {
                    throw new Error(response.message);
                }

            })
            .catch((error) => {

                setItems((prev) => prev.some((current) => current.CartId === item.CartId)
                    ? prev.map((current) => (current.CartId === item.CartId ? item : current))
                    : [...prev, item]);

                toast.error(error.response?.data?.message || error.message || "Failed to update cart.");

            });

    };

    const handleRemove = (item) => {

        setItems((prev) => prev.filter((current) => current.CartId !== item.CartId));
        toast.success("Item removed from cart.");

        cartService.removeCartItem(item.CartId)
            .then((response) => {

                if (!response.success) {
                    throw new Error(response.message);
                }

            })
            .catch((error) => {

                setItems((prev) => [...prev, item]);
                toast.error(error.response?.data?.message || error.message || "Failed to remove item.");

            });

    };

    const handleClearCart = async () => {

        const previousItems = items;

        setItems([]);
        setConfirmOpen(false);

        try {

            setClearing(true);

            const response = await cartService.clearCart(customer.CustomerId);

            if (!response.success) {
                throw new Error(response.message);
            }

            toast.success("Cart cleared.");

        } catch (error) {

            setItems(previousItems);
            toast.error(error.response?.data?.message || error.message || "Failed to clear cart.");

        } finally {

            setClearing(false);

        }

    };

    if (!isLoggedIn) {

        return (

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 10, textAlign: "center" }}>

                <ShoppingCartOutlinedIcon sx={{ fontSize: 56, color: "#C7C9F0", mb: 2 }} />

                <Typography variant="h6" fontWeight={700}>
                    Log in to see your cart
                </Typography>

                <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 360 }}>
                    Your cart is saved to your account, so log in to view and manage the items you've added.
                </Typography>

                <Button component={RouterLink} to={`/${tenantSlug}/login`} variant="contained" sx={{ height: 44, px: 4 }}>
                    Log In
                </Button>

            </Box>

        );

    }

    if (loading) {

        return (

            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                <Typography color="text.secondary">Loading your cart...</Typography>
            </Box>

        );

    }

    if (items.length === 0) {

        return (

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 10, textAlign: "center" }}>

                <ShoppingCartOutlinedIcon sx={{ fontSize: 56, color: "#C7C9F0", mb: 2 }} />

                <Typography variant="h6" fontWeight={700}>
                    Your cart is empty
                </Typography>

                <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 360 }}>
                    Looks like you haven't added anything yet. Browse the menu to get started.
                </Typography>

                <Button component={RouterLink} to={`/${tenantSlug}`} variant="contained" sx={{ height: 44, px: 4 }}>
                    Browse Menu
                </Button>

            </Box>

        );

    }

    const subtotal = items.reduce((sum, item) => sum + Number(item.TotalPrice ?? 0), 0);

    return (

        <Box sx={{ py: 4, maxWidth: 720, mx: "auto" }}>

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>

                <Typography variant="h5" fontWeight={800}>
                    Your Cart
                </Typography>

                <Button
                    color="error"
                    size="small"
                    disabled={clearing}
                    onClick={() => setConfirmOpen(true)}
                >
                    Clear Cart
                </Button>

            </Stack>

            <Stack spacing={2}>

                {items.map((item) => (
                    <CartLineItem
                        key={item.CartId}
                        item={item}
                        onQuantityChange={handleQuantityChange}
                        onRemove={handleRemove}
                    />
                ))}

            </Stack>

            <Paper elevation={0} sx={{ p: 3, mt: 3, border: "1px solid #E5E7EB" }}>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>

                    <Typography fontWeight={700}>Subtotal</Typography>
                    <Typography variant="h6" fontWeight={800}>
                        {formatCurrency(subtotal)}
                    </Typography>

                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Tax is calculated and added at checkout.
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Button
                    fullWidth
                    variant="contained"
                    disabled={items.length === 0}
                    sx={{ height: 48 }}
                    onClick={() => navigate(`/${tenantSlug}/checkout`)}
                >
                    Proceed to Checkout
                </Button>

            </Paper>

            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>

                <DialogTitle>Clear cart?</DialogTitle>

                <DialogContent>
                    <DialogContentText>
                        This will remove all items from your cart. This action cannot be undone.
                    </DialogContentText>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)} disabled={clearing}>
                        Cancel
                    </Button>
                    <Button color="error" onClick={handleClearCart} disabled={clearing}>
                        {clearing ? "Clearing..." : "Clear Cart"}
                    </Button>
                </DialogActions>

            </Dialog>

        </Box>

    );

}

export default Cart;
