import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    InputBase,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import toast from "react-hot-toast";

import * as menuService from "../services/menuService";
import * as categoryService from "../services/categoryService";
import * as customerService from "../services/customerService";
import * as orderService from "../services/orderService";
import { getStoredAuth } from "../utils/adminAuth";
import { cloudinaryThumbnail } from "../utils/cloudinaryImage";
import PosItemOptionsDialog from "./PosItemOptionsDialog";
import KotReceipt from "../components/KotReceipt";
import PrintDialog from "../components/PrintDialog";
import { useThermalPrint } from "../hooks/useThermalPrint";
import { buildKotTicket } from "../utils/kotEscpos";

const PAYMENT_METHODS = ["Cash", "Card", "UPI"];
const GUEST_PHONE = "0000000000";

function ItemThumbnail({ imageUrl, itemName }) {

    if (imageUrl) {

        return (
            <Box
                component="img"
                src={cloudinaryThumbnail(imageUrl, 104)}
                alt={itemName}
                sx={{ width: 52, height: 52, borderRadius: 1.5, objectFit: "cover", border: "1px solid #E5E7EB", flexShrink: 0 }}
            />
        );

    }

    return (
        <Box
            sx={{
                width: 52,
                height: 52,
                borderRadius: 1.5,
                border: "1px solid #E5E7EB",
                bgcolor: "#F5F6FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
            }}
        >
            <RestaurantOutlinedIcon sx={{ color: "#C7CBD6", fontSize: 24 }} />
        </Box>
    );

}

// Was a plain controlled input tied straight to the committed cart
// quantity - every keystroke (including a mid-edit backspace-to-clear)
// committed immediately, so clearing "3" to type "13" fired a commit of 0
// after the first backspace and deleted the line before the second digit
// was ever typed. Keeping its own text buffer lets staff clear/retype
// freely; the real quantity only updates on blur or Enter.
function QuantityInput({ value, onCommit, sx }) {

    const [text, setText] = useState(String(value));

    useEffect(() => {
        setText(String(value));
    }, [value]);

    const commit = () => {
        const next = Math.max(0, Math.floor(Number(text) || 0));
        onCommit(next);
        setText(String(next));
    };

    return (
        <InputBase
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.target.blur();
                }
            }}
            type="number"
            slotProps={{ input: { min: 1, style: { textAlign: "center", padding: 0, fontWeight: 700, MozAppearance: "textfield" } } }}
            sx={{ "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 }, ...sx }}
        />
    );

}

// One row in the desktop vertical category rail (md+ only - see the layout
// below). Mirrors the accent-border/tinted-background "active" language
// Layout.jsx's own sidebar nav already uses, so this reads as the same app
// rather than a one-off style.
function CategoryNavItem({ label, icon, selected, onClick }) {

    return (

        <Box
            component="button"
            type="button"
            onClick={onClick}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: "100%",
                textAlign: "left",
                border: "none",
                borderLeft: "3px solid transparent",
                borderRadius: 1.5,
                bgcolor: selected ? "rgba(79, 70, 229, 0.1)" : "transparent",
                borderLeftColor: selected ? "primary.main" : "transparent",
                color: selected ? "primary.main" : "text.primary",
                font: "inherit",
                fontWeight: selected ? 700 : 500,
                fontSize: "0.85rem",
                px: 1.25,
                py: 0.9,
                mb: 0.25,
                cursor: "pointer",
                "&:hover": { bgcolor: selected ? "rgba(79, 70, 229, 0.1)" : "rgba(17,24,39,.04)" }
            }}
        >
            {icon}
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
            </Box>
        </Box>

    );

}

