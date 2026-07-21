import { useCallback, useEffect, useState } from "react";
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

function CartLineItem({ item, onQuantityChange, onRemove, busy }) {

    return (

        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #E5E7EB" }}>

            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>

                <Box sx={{ minWidth: 0 }}>

                    <Typography fontWeight={700} noWrap>
                        {item.ItemName}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        {formatCurrency(item.Price)} each
                    </Typography>

                </Box>

                <Stack direction="row" alignItems="center" spacing={1.5}>

                    <Stack direction="row" alignItems="center" sx={{ border: "1px solid #E5E7EB", borderRadius: 1 }}>

                        <IconButton
                            size="small"
                            disabled={busy}
                            onClick={() => onQuantityChange(item, item.Quantity - 1)}
                        >
                            <RemoveIcon fontSize="small" />
                        </IconButton>

                        <Typography sx={{ minWidth: 24, textAlign: "center" }}>
                            {item.Quantity}
                        </Typography>

                        <IconButton
                            size="small"
                            disabled={busy}
                            onClick={() => onQuantityChange(item, item.Quantity + 1)}
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>

                    </Stack>

                    <Typography fontWeight={700} sx={{ minWidth: 80, textAlign: "right" }}>
                        {formatCurrency(item.TotalPrice)}
                    </Typography>

                    <IconButton
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => onRemove(item)}
                        aria-label={`Remove ${item.ItemName}`}
                    >
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>

                </Stack>

            </Stack>

        </Paper>

    );

}

function Cart() {

    const navigate = useNavigate();
    const { tenantSlug, isLoggedIn, customer, refreshCartCount } = useStorefront();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyCartId, setBusyCartId] = useState(null);
    const [clearing, setClearing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const loadCart = useCallback(async () => {

        if (!isLoggedIn || !customer?.CustomerId) {
            setLoading(false);
            return;
        }

        try {

            setLoading(true);

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

        }

    }, [isLoggedIn, customer]);

    useEffect(() => {
        loadCart();
    }, [loadCart]);

    const handleQuantityChange = async (item, newQuantity) => {

        try {

            setBusyCartId(item.CartId);

            const response = newQuantity <= 0
                ? await cartService.removeCartItem(item.CartId)
                : await cartService.updateCartQuantity(item.CartId, newQuantity);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            await loadCart();
            await refreshCartCount();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update cart.");

        } finally {

            setBusyCartId(null);

        }

    };

    const handleRemove = async (item) => {

        try {

            setBusyCartId(item.CartId);

            const response = await cartService.removeCartItem(item.CartId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Item removed from cart.");
            await loadCart();
            await refreshCartCount();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to remove item.");

        } finally {

            setBusyCartId(null);

        }

    };

    const handleClearCart = async () => {

        try {

            setClearing(true);

            const response = await cartService.clearCart(customer.CustomerId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Cart cleared.");
            await loadCart();
            await refreshCartCount();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to clear cart.");

        } finally {

            setClearing(false);
            setConfirmOpen(false);

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
                        busy={busyCartId === item.CartId}
                    />
                ))}

            </Stack>

            <Paper elevation={0} sx={{ p: 3, mt: 3, border: "1px solid #E5E7EB" }}>

                <Stack direction="row" alignItems="center" justifyContent="space-between">

                    <Typography fontWeight={700}>Subtotal</Typography>
                    <Typography variant="h6" fontWeight={800}>
                        {formatCurrency(subtotal)}
                    </Typography>

                </Stack>

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
