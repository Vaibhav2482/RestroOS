import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
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
                width: 16,
                height: 16,
                border: `1.5px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
            }}
        >
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
        </Box>
    );

}

function MenuItemCard({ item, quantity, onAdd, onIncrement, onDecrement }) {

    const truncatedDescription = item.Description && item.Description.length > 110
        ? `${item.Description.slice(0, 110).trim()}...`
        : item.Description;

    return (

        <Card elevation={0} sx={{ height: "100%", display: "flex", flexDirection: "column", border: "1px solid #E5E7EB" }}>

            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>

                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>

                    <Stack direction="row" alignItems="center" spacing={1}>
                        <VegIndicator isVeg={Boolean(item.IsVeg)} />
                        <Typography variant="subtitle1" fontWeight={700}>
                            {item.ItemName}
                        </Typography>
                    </Stack>

                    {item.IsPopular ? (
                        <Chip label="Popular" size="small" sx={{ bgcolor: "#EEF2FF", color: "#4F46E5", fontWeight: 600 }} />
                    ) : null}

                </Stack>

                {truncatedDescription ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, flexGrow: 1 }}>
                        {truncatedDescription}
                    </Typography>
                ) : (
                    <Box sx={{ flexGrow: 1 }} />
                )}

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>

                    <Typography variant="subtitle1" fontWeight={800} sx={{ color: "#4F46E5" }}>
                        ₹{Number(item.Price).toFixed(2)}
                    </Typography>

                    {quantity > 0 ? (

                        <Stack direction="row" alignItems="center" spacing={1}>

                            <IconButton size="small" onClick={onDecrement} sx={{ border: "1px solid #E5E7EB" }}>
                                <RemoveIcon fontSize="small" />
                            </IconButton>

                            <Typography fontWeight={700} sx={{ minWidth: 20, textAlign: "center" }}>
                                {quantity}
                            </Typography>

                            <IconButton size="small" onClick={onIncrement} sx={{ border: "1px solid #E5E7EB" }}>
                                <AddIcon fontSize="small" />
                            </IconButton>

                        </Stack>

                    ) : (

                        <Stack alignItems="center" spacing={0.25}>

                            <Button variant="outlined" size="small" onClick={onAdd}>
                                Add
                            </Button>

                            {item.HasOptions ? (
                                <Typography variant="caption" color="text.secondary">
                                    customisable
                                </Typography>
                            ) : null}

                        </Stack>

                    )}

                </Stack>

            </CardContent>

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
    const [localQuantities, setLocalQuantities] = useState({});
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

    const availableItems = useMemo(
        () => menuItems.filter((item) => item.IsAvailable && item.IsActive),
        [menuItems]
    );

    const filteredItems = useMemo(() => {

        return availableItems.filter((item) => {

            const matchesCategory = selectedCategoryId === "all" || item.CategoryId === selectedCategoryId;
            const matchesSearch = !search.trim() || item.ItemName.toLowerCase().includes(search.trim().toLowerCase());

            return matchesCategory && matchesSearch;

        });

    }, [availableItems, selectedCategoryId, search]);

    const categoriesInMenu = useMemo(() => {

        const idsInMenu = new Set(availableItems.map((item) => item.CategoryId));
        return categories.filter((category) => category.IsActive !== false && idsInMenu.has(category.CategoryId));

    }, [categories, availableItems]);

    const handleAddToCart = async (item) => {

        if (!isLoggedIn) {
            navigate(`/${tenantSlug}/login`);
            return;
        }

        if (item.HasOptions) {
            setCustomizingItem(item);
            return;
        }

        const increment = 1;

        try {

            const response = await cartService.addToCart({
                customerId: customer.CustomerId,
                menuItemId: item.MenuItemId,
                quantity: increment
            });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            setLocalQuantities((prev) => ({ ...prev, [item.MenuItemId]: (prev[item.MenuItemId] || 0) + increment }));
            refreshCartCount();
            toast.success(`${item.ItemName} added to cart`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to add item to cart.");

        }

    };

    const handleCustomizationDialogClose = () => {
        setCustomizingItem(null);
    };

    const handleIncrement = (item) => handleAddToCart(item);

    const handleDecrement = (item) => {

        setLocalQuantities((prev) => {

            const current = prev[item.MenuItemId] || 0;
            const next = Math.max(0, current - 1);

            return { ...prev, [item.MenuItemId]: next };

        });

        // Note: server-side cart quantity is only ever incremented from this
        // page (via addToCart). Decrementing below what was added here does
        // not call the API - full quantity management lives on the Cart page.

    };

    if (storefrontLoading) {

        return (

            <Grid container spacing={2}>
                {Array.from({ length: 6 }).map((_, index) => (
                    <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Skeleton variant="rounded" height={160} />
                    </Grid>
                ))}
            </Grid>

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

        <Box>

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

                <Grid container spacing={2}>
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Skeleton variant="rounded" height={160} />
                        </Grid>
                    ))}
                </Grid>

            ) : availableItems.length === 0 ? (

                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                        No menu items available yet.
                    </Typography>
                </Box>

            ) : filteredItems.length === 0 ? (

                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                        No items match your search.
                    </Typography>
                </Box>

            ) : (

                <Grid container spacing={2}>

                    {filteredItems.map((item) => (

                        <Grid key={item.MenuItemId} size={{ xs: 12, sm: 6, md: 4 }}>
                            <MenuItemCard
                                item={item}
                                quantity={localQuantities[item.MenuItemId] || 0}
                                onAdd={() => handleAddToCart(item)}
                                onIncrement={() => handleIncrement(item)}
                                onDecrement={() => handleDecrement(item)}
                            />
                        </Grid>

                    ))}

                </Grid>

            )}

            <ItemCustomizationDialog
                open={Boolean(customizingItem)}
                item={customizingItem}
                onClose={handleCustomizationDialogClose}
            />

        </Box>

    );

}

export default Home;