// The order-builder half of the POS flow: browse menu, build a cart, attach
// a customer (or fall back to the shared guest placeholder), pick a payment
// method and submit. GST is computed server-side, so only a pre-tax
// subtotal is shown here.
function PosOrderBuilder({ branchId, branchName, deliveryType, tableNumber, onCreated }) {

    const { admin } = getStoredAuth() || {};
    const { printing: kotPrinting, print: printKot } = useThermalPrint();

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
    // Holds the just-placed order shaped for KotReceipt, built from the
    // still-in-memory cart lines rather than re-fetching - the confirmation
    // dialog this drives is the moment a real KOT/POS system prints or
    // offers to print a kitchen ticket, so onCreated (which swaps this
    // screen away) is deferred until that dialog is dismissed instead of
    // firing immediately on a successful order.
    const [placedOrder, setPlacedOrder] = useState(null);

    const searchInputRef = useRef(null);

    // Ctrl/Cmd+K focuses search - the one keyboard shortcut worth having on
    // a screen staff are searching from repeatedly through a shift; skipped
    // whenever a dialog is already open so it doesn't steal focus from
    // whatever's actually being typed into there.
    useEffect(() => {

        const handleKeyDown = (event) => {

            if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" || event.key === "F1") && !optionsDialogItem && !placedOrder) {
                event.preventDefault();
                searchInputRef.current?.focus();
            }

        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);

    }, [optionsDialogItem, placedOrder]);

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

        // Clicking the button while the phone field still has focus fires
        // its onBlur (also handleFindCustomer) immediately followed by the
        // button's own onClick, before React necessarily re-renders the
        // button as disabled - without this guard, both fire and can create
        // two customer records for the same phone number.
        if (checkingCustomer) {
            return;
        }

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

        if (checkingCustomer) {
            return;
        }

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

    // Lets staff type a quantity directly (e.g. "8x chai") instead of tapping
    // + eight times - works by lineKey so it covers both plain items and
    // customized lines the same way.
    const handleSetLineQuantity = (lineKey, rawValue) => {

        const next = Math.max(0, Math.floor(Number(rawValue) || 0));

        setCartLines((prev) => {

            if (next <= 0) {
                return prev.filter((line) => line.lineKey !== lineKey);
            }

            return prev.map((line) =>
                line.lineKey === lineKey
                    ? { ...line, quantity: next }
                    : line
            );

        });

    };

    const categoriesWithItems = useMemo(() =>
        categories.filter((category) =>
            menuItems.some((item) => item.CategoryId === category.CategoryId)
        ),
    [categories, menuItems]);

    const hasPopularItems = useMemo(() => menuItems.some((item) => item.IsPopular), [menuItems]);

    // "popular" is a pure client-side filter over IsPopular (already fetched
    // with every menu item, already shown as the bestseller star on each
    // card) - not a new category or a backend concept, just a quick jump to
    // items already flagged as such.
    const filteredItems = useMemo(() => {

        const search = itemSearch.trim().toLowerCase();

        return menuItems.filter((item) =>
            (
                selectedCategoryId === "all" ||
                (selectedCategoryId === "popular" ? item.IsPopular : item.CategoryId === selectedCategoryId)
            ) &&
            item.ItemName.toLowerCase().includes(search)
        );

    }, [menuItems, itemSearch, selectedCategoryId]);

    const subtotal = cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    // Total food items to prepare, not distinct lines - "2x Chai" and
    // "1x Samosa" is 3 items on its way to the kitchen, not 2.
    const totalItemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

    // The sticky cart sidebar already shows every line item, the subtotal,
    // payment method and notes in full - a separate "review" dialog would
    // just repeat the same information behind an extra click. Placing the
    // order directly off the sidebar button is the actual confirmation step.
    const handlePlaceOrder = async () => {

        if (!resolvedCustomer) {
            toast.error("Attach a customer (or use Guest) first.");
            return;
        }

        if (cartLines.length === 0) {
            toast.error("Add at least one item.");
            return;
        }

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

            setPlacedOrder({
                createdOrder: response.data,
                kotOrder: {
                    OrderId: response.data.OrderId,
                    DeliveryType: deliveryType,
                    TableNumber: tableNumber,
                    OrderNotes: notes.trim() || undefined,
                    OrderDate: new Date().toISOString(),
                    BranchName: branchName,
                    Items: cartLines.map((line) => ({
                        OrderItemId: line.lineKey,
                        ItemName: line.itemName,
                        Quantity: line.quantity,
                        SelectedOptions: line.summary ? line.summary.split(", ").map((name) => ({ OptionName: name })) : []
                    }))
                }
            });

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create order.");

        } finally {

            setSubmitting(false);

        }

    };

    // handlePlaceOrder is a plain const, recreated every render, closing
    // over resolvedCustomer/paymentMethod/notes/etc - a ref kept current
    // every render is what lets the keydown listener below always call the
    // latest version without needing every one of those in its own
    // dependency array (and risking a stale customer/payment/notes on a
    // shortcut fired a few renders after they last changed).
    const handlePlaceOrderRef = useRef(handlePlaceOrder);
    handlePlaceOrderRef.current = handlePlaceOrder;

    // F2/Ctrl+Enter place the order (same guard as the button itself:
    // a resolved customer and a non-empty cart), and F3 prints the KOT once
    // one exists to print - the three shortcuts a captain actually reaches
    // for repeatedly through a shift, on top of the search focus above.
    // Typing into a text field (phone number, notes, an item search) must
    // never have a bare F-key hijacked into an action, so those are only
    // armed while focus isn't inside an input/textarea - Ctrl+Enter is
    // exempt from that guard since it's a deliberate combination, not
    // something a normal typing flow would ever produce by accident.
    useEffect(() => {

        const isTypingTarget = (target) =>
            target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

        const handleKeyDown = (event) => {

            if (event.key === "F3" && placedOrder) {
                event.preventDefault();
                printKot(() => buildKotTicket({ order: placedOrder.kotOrder, restaurantName: admin?.tenantName }));
                return;
            }

            const wantsPlaceOrder = (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ||
                (event.key === "F2" && !isTypingTarget(event.target));

            if (wantsPlaceOrder && !optionsDialogItem && !placedOrder && !submitting && cartLines.length > 0) {
                event.preventDefault();
                handlePlaceOrderRef.current();
            }

        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);

    }, [optionsDialogItem, placedOrder, submitting, cartLines, admin, printKot]);

    return (

        <Box
            sx={{
                display: "flex",
                // Mirrors Pos.jsx's own combined width+height gate on the
                // fixed-height wrapper this sits inside - both need to agree
                // on when "workstation" mode is active, or this would try
                // height:100% of a parent that's actually height:auto (i.e.
                // 0) below that threshold. See the comment there for why
                // height matters as much as width (phone landscape). Custom
                // media query conditions must be top-level sx keys with a
                // nested style object - nesting them inside a per-property
                // breakpoint object (the way xs/sm/md work) silently doesn't
                // apply at all, which is exactly what happened here the
                // first time before this was corrected.
                flexDirection: "column",
                gap: 2,
                height: "auto",
                "@media (min-width:600px) and (min-height:500px)": { flexDirection: "row", gap: 0, height: "100%" },
                minHeight: 0
            }}
        >

            {/* Vertical category rail - md+ only. Below md this same list
                still exists as the horizontal chip row further down (it
                never goes away, it's just the narrower-viewport form of the
                identical selectedCategoryId state), so no category
                functionality is duplicated or lost by width, only its
                presentation changes. */}
            {(categoriesWithItems.length > 0 || hasPopularItems) && (

                <Box
                    sx={{
                        display: { xs: "none", md: "flex" },
                        flexDirection: "column",
                        width: 176,
                        flexShrink: 0,
                        pr: 1.5,
                        mr: 2,
                        borderRight: "1px solid #E5E7EB",
                        overflowY: "auto"
                    }}
                >

                    <Typography
                        variant="caption"
                        sx={{ px: 1.25, mb: 0.75, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.68rem" }}
                    >
                        Categories
                    </Typography>

                    {hasPopularItems && (
                        <CategoryNavItem
                            label="Popular"
                            icon={<StarRoundedIcon sx={{ fontSize: 17 }} />}
                            selected={selectedCategoryId === "popular"}
                            onClick={() => setSelectedCategoryId("popular")}
                        />
                    )}

                    <CategoryNavItem
                        label="All Items"
                        selected={selectedCategoryId === "all"}
                        onClick={() => setSelectedCategoryId("all")}
                    />

                    {categoriesWithItems.map((category) => (
                        <CategoryNavItem
                            key={category.CategoryId}
                            label={category.CategoryName}
                            selected={selectedCategoryId === category.CategoryId}
                            onClick={() => setSelectedCategoryId(category.CategoryId)}
                        />
                    ))}

                </Box>

            )}

            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>

                {/* This is the single most-used control on the whole screen
                    (staff search it constantly through a shift) - it earns a
                    heavier visual treatment than a plain small text field, a
                    tinted background instead of a bare white box, and a
                    working Ctrl/Cmd+K shortcut rather than just a decorative
                    hint. The item count moved from its own separate label
                    row into the field itself, where it's contextual to what
                    you're actually searching. */}
                <TextField
                    fullWidth
                    inputRef={searchInputRef}
                    placeholder="Search menu items... (F1)"
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRoundedIcon sx={{ color: "primary.main" }} />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Chip
                                        label={itemSearch ? `${filteredItems.length} match${filteredItems.length === 1 ? "" : "es"}` : `${filteredItems.length} items`}
                                        size="small"
                                        sx={{ fontWeight: 700, bgcolor: "rgba(79, 70, 229, 0.1)", color: "primary.main" }}
                                    />
                                </InputAdornment>
                            )
                        }
                    }}
                    sx={{
                        mb: 1.5,
                        flexShrink: 0,
                        "& .MuiOutlinedInput-root": {
                            height: 52,
                            fontSize: "1.05rem",
                            fontWeight: 600,
                            bgcolor: "rgba(79, 70, 229, 0.04)",
                            "& fieldset": { borderColor: "transparent" },
                            "&:hover fieldset": { borderColor: "primary.main" },
                            "&.Mui-focused": { bgcolor: "background.paper" },
                            "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 2 }
                        }
                    }}
                />

                {/* Horizontal fallback for the category rail above - hidden
                    md+ (the vertical rail takes over there) so the same
                    selection isn't offered twice at once. Scrollbar hidden
                    rather than removed: still a real scroll area below sm,
                    just without the native scrollbar dominating a touch UI
                    that's already scrollable by swipe. */}
                {(categoriesWithItems.length > 0 || hasPopularItems) && (

                    <Box
                        sx={{
                            display: { xs: "flex", md: "none" },
                            flexWrap: "nowrap",
                            gap: 1,
                            mb: 1.5,
                            flexShrink: 0,
                            overflowX: "auto",
                            pb: 0.5,
                            scrollbarWidth: "none",
                            "&::-webkit-scrollbar": { display: "none" }
                        }}
                    >

                        {hasPopularItems && (
                            <Chip
                                icon={<StarRoundedIcon sx={{ fontSize: 16 }} />}
                                label="Popular"
                                color={selectedCategoryId === "popular" ? "primary" : "default"}
                                onClick={() => setSelectedCategoryId("popular")}
                                sx={{ flexShrink: 0 }}
                            />
                        )}

                        <Chip
                            label="All"
                            color={selectedCategoryId === "all" ? "primary" : "default"}
                            onClick={() => setSelectedCategoryId("all")}
                            sx={{ flexShrink: 0 }}
                        />

                        {categoriesWithItems.map((category) => (

                            <Chip
                                key={category.CategoryId}
                                label={category.CategoryName}
                                color={selectedCategoryId === category.CategoryId ? "primary" : "default"}
                                onClick={() => setSelectedCategoryId(category.CategoryId)}
                                sx={{ flexShrink: 0 }}
                            />

                        ))}

                    </Box>

                )}

                {/* flex:1 + minHeight:0 instead of a fixed maxHeight - this is
                    the one region of the whole screen meant to scroll (see
                    the outer layout comment above); a hardcoded cap either
                    wasted space on a tall viewport or clipped early on a
                    short one. */}
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>

                    {menuLoading && (

                        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                            <CircularProgress size={26} />
                        </Box>

                    )}

                    {!menuLoading && filteredItems.length === 0 && (

                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                            No menu items found.
                        </Typography>

                    )}

                    {/* Two columns instead of one full-width row per item -
                        measured against the previous single-column layout,
                        each row left 36-52% of its width empty between the
                        text and the Add button, and only ~5 of 12 items in a
                        category were visible without scrolling. This roughly
                        doubles visible items for the same screen height. */}
                    {/* auto-fill against a minimum rather than fixed breakpoint
                        counts: an upright tablet is ~800px of content, which
                        the old sm:"1fr 1fr" spent on two ~390px cards carrying
                        a name and a button. This packs in as many columns as
                        actually fit, so the same screen shows three. 260px
                        (not the original 300px) is sized to what a card
                        actually needs at minimum - 52px thumbnail + the
                        112px quantity stepper (the widest state a card's
                        control ever takes, wider than a bare "+ Add") + its
                        gaps/padding, leaving a still-legible ~90px for a
                        2-line-wrapped name. 300px was condemning the product
                        panel to a single column at a lot of real desktop
                        widths - after the category rail and cart column
                        (neither of which this touches) take their fixed
                        share, what's left often landed just under 2×300+gap
                        even though the cards themselves didn't need that
                        much room; auto-fill still refuses to stretch a lone
                        card to fill unused width (see the comment on that
                        below), so this doesn't risk the opposite problem. */}
                    {/* minWidth:0 so this can shrink below its content as a flex
                        child, which min-width:auto would otherwise prevent. */}
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1, minWidth: 0 }}>

                    {filteredItems.map((item) => {

                        const quantity = getQuantity(item.MenuItemId);

                        return (

                            // One row, not two. Stacking [thumb + name] above
                            // [price + Add] doubled every card's height while
                            // leaving a wide empty gutter beside the name -
                            // costly on an upright tablet, where vertical
                            // space is the scarce dimension.
                            <Card
                                key={item.MenuItemId}
                                variant="outlined"
                                // gap:0.75 with the text block sized to content
                                // rather than flex:1 - at ~450px wide the old
                                // layout left a long dead gutter between the
                                // price and the Add button, which is width that
                                // could be carrying another column of items.
                                sx={{ p: 0.75, display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
                            >

                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}>

                                    <ItemThumbnail imageUrl={item.ImageUrl} itemName={item.ItemName} />

                                    <Box sx={{ minWidth: 0, flex: 1 }}>

                                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0 }}>

                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: "2px",
                                                    bgcolor: item.IsVeg ? "success.main" : "#8b3a3a",
                                                    flexShrink: 0,
                                                    mt: 0.5
                                                }}
                                            />

                                            {/* Wraps to two lines instead of noWrap. Sharing one
                                                line with the veg dot, a Bestseller chip and the
                                                Add button left roughly 130px for the name, so
                                                staff were reading "Ging..." and "Gara..." and
                                                had to guess which tea they were tapping. Two
                                                lines costs a little height and makes the tile
                                                actually usable. */}
                                            <Typography
                                                fontWeight={600}
                                                sx={{
                                                    fontSize: "0.85rem",
                                                    lineHeight: 1.25,
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden"
                                                }}
                                            >
                                                {item.ItemName}
                                            </Typography>

                                        </Box>

                                        {/* Price sits under the name rather than on
                                            its own row - it's the second thing
                                            staff read, and it no longer costs a
                                            whole line to show it. The description
                                            is dropped here: at this density it
                                            truncated to a few words and earned
                                            none of the height it took. */}
                                        {/* Bestseller sits with the price rather than the
                                            name - this row has spare width, and the
                                            name row does not. */}
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25, minWidth: 0 }}>

                                            <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                                                ₹{Number(item.Price).toFixed(0)}
                                            </Typography>

                                            {item.IsPopular && (
                                                <Box
                                                    title="Bestseller"
                                                    sx={{
                                                        px: 0.5,
                                                        borderRadius: 0.5,
                                                        bgcolor: "#FEF3C7",
                                                        color: "#92400E",
                                                        fontSize: 9.5,
                                                        fontWeight: 700,
                                                        lineHeight: 1.6,
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    ★
                                                </Box>
                                            )}

                                        </Box>

                                    </Box>

                                </Box>

                                <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>

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
                                            sx={{ flexShrink: 0, width: 112 }}
                                        >
                                            Add
                                        </Button>

                                    ) : (

                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                flexShrink: 0,
                                                border: "1px solid #E5E7EB",
                                                borderRadius: 5,
                                                px: 0.5,
                                                py: 0.25,
                                                width: 112
                                            }}
                                        >

                                            <IconButton size="small" onClick={() => handleDecrement(item)} sx={{ p: 0.75 }}>
                                                <RemoveRoundedIcon sx={{ fontSize: 18 }} />
                                            </IconButton>

                                            <QuantityInput
                                                value={quantity}
                                                onCommit={(next) => handleSetLineQuantity(String(item.MenuItemId), next)}
                                                sx={{ width: 28 }}
                                            />

                                            <IconButton size="small" onClick={() => handleIncrement(item)} sx={{ p: 0.75 }}>
                                                <AddRoundedIcon sx={{ fontSize: 18 }} />
                                            </IconButton>

                                        </Box>

                                    )}

                                </Box>

                            </Card>

                        );

                    })}

                    </Box>

                </Box>

            </Box>

            {/* Order panel: fixed width, full column height, and internally
                split into a fixed header (Customer), the one scrollable
                region that isn't the menu (the cart line items, which can
                run long), and a fixed footer (subtotal/payment/notes/Place
                Order) - this is what keeps the primary action reachable
                without scrolling regardless of how many lines are in the
                cart, per the layout rules this screen was asked to follow. */}
            <Box
                sx={{
                    // Same combined width+height gate as the root layout
                    // above - full width, no left margin, when stacked.
                    width: "100%",
                    ml: 0,
                    "@media (min-width:600px) and (min-height:500px)": { width: 320, ml: 2 },
                    "@media (min-width:1200px) and (min-height:500px)": { width: 340 },
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0
                }}
            >

                <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, p: 0, overflow: "hidden" }}>

                    <Box sx={{ p: 1.5, pb: 1.25, flexShrink: 0 }}>

                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
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
                                sx={{ maxWidth: "100%" }}
                            />

                        ) : (

                            <Grid container spacing={1}>

                                <Grid size={{ xs: 12 }}>

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Phone Number"
                                        value={customerPhone}
                                        onChange={(event) => setCustomerPhone(event.target.value)}
                                        onBlur={() => customerPhone.trim() && !needsName && handleFindCustomer()}
                                        sx={{ "& .MuiOutlinedInput-root": { height: 40 } }}
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
                                            sx={{ "& .MuiOutlinedInput-root": { height: 40 } }}
                                        />

                                    </Grid>

                                )}

                                {/* Both buttons share the same bordered treatment and fixed
                                    height as the phone field above (rather than one boxed
                                    "outlined" button next to a bare "text" link) so the pair
                                    reads as two comparably-weighted choices, not a primary
                                    action next to an afterthought. */}
                                <Grid size={{ xs: needsName ? 12 : 7 }}>

                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        size="small"
                                        disabled={checkingCustomer}
                                        onClick={handleFindCustomer}
                                        sx={{ height: 40 }}
                                    >
                                        {needsName ? "Create Customer" : "Find / Add Customer"}
                                    </Button>

                                </Grid>

                                {!needsName && (

                                    <Grid size={{ xs: 5 }}>

                                        <Button
                                            variant="outlined"
                                            color="inherit"
                                            fullWidth
                                            size="small"
                                            disabled={checkingCustomer}
                                            onClick={handleUseGuest}
                                            sx={{ height: 40, borderColor: "divider", color: "text.secondary" }}
                                        >
                                            Guest
                                        </Button>

                                    </Grid>

                                )}

                            </Grid>

                        )}

                    </Box>

                    <Divider />

                    {/* The one scrollable region in this column besides the
                        menu itself - a long order (a big table, several
                        rounds) scrolls here without ever pushing the
                        subtotal/payment/Place Order footer below off screen. */}
                    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 1.5, py: 1.25 }}>

                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                            Current Order{totalItemCount > 0 ? ` (${totalItemCount})` : ""}
                        </Typography>

                        {cartLines.length === 0 ? (

                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                No items added yet.
                            </Typography>

                        ) : (

                            /* A single shared grid (not one flex row per item) is what
                               keeps the Qty/Price/Delete columns aligned down the whole
                               list - each item's cells are direct children of this one
                               grid, not their own independent row container, so the
                               browser sizes every column against every item at once.
                               Name gets the flexible 1fr track; the other three are
                               fixed/minmax so a long name (wrapped to 2 lines) or a
                               large total never shifts them out of alignment. */
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 84px minmax(56px, auto) 28px",
                                    columnGap: 1,
                                    rowGap: 1,
                                    alignItems: "center"
                                }}
                            >

                                {cartLines.map((line) => (

                                    <Fragment key={line.lineKey}>

                                        <Box sx={{ minWidth: 0 }}>

                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden",
                                                    lineHeight: 1.3
                                                }}
                                            >
                                                {line.itemName}
                                            </Typography>

                                            {line.summary && (
                                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                                                    {line.summary}
                                                </Typography>
                                            )}

                                        </Box>

                                        {/* Same +/- stepper pattern as the menu list - the cart
                                            previously had only a bare 28px number field with no
                                            visible way to change quantity short of clicking in and
                                            typing, inconsistent with how quantity works everywhere
                                            else on this screen. */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                border: "1px solid #E5E7EB",
                                                borderRadius: 5,
                                                px: 0.25,
                                                py: 0.125
                                            }}
                                        >

                                            <IconButton
                                                size="small"
                                                onClick={() => handleSetLineQuantity(line.lineKey, line.quantity - 1)}
                                                sx={{ p: 0.5 }}
                                            >
                                                <RemoveRoundedIcon sx={{ fontSize: 15 }} />
                                            </IconButton>

                                            <QuantityInput
                                                value={line.quantity}
                                                onCommit={(next) => handleSetLineQuantity(line.lineKey, next)}
                                                sx={{ width: 22 }}
                                            />

                                            <IconButton
                                                size="small"
                                                onClick={() => handleSetLineQuantity(line.lineKey, line.quantity + 1)}
                                                sx={{ p: 0.5 }}
                                            >
                                                <AddRoundedIcon sx={{ fontSize: 15 }} />
                                            </IconButton>

                                        </Box>

                                        <Typography variant="body2" fontWeight={600} sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                            ₹{(line.price * line.quantity).toFixed(2)}
                                        </Typography>

                                        {/* De-emphasized until hovered - a trash icon at full
                                            error-red weight next to every single line reads as a
                                            row of warnings, not a rarely-used remove action. */}
                                        <IconButton
                                            size="small"
                                            onClick={() => handleRemoveLine(line.lineKey)}
                                            sx={{ color: "text.disabled", justifySelf: "center", "&:hover": { color: "error.main" } }}
                                        >
                                            <DeleteRoundedIcon fontSize="small" />
                                        </IconButton>

                                    </Fragment>

                                ))}

                            </Box>

                        )}

                    </Box>

                    {/* Fixed footer: subtotal through Place Order never
                        scrolls out of view, regardless of how long the cart
                        above gets - the primary action stays reachable at
                        all times, per this screen's own requirements. */}
                    <Box sx={{ p: 1.5, pt: 1.25, borderTop: "1px solid #E5E7EB", flexShrink: 0 }}>

                        {cartLines.length > 0 && (

                            <Box sx={{ mb: 1.25, textAlign: "right" }}>

                                <Typography variant="h6" fontWeight={700}>
                                    Subtotal: ₹ {subtotal.toFixed(2)}
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    Tax added at checkout
                                </Typography>

                            </Box>

                        )}

                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                            Payment Method
                        </Typography>

                        <ToggleButtonGroup
                            exclusive
                            fullWidth
                            color="primary"
                            size="small"
                            value={paymentMethod}
                            onChange={(event, value) => value && setPaymentMethod(value)}
                            sx={{ mb: 1.25, "& .MuiToggleButton-root": { height: 36 } }}
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
                            sx={{ mb: 1.25 }}
                        />

                        {/* Back is already the header's job (Pos.jsx renders
                            "Back to Floor" there) - repeating it here just to
                            balance the row was giving Place Order, the one
                            action this whole screen exists to reach, half the
                            width and equal visual weight to leaving. Sized by
                            an explicit py rather than size="large" - prominent
                            through weight/color, not through being taller than
                            the compact controls above it. */}
                        <Tooltip title="Shortcut: F2 or Ctrl+Enter" placement="top">
                            <span>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    disabled={submitting || cartLines.length === 0}
                                    onClick={handlePlaceOrder}
                                    sx={{ py: 1.1, fontWeight: 700 }}
                                >
                                    {submitting ? "Placing Order..." : "Place Order"}
                                </Button>
                            </span>
                        </Tooltip>

                    </Box>

                </Card>

            </Box>

            <PosItemOptionsDialog
                open={Boolean(optionsDialogItem)}
                menuItem={optionsDialogItem}
                onClose={() => setOptionsDialogItem(null)}
                onConfirm={handleConfirmOptions}
            />

            <PrintDialog
                open={Boolean(placedOrder)}
                onClose={() => { onCreated(placedOrder.createdOrder); setPlacedOrder(null); }}
                printLabel="Print KOT (F3)"
                variant="drawer"
                title={placedOrder ? `Order #${placedOrder.createdOrder.OrderId}` : "Order Placed"}
                printing={kotPrinting}
                onPrint={placedOrder ? () => printKot(() => buildKotTicket({ order: placedOrder.kotOrder, restaurantName: admin?.tenantName })) : undefined}
            >
                {placedOrder && (
                    <>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Order #{placedOrder.createdOrder.OrderId} placed. Send this ticket to the kitchen.
                        </Alert>
                        <KotReceipt order={placedOrder.kotOrder} restaurantName={admin?.tenantName} />
                    </>
                )}
            </PrintDialog>

        </Box>

    );

}

export default PosOrderBuilder;
