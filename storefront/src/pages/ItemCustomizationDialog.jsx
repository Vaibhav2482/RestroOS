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
    Stack,
    Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CloseIcon from "@mui/icons-material/Close";
import toast from "react-hot-toast";

import * as menuOptionService from "../services/menuOptionService";
import * as cartService from "../services/cartService";
import * as publicService from "../services/publicService";
import { useStorefront } from "../context/StorefrontContext";

function formatDelta(delta) {

    const value = Number(delta) || 0;

    if (value > 0) {
        return `+₹${value.toFixed(2)}`;
    }

    return "";

}

function groupHint(group) {

    const min = group.MinSelect ?? (group.IsRequired ? 1 : 0);
    const max = group.MaxSelect ?? min;

    if (group.IsRequired) {
        return min === max ? `Required · Select ${min}` : `Required · Select ${min}-${max}`;
    }

    return max > 1 ? `Select up to ${max}` : "Optional";

}

function isGroupValid(group, selectedIds) {

    const count = selectedIds?.length || 0;
    const min = group.MinSelect ?? (group.IsRequired ? 1 : 0);
    const max = group.MaxSelect ?? Infinity;

    return count >= min && count <= max;

}

function ItemCustomizationDialog({ open, item, onClose }) {

    const { customer, refreshCartCount } = useStorefront();

    const [activeItem, setActiveItem] = useState(item);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selections, setSelections] = useState({});
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);
    const [addingRecId, setAddingRecId] = useState(null);

    // Loads option groups + cross-sell recommendations for whichever item
    // should currently be shown in the dialog. Called both when the dialog
    // is first opened for `item` (via the effect below) and when the
    // customer quick-adds a recommendation that itself needs customization -
    // in that case we simply reload this same dialog in place for the new
    // item instead of stacking/nesting a second dialog.
    const loadItemForCustomization = async (targetItem, cancelledRef) => {

        setActiveItem(targetItem);
        setQuantity(1);
        setSelections({});
        setRecommendations([]);
        setLoading(true);

        try {

            const response = await menuOptionService.getGroupsForMenuItem(targetItem.MenuItemId);

            if (cancelledRef.current) {
                return;
            }

            if (!response.success) {
                toast.error(response.message || "Failed to load customization options.");
                onClose();
                return;
            }

            const fetchedGroups = response.data || [];
            setGroups(fetchedGroups);

            const initialSelections = {};

            fetchedGroups.forEach((group) => {

                const defaults = (group.Options || [])
                    .filter((option) => option.IsDefault)
                    .map((option) => option.OptionId);

                if (defaults.length > 0) {
                    initialSelections[group.GroupId] = group.MaxSelect === 1 ? [defaults[0]] : defaults;
                }

            });

            if (!cancelledRef.current) {
                setSelections(initialSelections);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load customization options.");
            onClose();
            return;

        } finally {

            if (!cancelledRef.current) {
                setLoading(false);
            }

        }

        setRecsLoading(true);

        try {

            const recResponse = await publicService.getRecommendations(targetItem.MenuItemId);

            if (!cancelledRef.current && recResponse.success) {
                setRecommendations(recResponse.data || []);
            }

        } catch (error) {

            // Cross-sell suggestions are a non-critical enhancement - fail silently.

        } finally {

            if (!cancelledRef.current) {
                setRecsLoading(false);
            }

        }

    };

    useEffect(() => {

        if (!open || !item?.MenuItemId) {
            return;
        }

        const cancelledRef = { current: false };

        loadItemForCustomization(item, cancelledRef);

        return () => { cancelledRef.current = true; };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, item?.MenuItemId]);

    const optionsById = useMemo(() => {

        const map = {};

        groups.forEach((group) => {
            (group.Options || []).forEach((option) => {
                map[option.OptionId] = option;
            });
        });

        return map;

    }, [groups]);

    const selectedOptionIds = useMemo(
        () => Object.values(selections).flat(),
        [selections]
    );

    const optionsDelta = useMemo(
        () => selectedOptionIds.reduce((sum, optionId) => sum + (Number(optionsById[optionId]?.PriceDelta) || 0), 0),
        [selectedOptionIds, optionsById]
    );

    const unitPrice = Number(activeItem?.Price ?? 0) + optionsDelta;
    const grandTotal = unitPrice * quantity;

    const canSubmit = !loading && groups.every((group) => isGroupValid(group, selections[group.GroupId]));

    const handleRadioSelect = (group, optionId) => {

        setSelections((prev) => ({ ...prev, [group.GroupId]: [optionId] }));

    };

    const handleCheckboxToggle = (group, optionId) => {

        setSelections((prev) => {

            const current = prev[group.GroupId] || [];
            const isSelected = current.includes(optionId);

            if (isSelected) {
                return { ...prev, [group.GroupId]: current.filter((id) => id !== optionId) };
            }

            if (group.MaxSelect && current.length >= group.MaxSelect) {
                return prev;
            }

            return { ...prev, [group.GroupId]: [...current, optionId] };

        });

    };

    const handleClose = () => {

        if (submitting) {
            return;
        }

        onClose();

    };

    const handleConfirm = async () => {

        if (!canSubmit || submitting) {
            return;
        }

        try {

            setSubmitting(true);

            const response = await cartService.addToCart({
                customerId: customer.CustomerId,
                menuItemId: displayItem.MenuItemId,
                quantity,
                selectedOptionIds
            });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            refreshCartCount();
            toast.success(`${displayItem.ItemName} added to cart`);
            onClose(true);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to add item to cart.");

        } finally {

            setSubmitting(false);

        }

    };

    const handleQuickAddRecommendation = async (rec) => {

        if (submitting || addingRecId) {
            return;
        }

        if (rec.HasOptions) {

            const cancelledRef = { current: false };
            loadItemForCustomization(rec, cancelledRef);
            return;

        }

        try {

            setAddingRecId(rec.MenuItemId);

            const response = await cartService.addToCart({
                customerId: customer.CustomerId,
                menuItemId: rec.MenuItemId,
                quantity: 1
            });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            refreshCartCount();
            toast.success(`${rec.ItemName} added to cart`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to add item to cart.");

        } finally {

            setAddingRecId(null);

        }

    };

    if (!item) {
        return null;
    }

    // activeItem is kept in sync with `item` by loadItemForCustomization,
    // but falls back to `item` itself for the brief render before that
    // effect has had a chance to run (e.g. the very first time this dialog
    // instance is ever opened).
    const displayItem = activeItem || item;

    return (

        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">

            <DialogTitle sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>

                <Box>
                    <Typography variant="h6" fontWeight={800}>
                        {displayItem.ItemName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        ₹{Number(displayItem.Price).toFixed(2)}
                    </Typography>
                </Box>

                <IconButton size="small" onClick={handleClose} disabled={submitting}>
                    <CloseIcon fontSize="small" />
                </IconButton>

            </DialogTitle>

            <Divider />

            <DialogContent sx={{ minHeight: 120 }}>

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    <Stack spacing={3}>

                        {groups.map((group) => {

                            const groupSelection = selections[group.GroupId] || [];
                            const isSingleSelect = group.MaxSelect === 1;
                            const atCap = Boolean(group.MaxSelect) && groupSelection.length >= group.MaxSelect;

                            return (

                                <Box key={group.GroupId}>

                                    <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                                        <Typography fontWeight={700}>{group.GroupName}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {groupHint(group)}
                                        </Typography>
                                    </Stack>

                                    <Divider sx={{ my: 1 }} />

                                    {isSingleSelect ? (

                                        <RadioGroup
                                            value={groupSelection[0] ?? ""}
                                            onChange={(event) => handleRadioSelect(group, Number(event.target.value))}
                                        >
                                            {(group.Options || [])
                                                .filter((option) => option.IsActive !== false)
                                                .sort((a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0))
                                                .map((option) => (
                                                    <FormControlLabel
                                                        key={option.OptionId}
                                                        value={option.OptionId}
                                                        control={<Radio size="small" />}
                                                        sx={{ width: "100%", mr: 0, justifyContent: "space-between" }}
                                                        labelPlacement="start"
                                                        label={
                                                            <Stack direction="row" justifyContent="space-between" sx={{ width: "100%", flexGrow: 1 }}>
                                                                <Typography variant="body2">{option.OptionName}</Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {formatDelta(option.PriceDelta)}
                                                                </Typography>
                                                            </Stack>
                                                        }
                                                    />
                                                ))}
                                        </RadioGroup>

                                    ) : (

                                        <Stack spacing={0.5}>

                                            {(group.Options || [])
                                                .filter((option) => option.IsActive !== false)
                                                .sort((a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0))
                                                .map((option) => {

                                                    const checked = groupSelection.includes(option.OptionId);

                                                    return (
                                                        <FormControlLabel
                                                            key={option.OptionId}
                                                            control={
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={checked}
                                                                    disabled={!checked && atCap}
                                                                    onChange={() => handleCheckboxToggle(group, option.OptionId)}
                                                                />
                                                            }
                                                            sx={{ width: "100%", mr: 0, justifyContent: "space-between" }}
                                                            labelPlacement="start"
                                                            label={
                                                                <Stack direction="row" justifyContent="space-between" sx={{ width: "100%", flexGrow: 1 }}>
                                                                    <Typography variant="body2">{option.OptionName}</Typography>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {formatDelta(option.PriceDelta)}
                                                                    </Typography>
                                                                </Stack>
                                                            }
                                                        />
                                                    );

                                                })}

                                        </Stack>

                                    )}

                                </Box>

                            );

                        })}

                    </Stack>

                )}

                {!loading && !recsLoading && recommendations.length > 0 ? (

                    <Box sx={{ mt: 3 }}>

                        <Divider sx={{ mb: 1.5 }} />

                        <Typography
                            variant="caption"
                            fontWeight={700}
                            color="text.secondary"
                            sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}
                        >
                            Pairs well with
                        </Typography>

                        <Stack direction="row" spacing={1.25} sx={{ mt: 1, overflowX: "auto", pb: 0.5 }}>

                            {recommendations.slice(0, 4).map((rec) => (

                                <Box
                                    key={rec.MenuItemId}
                                    sx={{
                                        flexShrink: 0,
                                        width: 104,
                                        border: "1px solid #E5E7EB",
                                        borderRadius: 1.5,
                                        p: 1
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: "100%",
                                            height: 52,
                                            borderRadius: 1,
                                            bgcolor: "#F3F4F6",
                                            backgroundImage: rec.ImageUrl ? `url(${rec.ImageUrl})` : "none",
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                            mb: 0.75
                                        }}
                                    />

                                    <Typography variant="caption" fontWeight={600} noWrap component="div">
                                        {rec.ItemName}
                                    </Typography>

                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.25 }}>

                                        <Typography variant="caption" color="text.secondary">
                                            ₹{Number(rec.Price).toFixed(2)}
                                        </Typography>

                                        <IconButton
                                            size="small"
                                            disabled={Boolean(addingRecId) || submitting}
                                            onClick={() => handleQuickAddRecommendation(rec)}
                                            sx={{ border: "1px solid #E5E7EB", width: 22, height: 22 }}
                                        >
                                            <AddIcon sx={{ fontSize: 14 }} />
                                        </IconButton>

                                    </Stack>

                                </Box>

                            ))}

                        </Stack>

                    </Box>

                ) : null}

            </DialogContent>

            <Divider />

            <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", p: 2, gap: 1.5 }}>

                <Stack direction="row" alignItems="center" justifyContent="center" spacing={2}>

                    <IconButton
                        size="small"
                        sx={{ border: "1px solid #E5E7EB" }}
                        disabled={quantity <= 1}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                        <RemoveIcon fontSize="small" />
                    </IconButton>

                    <Typography fontWeight={700} sx={{ minWidth: 24, textAlign: "center" }}>
                        {quantity}
                    </Typography>

                    <IconButton
                        size="small"
                        sx={{ border: "1px solid #E5E7EB" }}
                        onClick={() => setQuantity((q) => q + 1)}
                    >
                        <AddIcon fontSize="small" />
                    </IconButton>

                </Stack>

                <Button
                    fullWidth
                    variant="contained"
                    disabled={!canSubmit || submitting}
                    onClick={handleConfirm}
                    sx={{ height: 48 }}
                >
                    {submitting ? "Adding..." : `Add Item · ₹${grandTotal.toFixed(2)}`}
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default ItemCustomizationDialog;
