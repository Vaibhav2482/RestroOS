import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// The AppBar in Layout.jsx is sticky at the very top - the category bar
// below sticks right underneath it, so this offset has to match the
// AppBar's rendered height at each breakpoint or the two would overlap.
const APPBAR_HEIGHT = { xs: 56, sm: 64 };

// How long to wait after the last +/- tap before syncing that line to the
// server. Long enough that a burst of taps collapses into one request,
// short enough that leaving the page immediately after a single tap still
// flushes well within the time it takes to navigate.
const QUANTITY_SYNC_DELAY_MS = 350;

// The Add button and the +/- stepper swap in and out of the same slot, so
// both are pinned to these exact dimensions. Any mismatch shows up as the
// control jumping the moment an item is first added.
const CART_CONTROL_WIDTH = 76;
const CART_CONTROL_HEIGHT = 34;

const FILTER_CHIPS = [
    { id: "veg", label: "Pure Veg", dotColor: "#0B8A3D" },
    { id: "nonveg", label: "Non-Veg", dotColor: "#943126" },
    { id: "bestseller", label: "Bestseller", dotColor: null }
];

function VegIndicator({ isVeg }) {

    const color = isVeg ? "#0B8A3D" : "#943126";
    const label = isVeg ? "Vegetarian" : "Non-vegetarian";

    return (
        <Box
            role="img"
            aria-label={label}
            title={label}
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
            {/* FSSAI convention: veg is a dot, non-veg is a triangle - color
                alone doesn't hold up for colorblind customers on a marker
                this small, and it's a hard dietary requirement for many. */}
            {isVeg ? (
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color }} />
            ) : (
                <Box
                    sx={{
                        width: 0,
                        height: 0,
                        borderLeft: "4px solid transparent",
                        borderRight: "4px solid transparent",
                        borderBottom: `7px solid ${color}`
                    }}
                />
            )}
        </Box>
    );

}

// Fills whatever box it's given rather than taking a fixed pixel size - the
// card is a responsive grid cell now (two per row on a phone), so the image
// has to scale with the column instead of pinning itself to one width.
function ItemImage({ item }) {

    if (item.ImageUrl) {

        return (
            <Box
                component="img"
                src={item.ImageUrl}
                alt={item.ItemName}
                loading="lazy"
                sx={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    display: "block",
                    borderRadius: 2,
                    objectFit: "cover",
                    bgcolor: "#F4EFE9"
                }}
            />
        );

    }

    return (
        <Box
            sx={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 2,
                bgcolor: "#F4EFE9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <RestaurantOutlinedIcon sx={{ color: "#C7CBD6", fontSize: 40 }} />
        </Box>
    );

}

