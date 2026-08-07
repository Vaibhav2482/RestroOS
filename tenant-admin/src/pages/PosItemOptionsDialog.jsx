import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus, Check } from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "../lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import * as menuOptionService from "../services/menuOptionService";

// Renders "+₹34" / "-₹34" for non-zero price deltas, nothing for a 0 delta.
const formatDelta = (delta) => {

    const value = Number(delta) || 0;

    if (value === 0) {
        return "";
    }

    const sign = value > 0 ? "+" : "-";
    const magnitude = Math.abs(value);
    const formatted = Number.isInteger(magnitude) ? magnitude.toString() : magnitude.toFixed(2);

    return ` (${sign}₹${formatted})`;

};

const getGroupHint = (group) => {

    const minSelect = group.MinSelect || (group.IsRequired ? 1 : 0);
    const maxSelect = group.MaxSelect || 1;

    if (group.IsRequired) {

        if (maxSelect === 1) {
            return "Required · Select 1";
        }

        if (minSelect > 1 && minSelect !== maxSelect) {
            return `Required · Select ${minSelect}-${maxSelect}`;
        }

        return `Required · Select up to ${maxSelect}`;

    }

    if (maxSelect === 1) {
        return "Optional";
    }

    return `Select up to ${maxSelect}`;

};

// A single tappable row for one option - used for both radio (single-select)
// and checkbox (multi-select) groups, just with a differently-shaped
// indicator, matching how consumer food-ordering apps present variant
// pickers rather than looking like a plain browser form control.
function OptionRow({ label, delta, selected, disabled, shape, onClick }) {

    return (

        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                disabled && "cursor-not-allowed opacity-40"
            )}
        >
            <span className="font-medium text-foreground">
                {label}
                {delta && <span className="text-muted-foreground"> {delta}</span>}
            </span>

            <span
                className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 transition-colors",
                    shape === "circle" ? "rounded-full" : "rounded-md",
                    selected ? "border-primary bg-primary" : "border-border"
                )}
            >
                {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
            </span>
        </button>

    );

}

