import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Chip,
    Grid,
    IconButton,
    InputAdornment,
    Skeleton,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import * as publicService from "../services/publicService";
import * as cartService from "../services/cartService";
import { useStorefront } from "../context/StorefrontContext";
import ItemCustomizationDialog from "./ItemCustomizationDialog";

function VegIndicator({ isVeg }) {

    const color = isVeg ? "#0B8A3D" : "#943126";

    return (
        <Box
            sx={{
                width: 15,
                height: 15,
                border: `1.5px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
            }}
        >
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color }} />
        </Box>
    );

}

function ItemImage({ item, size = 116 }) {

    if (item.ImageUrl) {

        return (
            <Box
                component="img"
                src={item.ImageUrl}
                alt={item.ItemName}
                sx={{
                    width: size,
                    height: size,
                    borderRadius: 2,
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "1px solid #E5E7EB"
                }}
            />
        );

    }

    return (
        <Box
            sx={{
                width: size,
                height: size,
                borderRadius: 2,
                flexShrink: 0,
                border: "1px solid #E5E7EB",
                bgcolor: "#F5F6FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <RestaurantOutlinedIcon sx={{ color: "#C7CBD6", fontSize: size * 0.4 }} />
        </Box>
    );

}

function MenuItemRow({ item, quantity, busy, onAdd, onIncrement, onDecrement }) {

    const [expanded, setExpanded] = useState(false);

    const isLong = item.Description && item.Description.length > 90;
    const shownDescription = !isLong || expanded
        ? item.Description
        : `${item.Description.slice(0, 90).trim()}...`;

    return (

        <Card elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB", display: "flex", gap: 2 }}>

            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

                <Stack direction="row" alignItems="center" spacing={1}>
                    <VegIndicator isVeg={Boolean(item.IsVeg)} />
                    {item.IsPopular ? (
                        <Chip label="Bestseller" size="small" sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 600, height: 20 }} />
                    ) : null}
                </Stack>

                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }}>
                    {item.ItemName}
                </Typography>

                <Typography variant="subtitle2" fontWeight={800} sx={{ color: "#4F46E5", mt: 0.5 }}>
                    ₹{Number(item.Price).toFixed(2)}
                </Typography>

                {item.Description ? (

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {shownDescription}{" "}
                        {isLong && (
                            <Box
                                component="span"
                                onClick={() => setExpanded((prev) => !prev)}
                                sx={{ color: "#4F46E5", fontWeight: 600, cursor: "pointer" }}
                            >
                                {expanded ? "less" : "more"}
                            </Box>
                        )}
                    </Typography>

                ) : null}

                <Box sx={{ flexGrow: 1 }} />

                {item.HasOptions ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        customisable
                    </Typography>
                ) : null}

            </Box>

            <Box sx={{ position: "relative", flexShrink: 0 }}>

                <ItemImage item={item} />

                <Box sx={{ position: "absolute", left: "50%", bottom: -14, transform: "translateX(-50%)", width: "84%" }}>

                    {quantity > 0 ? (

                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ bgcolor: "#FFFFFF", border: "1px solid #4F46E5", borderRadius: 2, px: 0.5, py: 0.25, opacity: busy ? 0.6 : 1 }}
                        >

                            <IconButton size="small" onClick={onDecrement} disabled={busy}>
                                <RemoveIcon fontSize="small" sx={{ color: "#4F46E5" }} />
                            </IconButton>

                            <Typography fontWeight={700} sx={{ color: "#4F46E5" }}>
                                {quantity}
                            </Typography>

                            <IconButton size="small" onClick={onIncrement} disabled={busy}>
                                <AddIcon fontSize="small" sx={{ color: "#4F46E5" }} />
                            </IconButton>

                        </Stack>

                    ) : (

                        <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            onClick={onAdd}
                            disabled={busy}
                            sx={{ borderRadius: 2, minWidth: 0, px: 1 }}
                        >
                            Add
                        </Button>

                    )}

                </Box>

            </Box>

        </Card>

    );

}

function Home() {

    const navigate = useNavigate();
    const { tenantSlug, branches, selectedBranchId, isLoggedIn, customer, refreshCartCount, loading: storefrontLoading } = useStorefront();

    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [menuLoading, setMenuLoading] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState("all");
    const [search, setSearch] = useState("");
    const [cartLines, setCartLines] = useState([]);
    const [busyMenuItemId, setBusyMenuItemId] = useState(null);
    const [customizingItem, setCustomizingItem] = useState(null);

    useEffect(() => {

        let cancelled = false;

        (async () => {

            try {

                const response = await publicService.getPublicCategories(tenantSlug);

                if (!cancelled && response.success) {
                    setCategories(response.data);
                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load categories.");

            }

        })();

        return () => { cancelled = true; };

    }, [tenantSlug]);

    useEffect(() => {

        if (!selectedBranchId) {
            setMenuItems([]);
            setMenuLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {

            setMenuLoading(true);

            try {

                const response = await publicService.getMenuItems(selectedBranchId);

                if (!cancelled && response.success) {
                    setMenuItems(response.data);
                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load menu items.");

            } finally {

                if (!cancelled) {
                    setMenuLoading(false);
                }

            }

        })();

        return () => { cancelled = true; };

    }, [selectedBranchId]);

    // Keeps the +/- stepper an honest reflection of the real cart, not a
    // page-local counter that resets (or drifts) the moment you navigate
    // away and back - this used to silently diverge from what was actually
    // in the cart, including on decrement, which never called the API at all.
    const refreshCartLines = useCallback(async () => {

        if (!isLoggedIn || !customer?.CustomerId) {
            setCartLines([]);
            return;
        }

        try {

            const response = await cartService.getCart(customer.CustomerId);

            if (response.success) {
                setCartLines(response.data);
            }

        } catch {

            // Non-fatal - the stepper just falls back to "not in cart" for this page view.

        }

    }, [isLoggedIn, customer]);

    useEffect(() => {
        refreshCartLines();
    }, [refreshCartLines]);

    // Only plain (no customization) cart lines are ever addressed directly
    // from this page's stepper - a customizable item always goes through
    // the dialog, and can have several distinct lines (one per combination),
    // which a single +/- control can't represent.
    const getPlainCartLine = (menuItemId) =>
        cartLines.find((line) => line.MenuItemId === menuItemId && (!line.SelectedOptions || line.SelectedOptions.length === 0));

    const availableItems = useMemo(
        () => menuItems.filter((item) => item.IsAvailable && item.IsActive),
        [menuItems]
    );

    const searchedItems = useMemo(() => {

        if (!search.trim()) {
            return availableItems;
        }

        const term = search.trim().toLowerCase();

        return availableItems.filter((item) => item.ItemName.toLowerCase().includes(term));

    }, [availableItems, search]);

    const categoriesInMenu = useMemo(() => {

        const idsInMenu = new Set(availableItems.map((item) => item.CategoryId));

        return categories
            .filter((category) => category.IsActive !== false && idsInMenu.has(category.CategoryId))
            .sort((a, b) => a.DisplayOrder - b.DisplayOrder);

    }, [categories, availableItems]);

    // Grouped by category (sections, like a real menu) so the default "All"
    // view reads as a proper menu rather than one undifferentiated grid.
    const sections = useMemo(() => {

        if (selectedCategoryId !== "all") {

            const category = categoriesInMenu.find((c) => c.CategoryId === selectedCategoryId);

            return [{
                categoryId: selectedCategoryId,
                categoryName: category?.CategoryName ?? "",
                items: searchedItems.filter((item) => item.CategoryId === selectedCategoryId)
            }];

        }

        return categoriesInMenu
            .map((category) => ({
                categoryId: category.CategoryId,
                categoryName: category.CategoryName,
                items: searchedItems.filter((item) => item.CategoryId === category.CategoryId)
            }))
            .filter((section) => section.items.length > 0);

    }, [categoriesInMenu, searchedItems, selectedCategoryId]);

    const totalVisibleItems = sections.reduce((sum, section) => sum + section.items.length, 0);

    const cartItemCount = cartLines.reduce((sum, line) => sum + line.Quantity, 0);
    const cartSubtotal = cartLines.reduce((sum, line) => sum + Number(line.TotalPrice ?? 0), 0);

    const handleAdd = async (item) => {

        if (!isLoggedIn) {
            navigate(`/${tenantSlug}/login`);
            return;
        }

        if (item.HasOptions) {
            setCustomizingItem(item);
            return;
        }

        try {

            setBusyMenuItemId(item.MenuItemId);

            const response = await cartService.addToCart({
                customerId: customer.CustomerId,
                menuItemId: item.MenuItemId,
                quantity: 1
            });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            await refreshCartLines();
            refreshCartCount();
            toast.success(`${item.ItemName} added to cart`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to add item to cart.");

        } finally {

            setBusyMenuItemId(null);

        }

    };

    const handleIncrement = async (item) => {

        const line = getPlainCartLine(item.MenuItemId);

        if (!line) {
            await handleAdd(item);
            return;
        }

        try {

            setBusyMenuItemId(item.MenuItemId);

            const response = await cartService.updateCartQuantity(line.CartId, line.Quantity + 1);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            await refreshCartLines();
            refreshCartCount();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update cart.");

        } finally {

            setBusyMenuItemId(null);

        }

    };

    const handleDecrement = async (item) => {

        const line = getPlainCartLine(item.MenuItemId);

        if (!line) {
            return;
        }

        try {

            setBusyMenuItemId(item.MenuItemId);

            const response = line.Quantity <= 1
                ? await cartService.removeCartItem(line.CartId)
                : await cartService.updateCartQuantity(line.CartId, line.Quantity - 1);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            await refreshCartLines();
            refreshCartCount();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update cart.");

        } finally {

            setBusyMenuItemId(null);

        }

    };

    const handleCustomizationDialogClose = () => {
        setCustomizingItem(null);
        refreshCartLines();
    };

    if (storefrontLoading) {

        return (

            <Stack spacing={2}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} variant="rounded" height={140} />
                ))}
            </Stack>

        );

    }

    if (!branches || branches.length === 0) {

        return (
            <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                    This restaurant hasn't set up any branches yet.
                </Typography>
            </Box>
        );

    }

    return (

        <Box sx={{ pb: cartItemCount > 0 ? 9 : 0 }}>

            <TextField
                fullWidth
                placeholder="Search menu items..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ mb: 3 }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        )
                    }
                }}
            />

            <Stack direction="row" spacing={1} sx={{ mb: 3, overflowX: "auto", pb: 1 }}>

                <Chip
                    label="All"
                    onClick={() => setSelectedCategoryId("all")}
                    color={selectedCategoryId === "all" ? "primary" : "default"}
                    variant={selectedCategoryId === "all" ? "filled" : "outlined"}
                />

                {categoriesInMenu.map((category) => (
                    <Chip
                        key={category.CategoryId}
                        label={category.CategoryName}
                        onClick={() => setSelectedCategoryId(category.CategoryId)}
                        color={selectedCategoryId === category.CategoryId ? "primary" : "default"}
                        variant={selectedCategoryId === category.CategoryId ? "filled" : "outlined"}
                    />
                ))}

            </Stack>

            {menuLoading ? (

                <Stack spacing={2}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} variant="rounded" height={140} />
                    ))}
                </Stack>

            ) : availableItems.length === 0 ? (

                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                        No menu items available yet.
                    </Typography>
                </Box>

            ) : totalVisibleItems === 0 ? (

                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                        No items match your search.
                    </Typography>
                </Box>

            ) : (

                <Stack spacing={4}>

                    {sections.map((section) => (

                        <Box key={section.categoryId}>

                            {selectedCategoryId === "all" && (
                                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                                    {section.categoryName}
                                </Typography>
                            )}

                            <Grid container spacing={2.5}>

                                {section.items.map((item) => {

                                    const plainLine = getPlainCartLine(item.MenuItemId);

                                    return (

                                        <Grid key={item.MenuItemId} size={{ xs: 12, md: 6 }} sx={{ pb: 1 }}>
                                            <MenuItemRow
                                                item={item}
                                                quantity={plainLine?.Quantity ?? 0}
                                                busy={busyMenuItemId === item.MenuItemId}
                                                onAdd={() => handleAdd(item)}
                                                onIncrement={() => handleIncrement(item)}
                                                onDecrement={() => handleDecrement(item)}
                                            />
                                        </Grid>

                                    );

                                })}

                            </Grid>

                        </Box>

                    ))}

                </Stack>

            )}

            <ItemCustomizationDialog
                open={Boolean(customizingItem)}
                item={customizingItem}
                onClose={handleCustomizationDialogClose}
            />

            {cartItemCount > 0 && (

                <Box
                    onClick={() => navigate(`/${tenantSlug}/cart`)}
                    sx={{
                        position: "fixed",
                        left: "50%",
                        bottom: { xs: 76, md: 16 },
                        transform: "translateX(-50%)",
                        width: { xs: "calc(100% - 32px)", sm: 480 },
                        maxWidth: "calc(100% - 32px)",
                        bgcolor: "#4F46E5",
                        color: "#fff",
                        borderRadius: 3,
                        boxShadow: "0 10px 30px rgba(79,70,229,.35)",
                        px: 2.5,
                        py: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        zIndex: 20
                    }}
                >

                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <ShoppingCartOutlinedIcon />
                        <Box>
                            <Typography fontWeight={700} sx={{ lineHeight: 1.2 }}>
                                {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.85 }}>
                                ₹{cartSubtotal.toFixed(2)}
                            </Typography>
                        </Box>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography fontWeight={700}>View Cart</Typography>
                    </Stack>

                </Box>

            )}

        </Box>

    );

}

export default Home;