function MenuItemRow({ item, quantity, busy, onAdd, onIncrement, onDecrement }) {

    const [expanded, setExpanded] = useState(false);

    // Shorter cutoff than the old full-width row could afford - at roughly
    // half a phone's width, 90 characters ran to five or six lines.
    const isLong = item.Description && item.Description.length > 42;
    const shownDescription = !isLong || expanded
        ? item.Description
        : `${item.Description.slice(0, 42).trim()}...`;

    return (

        // Image-led vertical tile rather than a wide horizontal row. The old
        // layout gave one full-width card per row on a phone - about three
        // items per screen, with a large dead area under the price - so this
        // stacks image over text to fit two per row instead.
        <Card
            elevation={0}
            sx={{
                p: 1.25,
                border: "1px solid #E5E7EB",
                borderRadius: 3,
                display: "flex",
                flexDirection: "column",
                height: "100%"
            }}
        >

            {/* mb leaves room for the Add control, which overhangs the image's
                bottom edge - without it the button would sit on top of the
                item name. */}
            <Box sx={{ position: "relative", mb: 1.75 }}>

                <ItemImage item={item} />

                <Box sx={{ position: "absolute", right: 8, bottom: -12, display: "flex" }}>

                    {/* Swapped instantly. The Grow transition that used to
                        ease this in was there to make the tap feel
                        acknowledged, but it reads as lag once the quantity
                        itself updates on the same tick - the number changing
                        is the acknowledgement. */}
                    {quantity > 0 ? (

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
                                    px: 0.25,
                                    // Width AND height are pinned to the exact
                                    // values the Add button uses. Previously only
                                    // the width matched, so the taller stepper
                                    // (icon buttons set their own padding) grew
                                    // upward from its bottom anchor and the
                                    // control visibly jumped on every first tap.
                                    width: CART_CONTROL_WIDTH,
                                    height: CART_CONTROL_HEIGHT,
                                    boxSizing: "border-box",
                                    flexShrink: 0,
                                    boxShadow: "0 2px 8px rgba(17,24,39,.12)"
                                }}
                            >

                                {/* MUI's default IconButton padding is oversized for a pill this
                                    narrow, which is what made the whole control look off-center -
                                    p:0.75 keeps a real tap target without breaking the layout.
                                    No longer disabled while a sync is in flight: taps apply to
                                    the local quantity immediately and the server call is
                                    debounced, so there's nothing to guard against. */}
                                <IconButton size="small" onClick={onDecrement} sx={{ p: 0.5 }}>
                                    <RemoveIcon sx={{ fontSize: 18, color: "primary.main" }} />
                                </IconButton>

                                <Typography
                                    fontWeight={700}
                                    sx={{ color: "primary.main", minWidth: 16, textAlign: "center" }}
                                >
                                    {quantity}
                                </Typography>

                                <IconButton size="small" onClick={onIncrement} sx={{ p: 0.5 }}>
                                    <AddIcon sx={{ fontSize: 18, color: "primary.main" }} />
                                </IconButton>

                            </Stack>

                    ) : (

                            /* White-on-bordered rather than solid: sitting over
                               the photo, a filled block hid the food behind it,
                               and this reads as a control rather than a slab of
                               colour. */
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onAdd}
                                disabled={busy}
                                sx={{
                                    bgcolor: "#FFFFFF",
                                    borderRadius: 5,
                                    minWidth: 0,
                                    width: CART_CONTROL_WIDTH,
                                    height: CART_CONTROL_HEIGHT,
                                    boxSizing: "border-box",
                                    p: 0,
                                    fontSize: 13,
                                    fontWeight: 800,
                                    letterSpacing: "0.04em",
                                    // Uppercased in CSS rather than in the markup so
                                    // the accessible name stays "Add" - a screen
                                    // reader shouldn't spell out "A-D-D".
                                    textTransform: "uppercase",
                                    boxShadow: "0 2px 8px rgba(17,24,39,.12)",
                                    "&:hover": { bgcolor: "#FFFFFF" }
                                }}
                            >
                                Add
                            </Button>

                    )}

                </Box>

            </Box>

            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                <VegIndicator isVeg={Boolean(item.IsVeg)} />
                {item.IsPopular ? (
                    <Chip
                        label="Bestseller"
                        size="small"
                        sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 700, height: 18, fontSize: 10 }}
                    />
                ) : null}
            </Stack>

            {/* Clamped to two lines so a long name can't make one tile taller
                than the one beside it and break the grid's alignment. */}
            <Typography
                variant="body2"
                fontWeight={700}
                sx={{
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                }}
            >
                {item.ItemName}
            </Typography>

            {item.Description ? (

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.35 }}>
                    {shownDescription}{" "}
                    {isLong && (
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            sx={{
                                color: "primary.main",
                                fontWeight: 600,
                                cursor: "pointer",
                                font: "inherit",
                                border: 0,
                                p: 0,
                                background: "none",
                                "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 }
                            }}
                        >
                            {expanded ? "less" : "more"}
                        </Box>
                    )}
                </Typography>

            ) : null}

            {/* Pushes price to the bottom edge so prices line up across a row
                regardless of how tall each tile's name/description ran. */}
            <Box sx={{ flexGrow: 1, minHeight: 4 }} />

            <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mt: 0.5 }}>

                <Typography variant="subtitle2" fontWeight={800} sx={{ color: "text.primary" }}>
                    ₹{Number(item.Price).toFixed(0)}
                </Typography>

                {item.HasOptions ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        customisable
                    </Typography>
                ) : null}

            </Stack>

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
    // "veg" and "nonveg" are mutually exclusive, like a real food-ordering
    // app's veg toggle - selecting one replaces the other rather than both
    // staying active at once (which used to silently cancel out to "show
    // everything," with both chips confusingly still highlighted).
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

    // Per-line debounce timers, plus the last server-confirmed state of each
    // line to roll back to if a sync fails. Refs, not state, so updating them
    // never costs a re-render on a hot path like holding down "+".
    const quantityTimersRef = useRef(new Map());
    const confirmedLinesRef = useRef(new Map());
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

        setFilters((prev) => {

            if (prev.includes(id)) {
                return prev.filter((f) => f !== id);
            }

            if (id === "veg" || id === "nonveg") {
                return [...prev.filter((f) => f !== "veg" && f !== "nonveg"), id];
            }

            return [...prev, id];

        });

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

            if (vegOn && !item.IsVeg) {
                return false;
            }

            if (nonVegOn && item.IsVeg) {
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
    // that hides every other section. A synthetic "Recommended" section is
    // prepended when there's at least one bestseller in view - it's a
    // cross-category surface for IsPopular items, not a replacement for
    // their real category further down, so an item can appear in both.
    const sections = useMemo(() => {

        const categorySections = categoriesInMenu
            .map((category) => ({
                categoryId: category.CategoryId,
                categoryName: category.CategoryName,
                items: searchedItems.filter((item) => item.CategoryId === category.CategoryId)
            }))
            .filter((section) => section.items.length > 0);

        const recommendedItems = searchedItems.filter((item) => item.IsPopular);

        if (recommendedItems.length === 0) {
            return categorySections;
        }

        return [{ categoryId: "recommended", categoryName: "Recommended", items: recommendedItems }, ...categorySections];

    }, [categoriesInMenu, searchedItems]);

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

    // A debounced sync still owes the server its last quantity when the page
    // goes away - without this, tapping "+" and immediately opening the cart
    // would drop that tap entirely.
    useEffect(() => () => {

        quantityTimersRef.current.forEach(({ timer, sync }) => {
            clearTimeout(timer);
            sync();
        });

    }, []);

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

        // Remember what the server last agreed the line was, so a failure
        // rolls back to that rather than to whatever intermediate quantity
        // this particular tap happened to start from.
        if (!confirmedLinesRef.current.has(line.CartId)) {
            confirmedLinesRef.current.set(line.CartId, line);
        }

        // Each tap replaces the previous pending call instead of queueing
        // another one: only the final quantity actually needs to reach the
        // server, and firing one request per tap is what made a run of
        // taps feel like it was lagging behind the finger.
        const existing = quantityTimersRef.current.get(line.CartId);

        if (existing) {
            clearTimeout(existing.timer);
        }

        const sync = () => {

            quantityTimersRef.current.delete(line.CartId);

            const request = newQuantity <= 0
                ? cartService.removeCartItem(line.CartId)
                : cartService.updateCartQuantity(line.CartId, newQuantity);

            request
                .then((response) => {

                    if (!response.success) {
                        throw new Error(response.message);
                    }

                    confirmedLinesRef.current.set(line.CartId, { ...line, Quantity: newQuantity });

                })
                .catch((error) => {

                    const confirmed = confirmedLinesRef.current.get(line.CartId) || line;

                    setCartLines((prev) => prev.some((current) => current.CartId === confirmed.CartId)
                        ? prev.map((current) => (current.CartId === confirmed.CartId ? confirmed : current))
                        : [...prev, confirmed]);

                    // Stable id collapses repeat failures for the same line into
                    // one toast instead of stacking a new one per straggler.
                    toast.error(error.response?.data?.message || error.message || "Failed to update cart.", { id: `cart-line-${line.CartId}` });

                });

        };

        quantityTimersRef.current.set(line.CartId, {
            timer: setTimeout(sync, QUANTITY_SYNC_DELAY_MS),
            sync
        });

    };

    const handleIncrement = (item) => {

        const line = getPlainCartLine(item.MenuItemId);

        if (!line) {
            handleAdd(item);
            return;
        }

        // A line that hasn't come back from the server yet has no real CartId
        // to update, so that one tap still has to wait. Every other tap now
        // applies immediately - previously an in-flight request silently
        // swallowed them, so tapping "+" four times quickly added one.
        if (isPendingCartId(line.CartId)) {
            return;
        }

        updateLineQuantity(line, line.Quantity + 1);

    };

    const handleDecrement = (item) => {

        const line = getPlainCartLine(item.MenuItemId);

        if (!line || isPendingCartId(line.CartId)) {
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
                size="small"
                // Search + two chip rows previously pushed the first food item
                // ~250px down the page on a phone; these tighter gaps get the
                // menu above the fold without removing any of the controls.
                sx={{ mb: 1.25 }}
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

            <Stack direction="row" spacing={1} sx={{ mb: 1.25, overflowX: "auto", pb: 0.5 }}>

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
                        mb: 2,
                        py: 0.75,
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
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                        No items match your search or filters.
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            setSearch("");
                            setFilters([]);
                        }}
                    >
                        Clear filters
                    </Button>
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

                            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.25 }}>
                                <Typography variant="h6" fontWeight={700}>
                                    {section.categoryName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {section.items.length} {section.items.length === 1 ? "item" : "items"}
                                </Typography>
                            </Stack>

                            <Grid container spacing={{ xs: 1.5, sm: 2 }}>

                                {section.items.map((item) => {

                                    const plainLine = getPlainCartLine(item.MenuItemId);

                                    // Two per row on a phone (was one full-width card,
                                    // which showed about three items per screen), scaling
                                    // up to six on a wide desktop - the tile is now
                                    // image-led and vertical, so it stays legible at a
                                    // fraction of the old width.
                                    return (

                                        <Grid key={item.MenuItemId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
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
                onCartChanged={loadCartLines}
            />

            {cartItemCount > 0 && (

                <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/${tenantSlug}/cart`)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/${tenantSlug}/cart`);
                        }
                    }}
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
                        "&:focus-visible": { outline: "2px solid #fff", outlineOffset: 2 },
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