// Opened when staff tap "Add" on a menu item that has HasOptions === true.
// Fetches the item's option groups, lets staff pick required/optional
// customizations plus a quantity, then hands the resolved selection back to
// the caller (PosOrderBuilder) to fold into its local cart — this dialog
// never talks to the orders API directly, matching how the rest of the POS
// flow accumulates a cart before one final createOrder call at checkout.
function PosItemOptionsDialog({ open, menuItem, onClose, onConfirm }) {

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selections, setSelections] = useState({});
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {

        if (!open || !menuItem) {
            return;
        }

        setQuantity(1);

        (async () => {

            try {

                setLoading(true);

                const response = await menuOptionService.getOptionGroupsByMenuItem(menuItem.MenuItemId);

                if (response.success) {

                    const loadedGroups = response.data || [];
                    setGroups(loadedGroups);

                    const initialSelections = {};

                    loadedGroups.forEach((group) => {

                        const defaults = (group.Options || [])
                            .filter((option) => option.IsDefault && option.IsActive !== false)
                            .slice(0, group.MaxSelect || 1)
                            .map((option) => option.OptionId);

                        initialSelections[group.GroupId] = defaults;

                    });

                    setSelections(initialSelections);

                } else {

                    toast.error(response.message || "Failed to load item options.");

                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load item options.");

            } finally {

                setLoading(false);

            }

        })();

    }, [open, menuItem]);

    const optionLookup = useMemo(() => {

        const lookup = new Map();

        groups.forEach((group) => {
            (group.Options || []).forEach((option) => {
                lookup.set(option.OptionId, option);
            });
        });

        return lookup;

    }, [groups]);

    const deltaTotal = useMemo(() => {

        return Object.values(selections).reduce((sum, optionIds) =>
            sum + optionIds.reduce((groupSum, optionId) => {
                const option = optionLookup.get(optionId);
                return groupSum + (option ? Number(option.PriceDelta) || 0 : 0);
            }, 0),
        0);

    }, [selections, optionLookup]);

    const unitPrice = (Number(menuItem?.Price) || 0) + deltaTotal;
    const totalPrice = unitPrice * quantity;

    const requiredGroupsSatisfied = useMemo(() =>
        groups
            .filter((group) => group.IsRequired)
            .every((group) => (selections[group.GroupId] || []).length >= (group.MinSelect || 1)),
    [groups, selections]);

    const handleSingleSelect = (group, optionId) => {

        setSelections((prev) => {

            const current = prev[group.GroupId] || [];

            if (!group.IsRequired && current[0] === optionId) {
                return { ...prev, [group.GroupId]: [] };
            }

            return { ...prev, [group.GroupId]: [optionId] };

        });

    };

    const handleMultiSelect = (group, optionId) => {

        setSelections((prev) => {

            const current = prev[group.GroupId] || [];
            const maxSelect = group.MaxSelect || current.length + 1;
            const checked = current.includes(optionId);

            if (!checked) {

                if (current.length >= maxSelect) {
                    return prev;
                }

                return { ...prev, [group.GroupId]: [...current, optionId] };

            }

            return { ...prev, [group.GroupId]: current.filter((id) => id !== optionId) };

        });

    };

    const handleConfirm = () => {

        const selectedOptionIds = Object.values(selections).flat();

        const summary = selectedOptionIds
            .map((optionId) => optionLookup.get(optionId)?.OptionName)
            .filter(Boolean)
            .join(", ");

        onConfirm({
            menuItemId: menuItem.MenuItemId,
            quantity,
            selectedOptionIds,
            unitPrice,
            summary
        });

    };

    if (!menuItem) {
        return null;
    }

    return (

        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>

            <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">

                <DialogHeader>
                    <DialogTitle>{menuItem.ItemName}</DialogTitle>
                </DialogHeader>

                {loading ? (

                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>

                ) : (

                    <div className="flex flex-col gap-5">

                        {groups.map((group) => {

                            const maxSelect = group.MaxSelect || 1;
                            const currentSelection = selections[group.GroupId] || [];
                            const activeOptions = (group.Options || []).filter((option) => option.IsActive !== false);

                            return (

                                <div key={group.GroupId}>

                                    <div className="mb-2 flex items-baseline justify-between">
                                        <p className="font-bold text-foreground">{group.GroupName}</p>
                                        <p className="text-xs text-muted-foreground">{getGroupHint(group)}</p>
                                    </div>

                                    <div className="flex flex-col gap-2">

                                        {activeOptions.map((option) => {

                                            const selected = currentSelection.includes(option.OptionId);
                                            const disabled = maxSelect > 1 && !selected && currentSelection.length >= maxSelect;

                                            return (

                                                <OptionRow
                                                    key={option.OptionId}
                                                    label={option.OptionName}
                                                    delta={formatDelta(option.PriceDelta)}
                                                    selected={selected}
                                                    disabled={disabled}
                                                    shape={maxSelect === 1 ? "circle" : "square"}
                                                    onClick={() =>
                                                        maxSelect === 1
                                                            ? handleSingleSelect(group, option.OptionId)
                                                            : handleMultiSelect(group, option.OptionId)
                                                    }
                                                />

                                            );

                                        })}

                                    </div>

                                </div>

                            );

                        })}

                        <div className="flex items-center justify-between border-t border-border pt-4">

                            <p className="font-semibold text-foreground">Quantity</p>

                            <div className="flex items-center gap-3 rounded-full border border-border px-1 py-1">

                                <button
                                    type="button"
                                    disabled={quantity <= 1}
                                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent disabled:opacity-40"
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </button>

                                <span className="w-5 text-center font-bold text-foreground">{quantity}</span>

                                <button
                                    type="button"
                                    onClick={() => setQuantity((current) => current + 1)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>

                            </div>

                        </div>

                    </div>

                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={loading || !requiredGroupsSatisfied} onClick={handleConfirm}>
                        Add Item — ₹{totalPrice.toFixed(2)}
                    </Button>
                </DialogFooter>

            </DialogContent>

        </Dialog>

    );

}

export default PosItemOptionsDialog;
