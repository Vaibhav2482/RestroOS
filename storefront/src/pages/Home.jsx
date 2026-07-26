import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
    Card,
    Chip,
    Grid,
    Grow,
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

// The AppBar in Layout.jsx is sticky at the very top - the category bar
// below sticks right underneath it, so this offset has to match the
// AppBar's rendered height at each breakpoint or the two would overlap.
const APPBAR_HEIGHT = { xs: 56, sm: 64 };

const FILTER_CHIPS = [
    { id: "veg", label: "Pure Veg", dotColor: "#0B8A3D" },
    { id: "nonveg", label: "Non-Veg", dotColor: "#943126" },
    { id: "bestseller", label: "Bestseller", dotColor: null }
];

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

        <Card elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB", display: "flex", gap: 2, height: "100%" }}>

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

                <Typography variant="subtitle2" fontWeight={800} sx={{ color: "primary.main", mt: 0.5 }}>
                    ₹{Number(item.Price).toFixed(2)}
                </Typography>

                {item.Description ? (

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {shownDescription}{" "}
                        {isLong && (
                            <Box
                                component="span"
                                onClick={() => setExpanded((prev) => !prev)}
                                sx={{ color: "primary.main", fontWeight: 600, cursor: "pointer" }}
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

                <Box sx={{ position: "absolute", left: "50%", bottom: -14, transform: "translateX(-50%)", width: "84%", display: "flex", justifyContent: "center" }}>

                    {/* A plain ternary here swaps Button for Stack in a single
                        instant DOM replacement - combined with the optimistic
                        update firing on the same tick as the click, that gave
                        zero visible feedback that the tap registered at all.
                        Grow (re-triggered on every mount via the key) eases
                        each swap in instead of hard-cutting to it. */}
                    {quantity > 0 ? (

                        <Grow in key="stepper">
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                    bgcolor: "#FFFFFF",
                                    borderWidth: 1,
                                    borderStyle: "solid",
                                    borderColor: "primary.main",
                                    borderRadius: 5,
                                    px: 0.5,
                                    py: 0.25,
                                    width: 104,
                                    opacity: busy ? 0.6 : 1
                                }}
                            >

                                {/* MUI's default IconButton padding is oversized for a pill this
                                    narrow, which is what made the whole control look off-center -
                                    p:0.75 keeps a real tap target without breaking the layout. */}
                                <IconButton size="small" onClick={onDecrement} disabled={busy} sx={{ p: 0.75 }}>
                                    <RemoveIcon sx={{ fontSize: 18, color: "primary.main" }} />
                                </IconButton>

                                {/* key={quantity} restarts the pulse animation on every
                                    +/- tap, not just on the button->stepper swap, so
                                    incrementing/decrementing has its own tactile beat. */}
                                <Typography
                                    key={quantity}
                                    fontWeight={700}
                                    sx={{
                                        color: "primary.main",
                                        minWidth: 16,
                                        textAlign: "center",
                                        animation: "qtyPulse 0.2s ease-out",
                                        "@keyframes qtyPulse": {
                                            "0%": { transform: "scale(1.4)" },
                                            "100%": { transform: "scale(1)" }
                                        }
                                    }}
                                >
                                    {quantity}
                                </Typography>

                                <IconButton size="small" onClick={onIncrement} disabled={busy} sx={{ p: 0.75 }}>
                                    <AddIcon sx={{ fontSize: 18, color: "primary.main" }} />
                                </IconButton>

                            </Stack>
                        </Grow>

                    ) : (

                        <Grow in key="add-button">
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
                        </Grow>

                    )}

                </Box>

            </Box>

        </Card>

    );

}

