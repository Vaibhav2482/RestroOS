import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    Radio,
    RadioGroup,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import toast from "react-hot-toast";

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

    const handleMultiSelect = (group, optionId, checked) => {

        setSelections((prev) => {

            const current = prev[group.GroupId] || [];
            const maxSelect = group.MaxSelect || current.length + 1;

            if (checked) {

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

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">

            <DialogTitle>
                {menuItem.ItemName}
            </DialogTitle>

            <DialogContent dividers>

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    groups.map((group) => {

                        const maxSelect = group.MaxSelect || 1;
                        const currentSelection = selections[group.GroupId] || [];
                        const activeOptions = (group.Options || []).filter((option) => option.IsActive !== false);

                        return (

                            <Box key={group.GroupId} sx={{ mb: 2.5 }}>

                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>

                                    <Typography fontWeight={700}>
                                        {group.GroupName}
                                    </Typography>

                                    <Typography variant="caption" color="text.secondary">
                                        {getGroupHint(group)}
                                    </Typography>

                                </Box>

                                {maxSelect === 1 ? (

                                    <RadioGroup
                                        value={currentSelection[0] ?? ""}
                                        onChange={(event) => handleSingleSelect(group, Number(event.target.value))}
                                    >

                                        {activeOptions.map((option) => (

                                            <FormControlLabel
                                                key={option.OptionId}
                                                value={option.OptionId}
                                                control={
                                                    <Radio
                                                        size="small"
                                                        onClick={() => {

                                                            if (!group.IsRequired && currentSelection[0] === option.OptionId) {
                                                                handleSingleSelect(group, option.OptionId);
                                                            }

                                                        }}
                                                    />
                                                }
                                                label={`${option.OptionName}${formatDelta(option.PriceDelta)}`}
                                            />

                                        ))}

                                    </RadioGroup>

                                ) : (

                                    activeOptions.map((option) => {

                                        const checked = currentSelection.includes(option.OptionId);
                                        const disableUnchecked = !checked && currentSelection.length >= maxSelect;

                                        return (

                                            <FormControlLabel
                                                key={option.OptionId}
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={checked}
                                                        disabled={disableUnchecked}
                                                        onChange={(event) => handleMultiSelect(group, option.OptionId, event.target.checked)}
                                                    />
                                                }
                                                label={`${option.OptionName}${formatDelta(option.PriceDelta)}`}
                                            />

                                        );

                                    })

                                )}

                            </Box>

                        );

                    })

                )}

                {!loading && (

                    <>

                        <Divider sx={{ my: 1.5 }} />

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                            <Typography fontWeight={600}>
                                Quantity
                            </Typography>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    border: "1px solid #E5E7EB",
                                    borderRadius: 5,
                                    px: 0.5,
                                    py: 0.25,
                                    width: 112
                                }}
                            >

                                <IconButton
                                    size="small"
                                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                                    disabled={quantity <= 1}
                                    sx={{ p: 0.75 }}
                                >
                                    <RemoveRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>

                                <Typography fontWeight={700} sx={{ minWidth: 20, textAlign: "center" }}>
                                    {quantity}
                                </Typography>

                                <IconButton
                                    size="small"
                                    onClick={() => setQuantity((current) => current + 1)}
                                    sx={{ p: 0.75 }}
                                >
                                    <AddRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>

                            </Box>

                        </Box>

                    </>

                )}

            </DialogContent>

            <DialogActions>

                <Button onClick={onClose}>
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    disabled={loading || !requiredGroupsSatisfied}
                    onClick={handleConfirm}
                >
                    Add Item — ₹{totalPrice.toFixed(2)}
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default PosItemOptionsDialog;
