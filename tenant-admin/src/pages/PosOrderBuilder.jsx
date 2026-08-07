import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Alert } from "@mui/material";
import {
    Banknote,
    ChefHat,
    CreditCard,
    Minus,
    Plus,
    Search,
    Smartphone,
    Sparkles,
    Trash2,
    UserRound,
    X
} from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import PrintDialog from "../components/PrintDialog";
import KotReceipt from "../components/KotReceipt";

import * as menuService from "../services/menuService";
import * as categoryService from "../services/categoryService";
import * as customerService from "../services/customerService";
import * as orderService from "../services/orderService";
import { getStoredAuth } from "../utils/adminAuth";
import PosItemOptionsDialog from "./PosItemOptionsDialog";

const PAYMENT_METHODS = [
    { value: "Cash", label: "Cash", icon: Banknote },
    { value: "Card", label: "Card", icon: CreditCard },
    { value: "UPI", label: "UPI", icon: Smartphone }
];
const GUEST_PHONE = "0000000000";

// Same buffered-text-then-commit behavior as before (clearing "3" to type
// "13" used to commit a 0 quantity after the first backspace, deleting the
// line before the second digit was typed) - just restyled.
function QuantityStepper({ value, onCommit, size = "default" }) {

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

        <div className={cn(
            "flex items-center justify-between rounded-full border border-border bg-card",
            size === "sm" ? "h-8 gap-1 px-1" : "h-9 gap-1.5 px-1.5"
        )}>

            <button
                type="button"
                onClick={() => onCommit(Math.max(0, value - 1))}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
            >
                <Minus className="h-3.5 w-3.5" />
            </button>

            <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                onFocus={(event) => event.target.select()}
                onBlur={commit}
                onKeyDown={(event) => event.key === "Enter" && event.target.blur()}
                inputMode="numeric"
                className="w-6 flex-shrink-0 bg-transparent text-center text-sm font-bold text-foreground outline-none"
            />

            <button
                type="button"
                onClick={() => onCommit(value + 1)}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>

        </div>

    );

}