function Home() {

    const navigate = useNavigate();
    const { tenantSlug, branches, selectedBranchId, isLoggedIn, customer, setCartCount, loading: storefrontLoading } = useStorefront();

    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [menuLoading, setMenuLoading] = useState(true);
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [search, setSearch] = useState("");
    // "veg" and "nonveg" are mutually exclusive as far as filtering goes -
    // both on (or both off) means "no veg-type restriction," not "show
    // nothing," which is what a naive independent-exclude check would do.
    const [filters, setFilters] = useState([]);
    const [cartLines, setCartLines] = useState([]);
    const [customizingItem, setCustomizingItem] = useState(null);
    // CartIds with an increment/decrement request currently in flight - a
    // rapid string of taps on the same stepper used to fire one request per
    // tap, so a straggler request could land after the line was already
    // removed by an earlier one and come back "Cart item not found" (piling
    // up one toast per straggler). This blocks a new tap on a line from
    // firing until its previous request has actually resolved.
    const [pendingLineIds, setPendingLineIds] = useState(() => new Set());
    // MenuItemIds currently mid-add - a plain item has no CartId yet to key
    // off of until the request resolves, so a rapid double-tap on "Add"
    // (which renders identically for both taps, since neither has committed
    // a cart line yet) used to fire two separate POST /cart calls and
    // create two distinct lines for the same item.
    const [pendingAddItemIds, setPendingAddItemIds] = useState(() => new Set());

    const sectionRefs = useRef({});
    const chipRefs = useRef({});
    const chipRowRef = useRef(null);
    // Scrolling to a section (via chip click) fires the same intersection
    // events as manual scrolling - this flag tells the observer to stand
    // down for the duration of that programmatic scroll, so the chip you
    // just tapped doesn't get immediately overridden by whichever section
    // happens to cross the threshold first.
    const suppressObserverRef = useRef(false);
    const suppressTimeoutRef = useRef(null);

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

    // Loads the cart once (mount, and whenever the logged-in customer
    // changes) - individual add/increment/decrement/remove actions below
    // update `cartLines` optimistically instead of re-fetching, so the
    // stepper reacts the instant you tap it rather than after a round trip.
    const loadCartLines = useCallback(async () => {

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
        loadCartLines();
    }, [loadCartLines]);

    // Drives the header badge off the same local state the stepper reads,
    // so it updates on the same tick as an optimistic add/increment/decrement
    // instead of waiting on a dedicated getCart round trip.
    useEffect(() => {
        setCartCount(cartLines.reduce((sum, line) => sum + line.Quantity, 0));
    }, [cartLines, setCartCount]);

    // Only plain (no customization) cart lines are ever addressed directly
    // from this page's stepper - a customizable item always goes through
    // the dialog, and can have several distinct lines (one per combination),
    // which a single +/- control can't represent.
    const getPlainCartLine = (menuItemId) =>
        cartLines.find((line) => line.MenuItemId === menuItemId && (!line.SelectedOptions || line.SelectedOptions.length === 0));

    // A newly-added line gets this placeholder id until the server responds
    // with a real CartId - increment/decrement can't address it yet, so the
    // stepper briefly ignores +/- taps on it rather than firing a request
    // against an id the server has never heard of.
    const isPendingCartId = (cartId) => typeof cartId === "string" && cartId.startsWith("temp-");

    const availableItems = useMemo(
        () => menuItems.filter((item) => item.IsAvailable && item.IsActive),
        [menuItems]
    );

    const toggleFilter = (id) => {
        setFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    };

    const searchedItems = useMemo(() => {

        const term = search.trim().toLowerCase();
        const vegOn = filters.includes("veg");
        const nonVegOn = filters.includes("nonveg");
        const bestsellerOn = filters.includes("bestseller");

        return availableItems.filter((item) => {

            if (term && !item.ItemName.toLowerCase().includes(term)) {
                return false;
            }

            if (vegOn && !nonVegOn && !item.IsVeg) {
                return false;
            }

            if (nonVegOn && !vegOn && item.IsVeg) {
                return false;
            }

            if (bestsellerOn && !item.IsPopular) {
                return false;
            }

            return true;

        });

    }, [availableItems, search, filters]);

    const categoriesInMenu = useMemo(() => {

        const idsInMenu = new Set(availableItems.map((item) => item.CategoryId));

        return categories
            .filter((category) => category.IsActive !== false && idsInMenu.has(category.CategoryId))
            .sort((a, b) => a.DisplayOrder - b.DisplayOrder);

    }, [categories, availableItems]);

    // Every category is always rendered as its own section (like a real
    // menu) - the chips are for scroll-spy navigation now, not a filter
    // that hides every other section.
    const sections = useMemo(() =>
        categoriesInMenu
            .map((category) => ({
                categoryId: category.CategoryId,
                categoryName: category.CategoryName,
                items: searchedItems.filter((item) => item.CategoryId === category.CategoryId)
            }))
            .filter((section) => section.items.length > 0),
    [categoriesInMenu, searchedItems]);

    useEffect(() => {

        if (sections.length > 0 && !sections.some((section) => section.categoryId === activeCategoryId)) {
            setActiveCategoryId(sections[0].categoryId);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sections]);

    // Scroll-spy: on every scroll tick, walk the sections in order and pick
    // the LAST one whose top has already crossed the reference line just
    // below the sticky header - i.e. "the section we've scrolled into or
    // past." An IntersectionObserver with a narrow rootMargin band was tried
    // first, but any section taller than that band never registered as
    // intersecting while scrolling through its middle, so the highlight got
    // stuck. Direct position checks don't have that failure mode.
    useEffect(() => {

        if (sections.length === 0) {
            return undefined;
        }

        const REFERENCE_Y = 150;

        const handleScroll = () => {

            if (suppressObserverRef.current) {
                return;
            }

            let current = sections[0].categoryId;

            for (const section of sections) {

                const element = sectionRefs.current[section.categoryId];

                if (!element) {
                    continue;
                }

                if (element.getBoundingClientRect().top <= REFERENCE_Y) {
                    current = section.categoryId;
                } else {
                    break;
                }

            }

            setActiveCategoryId((prev) => (prev === current ? prev : current));

        };

        let ticking = false;

        const onScroll = () => {

            if (ticking) {
                return;
            }

            ticking = true;

            window.requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });

        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        handleScroll();

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };

    }, [sections]);

    useEffect(() => {

        const chip = chipRefs.current[activeCategoryId];

        chip?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    }, [activeCategoryId]);

    const handleCategoryClick = (categoryId) => {

        setActiveCategoryId(categoryId);

        const element = sectionRefs.current[categoryId];

        if (!element) {
            return;
        }

        suppressObserverRef.current = true;
        element.scrollIntoView({ behavior: "smooth", block: "start" });

        // Clears once the smooth scroll has settled - there's no reliable
        // "scroll finished" event, so a generous timeout stands in for one.
        window.clearTimeout(suppressTimeoutRef.current);
        suppressTimeoutRef.current = window.setTimeout(() => {
            suppressObserverRef.current = false;
        }, 700);

    };

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

        if (pendingAddItemIds.has(item.MenuItemId)) {
            return;
        }

        setPendingAddItemIds((prev) => new Set(prev).add(item.MenuItemId));

        // Shown immediately so the stepper replaces the Add button on this
        // tap, instead of waiting on the round trip that assigns a real CartId.
        const tempCartId = `temp-${item.MenuItemId}-${Date.now()}`;
        const optimisticLine = {
            CartId: tempCartId,
            MenuItemId: item.MenuItemId,
            ItemName: item.ItemName,
            Quantity: 1,
            UnitPrice: Number(item.Price),
            TotalPrice: Number(item.Price),
            SelectedOptions: []
        };

        setCartLines((prev) => [...prev, optimisticLine]);
        toast.success(`${item.ItemName} added to cart`);

        try {

            const response = await cartService.addToCart({
                customerId: customer.CustomerId,
                menuItemId: item.MenuItemId,
                quantity: 1
            });

            if (!response.success) {
                throw new Error(response.message);
            }

            // Swap the placeholder for the server-assigned CartId that
            // increment/decrement need to address this line directly.
            setCartLines((prev) => prev.map((line) =>
                line.CartId === tempCartId ? { ...line, CartId: response.data.CartId } : line
            ));

        } catch (error) {

            setCartLines((prev) => prev.filter((line) => line.CartId !== tempCartId));
            toast.error(error.response?.data?.message || error.message || "Failed to add item to cart.");

        } finally {

            setPendingAddItemIds((prev) => {
                const next = new Set(prev);
                next.delete(item.MenuItemId);
                return next;
            });

        }

    };

    // Shared by increment and decrement - applies the new quantity to
    // `cartLines` right away and fires the request in the background,
    // rolling the line back to its pre-tap state if the request fails.
    const updateLineQuantity = (line, newQuantity) => {

        if (newQuantity <= 0) {
            setCartLines((prev) => prev.filter((current) => current.CartId !== line.CartId));
        } else {
            setCartLines((prev) => prev.map((current) =>
                current.CartId === line.CartId
                    ? { ...current, Quantity: newQuantity, TotalPrice: Number(current.UnitPrice) * newQuantity }
                    : current
            ));
        }

        setPendingLineIds((prev) => new Set(prev).add(line.CartId));

        const request = newQuantity <= 0
            ? cartService.removeCartItem(line.CartId)
            : cartService.updateCartQuantity(line.CartId, newQuantity);

        request
            .then((response) => {

                if (!response.success) {
                    throw new Error(response.message);
                }

            })
            .catch((error) => {

                setCartLines((prev) => prev.some((current) => current.CartId === line.CartId)
                    ? prev.map((current) => (current.CartId === line.CartId ? line : current))
                    : [...prev, line]);

                // Stable id collapses repeat failures for the same line into
                // one toast instead of stacking a new one per straggler.
                toast.error(error.response?.data?.message || error.message || "Failed to update cart.", { id: `cart-line-${line.CartId}` });

            })
            .finally(() => {

                setPendingLineIds((prev) => {
                    const next = new Set(prev);
                    next.delete(line.CartId);
                    return next;
                });

            });

    };

    const handleIncrement = (item) => {

        const line = getPlainCartLine(item.MenuItemId);

        if (!line) {
            handleAdd(item);
            return;
        }

        if (isPendingCartId(line.CartId) || pendingLineIds.has(line.CartId)) {
            return;
        }

        updateLineQuantity(line, line.Quantity + 1);

    };

    const handleDecrement = (item) => {

        const line = getPlainCartLine(item.MenuItemId);

        if (!line || isPendingCartId(line.CartId) || pendingLineIds.has(line.CartId)) {
            return;
        }

        updateLineQuantity(line, line.Quantity - 1);

    };

    // wasAdded is only true when the dialog's own "Add Item" button
    // succeeded - a plain Cancel/X dismissal has nothing new to fetch.
    const handleCustomizationDialogClose = (wasAdded) => {
        setCustomizingItem(null);
        if (wasAdded) {
            loadCartLines();
        }
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
                sx={{ mb: 2 }}
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

            <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: "auto", pb: 0.5 }}>

                {FILTER_CHIPS.map((filter) => {

                    const active = filters.includes(filter.id);

                    return (

                        <Chip
                            key={filter.id}
                            label={filter.label}
                            onClick={() => toggleFilter(filter.id)}
                            color={active ? "primary" : "default"}
                            variant={active ? "filled" : "outlined"}
                            icon={filter.dotColor ? (
                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: filter.dotColor, ml: "8px !important" }} />
                            ) : undefined}
                            sx={{ flexShrink: 0 }}
                        />

                    );

                })}

            </Stack>

            {sections.length > 0 && (

                <Stack
                    ref={chipRowRef}
                    direction="row"
                    spacing={1}
                    sx={{
                        mb: 3,
                        py: 1,
                        overflowX: "auto",
                        position: "sticky",
                        top: APPBAR_HEIGHT,
                        zIndex: 10,
                        bgcolor: "background.default"
                    }}
                >

                    {sections.map((section) => (
                        <Chip
                            key={section.categoryId}
                            ref={(el) => { chipRefs.current[section.categoryId] = el; }}
                            label={section.categoryName}
                            onClick={() => handleCategoryClick(section.categoryId)}
                            color={activeCategoryId === section.categoryId ? "primary" : "default"}
                            variant={activeCategoryId === section.categoryId ? "filled" : "outlined"}
                        />
                    ))}

                </Stack>

            )}

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
                        No items match your search or filters.
                    </Typography>
                </Box>

            ) : (

                <Stack spacing={4}>

                    {sections.map((section) => (

                        <Box
                            key={section.categoryId}
                            ref={(el) => { sectionRefs.current[section.categoryId] = el; }}
                            data-category-id={section.categoryId}
                            sx={{ scrollMarginTop: { xs: "120px", sm: "136px" } }}
                        >

                            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                                {section.categoryName}
                            </Typography>

                            <Grid container spacing={2.5}>

                                {section.items.map((item) => {

                                    const plainLine = getPlainCartLine(item.MenuItemId);

                                    // md alone meant 2 columns forever from 900px up - a
                                    // laptop/desktop screen (this page's Container caps at
                                    // 1200px) still only ever got 2 columns, so each card
                                    // stretched to ~580px and everything inside it (image,
                                    // gap, button) looked oversized and sparse. lg bumps to
                                    // 3 within that same 1200px cap instead.
                                    return (

                                        <Grid key={item.MenuItemId} size={{ xs: 12, md: 6, lg: 4 }} sx={{ pb: 1 }}>
                                            <MenuItemRow
                                                item={item}
                                                quantity={plainLine?.Quantity ?? 0}
                                                busy={isPendingCartId(plainLine?.CartId) || pendingLineIds.has(plainLine?.CartId) || pendingAddItemIds.has(item.MenuItemId)}
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
                        bgcolor: "primary.main",
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