// The order-builder half of the POS flow: browse menu, build a cart, attach
// a customer (or fall back to the shared guest placeholder), pick a payment
// method and submit. GST is computed server-side, so only a pre-tax
// subtotal is shown here.
function PosOrderBuilder({ branchId, branchName, deliveryType, tableNumber, onCreated, onCancel }) {

    const { admin } = getStoredAuth() || {};

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

    const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value);
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

    // Ctrl/Cmd+K focuses search (matches the shortcut hint shown next to the
    // box); F9 places the order - both are pure client-side conveniences,
    // handlePlaceOrder's own guards (customer attached, cart non-empty)
    // still apply exactly as if the button had been clicked.
    useEffect(() => {

        const handleKeyDown = (event) => {

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                searchInputRef.current?.focus();
            }

            if (event.key === "F9") {
                event.preventDefault();
                handlePlaceOrder();
            }

        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedCustomer, cartLines, deliveryType, tableNumber, paymentMethod, notes, submitting]);

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

    const filteredItems = useMemo(() => {

        const search = itemSearch.trim().toLowerCase();

        return menuItems.filter((item) =>
            (selectedCategoryId === "all" || item.CategoryId === selectedCategoryId) &&
            item.ItemName.toLowerCase().includes(search)
        );

    }, [menuItems, itemSearch, selectedCategoryId]);

    const subtotal = cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const cartItemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

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

    return (

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">

            {/* LEFT — menu browsing */}
            <div>

                <div className="sticky top-0 z-10 -mx-1 bg-background/90 px-1 pb-3 pt-1 backdrop-blur">

                    <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            value={itemSearch}
                            onChange={(event) => setItemSearch(event.target.value)}
                            placeholder="Search for dishes, drinks..."
                            className="h-12 rounded-2xl pl-11 pr-16 text-sm shadow-sm"
                        />
                        <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Ctrl K
                        </kbd>
                    </div>

                    {categoriesWithItems.length > 0 && (

                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">

                            <button
                                type="button"
                                onClick={() => setSelectedCategoryId("all")}
                                className={cn(
                                    "flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                                    selectedCategoryId === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
                                )}
                            >
                                All
                            </button>

                            {categoriesWithItems.map((category) => (

                                <button
                                    key={category.CategoryId}
                                    type="button"
                                    onClick={() => setSelectedCategoryId(category.CategoryId)}
                                    className={cn(
                                        "flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                                        selectedCategoryId === category.CategoryId ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
                                    )}
                                >
                                    {category.CategoryName}
                                </button>

                            ))}

                        </div>

                    )}

                </div>

                {menuLoading ? (

                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
                                <div className="aspect-[4/3] bg-muted" />
                                <div className="space-y-2 p-3">
                                    <div className="h-4 w-3/4 rounded bg-muted" />
                                    <div className="h-3 w-1/2 rounded bg-muted" />
                                </div>
                            </div>
                        ))}
                    </div>

                ) : filteredItems.length === 0 ? (

                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <ChefHat className="h-5 w-5" />
                        </div>
                        <p className="font-semibold text-foreground">No menu items found</p>
                        <p className="text-sm text-muted-foreground">Try a different search term or category.</p>
                    </div>

                ) : (

                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">

                        {filteredItems.map((item) => {

                            const quantity = getQuantity(item.MenuItemId);

                            return (

                                <motion.div
                                    key={item.MenuItemId}
                                    whileHover={{ y: -3 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
                                >

                                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">

                                        {item.ImageUrl ? (
                                            <img
                                                src={item.ImageUrl}
                                                alt={item.ItemName}
                                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                                                <ChefHat className="h-8 w-8 text-primary/40" />
                                            </div>
                                        )}

                                        <div className={cn(
                                            "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border-2 bg-white/90",
                                            item.IsVeg ? "border-success" : "border-destructive"
                                        )}>
                                            <div className={cn("h-2 w-2 rounded-full", item.IsVeg ? "bg-success" : "bg-destructive")} />
                                        </div>

                                        {item.IsPopular && (
                                            <Badge variant="warning" className="absolute right-2 top-2 bg-warning text-warning-foreground shadow-sm">
                                                <Sparkles className="h-3 w-3" /> Popular
                                            </Badge>
                                        )}

                                    </div>

                                    <div className="flex flex-1 flex-col p-3">

                                        <p className="line-clamp-1 font-semibold text-foreground">{item.ItemName}</p>

                                        {item.Description && (
                                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.Description}</p>
                                        )}

                                        <div className="mt-auto flex items-center justify-between pt-3">

                                            <span className="font-bold text-foreground">₹{Number(item.Price).toFixed(0)}</span>

                                            {item.HasOptions ? (

                                                <div className="flex items-center gap-1.5">
                                                    {quantity > 0 && <Badge>{quantity}</Badge>}
                                                    <Button size="sm" onClick={() => handleAddClick(item)}>
                                                        <Plus className="h-3.5 w-3.5" /> Add
                                                    </Button>
                                                </div>

                                            ) : quantity === 0 ? (

                                                <Button size="sm" onClick={() => handleAddClick(item)}>
                                                    <Plus className="h-3.5 w-3.5" /> Add
                                                </Button>

                                            ) : (

                                                <QuantityStepper
                                                    size="sm"
                                                    value={quantity}
                                                    onCommit={(next) => handleSetLineQuantity(String(item.MenuItemId), next)}
                                                />

                                            )}

                                        </div>

                                    </div>

                                </motion.div>

                            );

                        })}

                    </div>

                )}

            </div>

            {/* RIGHT — order summary, sticky */}
            <div className="lg:sticky lg:top-0 lg:self-start">

                <div className="rounded-2xl border border-border bg-card shadow-sm">

                    <div className="p-5">

                        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
                            <UserRound className="h-4 w-4 text-primary" /> Customer
                        </div>

                        {resolvedCustomer ? (

                            <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2">
                                <span className="truncate text-sm font-semibold text-success">
                                    {isGuest ? "Walk-in Guest (no details given)" : `${resolvedCustomer.FullName} — ${resolvedCustomer.Phone}`}
                                </span>
                                <button type="button" onClick={handleChangeCustomer} className="flex-shrink-0 text-success/70 hover:text-success">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                        ) : (

                            <div className="flex flex-col gap-2">

                                <Input
                                    placeholder="Phone Number"
                                    value={customerPhone}
                                    onChange={(event) => setCustomerPhone(event.target.value)}
                                    onBlur={() => customerPhone.trim() && !needsName && handleFindCustomer()}
                                />

                                {needsName && (
                                    <Input
                                        placeholder="Customer Name"
                                        value={customerName}
                                        onChange={(event) => setCustomerName(event.target.value)}
                                    />
                                )}

                                <div className="flex gap-2">

                                    <Button
                                        variant="outline"
                                        disabled={checkingCustomer}
                                        onClick={handleFindCustomer}
                                        className="flex-1"
                                    >
                                        {needsName ? "Create Customer" : "Find / Add Customer"}
                                    </Button>

                                    {!needsName && (
                                        <Button variant="ghost" disabled={checkingCustomer} onClick={handleUseGuest}>
                                            Guest
                                        </Button>
                                    )}

                                </div>

                            </div>

                        )}

                    </div>

                    <Separator />

                    <div className="p-5">

                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-bold text-foreground">Cart</p>
                            {cartItemCount > 0 && <Badge>{cartItemCount} item{cartItemCount === 1 ? "" : "s"}</Badge>}
                        </div>

                        {cartLines.length === 0 ? (

                            <p className="py-2 text-sm text-muted-foreground">No items added yet.</p>

                        ) : (

                            <div className="flex max-h-64 flex-col gap-2.5 overflow-y-auto pr-0.5">

                                <AnimatePresence initial={false}>

                                    {cartLines.map((line) => (

                                        <motion.div
                                            key={line.lineKey}
                                            layout
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex items-start justify-between gap-2"
                                        >

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">{line.itemName}</p>
                                                {line.summary && (
                                                    <p className="truncate text-xs text-muted-foreground">{line.summary}</p>
                                                )}
                                                <p className="text-xs font-semibold text-muted-foreground">₹{(line.price * line.quantity).toFixed(2)}</p>
                                            </div>

                                            <div className="flex flex-shrink-0 items-center gap-1.5">

                                                <QuantityStepper
                                                    size="sm"
                                                    value={line.quantity}
                                                    onCommit={(next) => handleSetLineQuantity(line.lineKey, next)}
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLine(line.lineKey)}
                                                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>

                                            </div>

                                        </motion.div>

                                    ))}

                                </AnimatePresence>

                            </div>

                        )}

                    </div>

                    <Separator />

                    <div className="p-5">

                        <p className="mb-2 text-sm font-bold text-foreground">Payment Method</p>

                        <div className="grid grid-cols-3 gap-2">

                            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (

                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setPaymentMethod(value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors",
                                        paymentMethod === value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"
                                    )}
                                >
                                    <Icon className="h-4 w-4" /> {label}
                                </button>

                            ))}

                        </div>

                        <Textarea
                            placeholder="Order Notes (optional)"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            className="mt-3"
                            rows={2}
                        />

                    </div>

                    <Separator />

                    <div className="p-5">

                        {cartLines.length > 0 && (

                            <div className="mb-3 flex items-baseline justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Subtotal</p>
                                    <p className="text-xs text-muted-foreground">Tax added at checkout</p>
                                </div>
                                <p className="text-xl font-extrabold text-foreground">₹{subtotal.toFixed(2)}</p>
                            </div>

                        )}

                        <div className="flex gap-2">

                            {onCancel && (
                                <Button variant="outline" onClick={onCancel}>
                                    Back
                                </Button>
                            )}

                            <Button
                                size="lg"
                                disabled={submitting}
                                onClick={handlePlaceOrder}
                                className="flex-1 justify-between"
                            >
                                <span>{submitting ? "Placing Order..." : "Place Order"}</span>
                                <kbd className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">F9</kbd>
                            </Button>

                        </div>

                    </div>

                </div>

            </div>

            <PosItemOptionsDialog
                open={Boolean(optionsDialogItem)}
                menuItem={optionsDialogItem}
                onClose={() => setOptionsDialogItem(null)}
                onConfirm={handleConfirmOptions}
            />

            <PrintDialog
                open={Boolean(placedOrder)}
                onClose={() => { onCreated(placedOrder.createdOrder); setPlacedOrder(null); }}
                printLabel="Print KOT"
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

        </div>

    );

}

export default PosOrderBuilder;
